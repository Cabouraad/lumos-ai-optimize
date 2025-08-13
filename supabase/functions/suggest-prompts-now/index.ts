import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const openaiKey = Deno.env.get('OPENAI_API_KEY');

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Get user from JWT
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get user's org
    const { data: userData } = await supabase
      .from('users')
      .select('org_id')
      .eq('id', user.id)
      .single();

    if (!userData?.org_id) {
      return new Response(JSON.stringify({ error: 'Organization not found' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const orgId = userData.org_id;

    // Get organization data
    const { data: org } = await supabase
      .from('organizations')
      .select('name, domain, plan_tier')
      .eq('id', orgId)
      .single();

    if (!org) {
      return new Response(JSON.stringify({ error: 'Organization not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const result = await generateSuggestions(orgId, org.name, org.domain, supabase, openaiKey);
    
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in suggest-prompts-now function:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message || 'Internal server error',
      suggestionsCreated: 0
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function generateSuggestions(orgId: string, orgName: string, orgDomain: string, supabase: any, openaiKey?: string) {
  try {
    console.log(`Generating suggestions for org ${orgId} (${orgName})`);

    // Get brand catalog
    const { data: brands } = await supabase
      .from('brand_catalog')
      .select('name, variants_json')
      .eq('org_id', orgId)
      .eq('is_org_brand', true);

    // Get recent visibility results to identify gaps
    const { data: recentResults } = await supabase
      .from('visibility_results')
      .select(`
        score,
        org_brand_present,
        competitors_count,
        prompt_runs!inner (
          prompts!inner (
            text,
            org_id
          )
        )
      `)
      .eq('prompt_runs.prompts.org_id', orgId)
      .order('prompt_runs.run_at', { ascending: false })
      .limit(50);

    // Extract domain from organization domain
    const domain = orgDomain.replace(/^https?:\/\//, '').replace('www.', '');
    const industry = inferIndustryFromDomain(domain);
    
    const brandNames = brands?.map(b => b.name) || [orgName];
    const mainBrand = brandNames[0] || orgName;

    // Generate suggestions based on different strategies
    const suggestions: string[] = [];

    // Strategy 1: Industry-specific prompts
    const industryPrompts = generateIndustryPrompts(industry, mainBrand);
    suggestions.push(...industryPrompts);

    // Strategy 2: Competitor analysis prompts
    const competitorPrompts = generateCompetitorPrompts(mainBrand, domain);
    suggestions.push(...competitorPrompts);

    // Strategy 3: Gap analysis from low-scoring results
    if (recentResults) {
      const lowScorePrompts = analyzeLowScoreResults(recentResults, mainBrand);
      suggestions.push(...lowScorePrompts);
    }

    // Strategy 4: Trending topics (if OpenAI is available)
    if (openaiKey) {
      try {
        const trendingPrompts = await generateTrendingPrompts(mainBrand, industry, openaiKey);
        suggestions.push(...trendingPrompts);
      } catch (aiError) {
        console.error('Error generating AI suggestions:', aiError);
      }
    }

    // Deduplicate and limit
    const uniqueSuggestions = [...new Set(suggestions)].slice(0, 20);

    // Insert suggestions into database
    const insertData = uniqueSuggestions.map((text, index) => ({
      org_id: orgId,
      text,
      source: getSourceForSuggestion(text, index < industryPrompts.length),
      accepted: false
    }));

    if (insertData.length > 0) {
      const { error: insertError } = await supabase
        .from('suggested_prompts')
        .insert(insertData);

      if (insertError) {
        console.error('Error inserting suggestions:', insertError);
        return { success: false, error: insertError.message, suggestionsCreated: 0 };
      }
    }

    return { 
      success: true, 
      suggestionsCreated: insertData.length,
      error: null
    };

  } catch (error) {
    console.error('Error in generateSuggestions:', error);
    return { 
      success: false, 
      error: error.message || 'Unknown error',
      suggestionsCreated: 0 
    };
  }
}

function inferIndustryFromDomain(domain: string): string {
  const domainLower = domain.toLowerCase();
  
  if (domainLower.includes('tech') || domainLower.includes('software') || domainLower.includes('app')) return 'technology';
  if (domainLower.includes('health') || domainLower.includes('medical') || domainLower.includes('care')) return 'healthcare';
  if (domainLower.includes('finance') || domainLower.includes('bank') || domainLower.includes('invest')) return 'finance';
  if (domainLower.includes('retail') || domainLower.includes('shop') || domainLower.includes('store')) return 'retail';
  if (domainLower.includes('food') || domainLower.includes('restaurant') || domainLower.includes('cafe')) return 'food';
  if (domainLower.includes('travel') || domainLower.includes('hotel') || domainLower.includes('tour')) return 'travel';
  if (domainLower.includes('edu') || domainLower.includes('school') || domainLower.includes('university')) return 'education';
  
  return 'business';
}

function generateIndustryPrompts(industry: string, brandName: string): string[] {
  const templates: Record<string, string[]> = {
    'technology': [
      `What's the easiest CRM that actually works for small teams?`,
      `I'm frustrated with our current project management tool, what's better?`,
      `Best accounting software for freelancers under $50/month`,
      `Should I switch from Slack to Teams for a 50-person company?`,
      `Looking for a simple invoicing tool that integrates with QuickBooks`,
      `My team hates our current time tracking app - alternatives?`,
      `What's the most user-friendly HR software for startups?`,
      `Need a reliable backup solution that doesn't break the bank`
    ],
    'healthcare': [
      `HIPAA-compliant CRM for small medical practice`,
      `What's the best patient scheduling software that patients actually like?`,
      `Looking for EMR system that doesn't slow down appointments`,
      `How do I choose between Epic and Cerner for our clinic?`,
      `Best telehealth platform for solo practitioners`,
      `Patient portal software that's actually intuitive`,
      `Medical billing software that reduces claim denials`,
      `What practice management system works well with existing workflows?`
    ],
    'finance': [
      `Client portal software for financial advisors`,
      `What's the best CRM for wealth management firms?`,
      `Looking for trading platform with good mobile app`,
      `Should small credit unions switch to cloud banking systems?`,
      `Best expense management tool for remote finance teams`,
      `How to choose between Mint and YNAB for budgeting?`,
      `What's the most secure payment processing for small business?`,
      `Looking for loan origination software that's not overly complex`
    ],
    'retail': [
      `Inventory management for multi-channel selling`,
      `What POS system works best with Shopify?`,
      `Looking for customer loyalty program that's easy to set up`,
      `Best e-commerce platform for fashion boutiques`,
      `How to manage inventory across Amazon, eBay, and my website?`,
      `What's the simplest way to track sales across multiple locations?`,
      `Need recommendation for retail analytics that's not overwhelming`,
      `Best employee scheduling software for retail chains`
    ],
    'education': [
      `What's the most intuitive LMS for K-12 schools?`,
      `Looking for online course platform that students actually engage with`,
      `Best gradebook software that syncs with Google Classroom`,
      `How to choose between Canvas and Blackboard for university?`,
      `What video conferencing works best for virtual classrooms?`,
      `Student information system that parents can easily navigate`,
      `Looking for plagiarism detection that's accurate but fair`,
      `Best digital library system for community colleges`
    ]
  };

  return templates[industry] || [
    `What's the best ${industry} solution that's actually easy to use?`,
    `I need help choosing between different ${industry} options`,
    `Looking for affordable ${industry} software for small business`,
    `What ${industry} tool has the best customer support?`,
    `Should I switch from my current ${industry} provider?`,
    `Best ${industry} platform for teams under 25 people`,
    `${industry} software with good mobile app and integrations`,
    `How to find reliable ${industry} solution within budget?`
  ];
}

function generateCompetitorPrompts(brandName: string, domain: string): string[] {
  return [
    `Is ${brandName} better than its competitors?`,
    `What are the best alternatives to ${brandName}?`,
    `${brandName} vs [competitor] - which should I choose?`,
    `Looking for something similar to ${brandName} but cheaper`,
    `Why should I pick ${brandName} over other options?`,
    `${brandName} reviews - is it worth the switch?`,
    `Comparing ${brandName} with industry leaders`,
    `What makes ${brandName} different from competitors?`
  ];
}

function analyzeLowScoreResults(results: any[], brandName: string): string[] {
  const lowScoreResults = results.filter(r => r.score < 3);
  
  if (lowScoreResults.length === 0) return [];
  
  return [
    `Why isn't ${brandName} showing up in search results?`,
    `How can ${brandName} improve its online visibility?`,
    `What are people saying about ${brandName} online?`,
    `${brandName} reputation management - what do customers think?`,
    `How to make ${brandName} more discoverable online`,
    `Is ${brandName} losing market share to competitors?`,
    `What can ${brandName} do to stand out in search results?`,
    `${brandName} SEO strategy - why aren't we ranking higher?`
  ];
}

async function generateTrendingPrompts(brandName: string, industry: string, apiKey: string): Promise<string[]> {
  const prompt = `Generate 6 realistic search queries that people would actually type when looking for ${industry} solutions in 2024. Make them sound conversational and natural, like real user questions. Include some that might mention brands like ${brandName}. Examples of good formats:
- "What's the best [solution] for [specific use case]?"
- "I'm looking for [tool] that [specific need]"  
- "Should I switch from [current solution] to [new solution]?"
- "[Brand] vs [other brand] for [use case]"
- "Looking for [solution] under $X per month"

Make them specific, problem-focused, and conversational. Don't use corporate language like "solutions" or "providers" too much. Return only the search queries, one per line.`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4.1-2025-04-14',
      messages: [
        { 
          role: 'system', 
          content: 'You are an expert at understanding how real people search online. Generate natural, conversational search queries that sound like actual user questions, not corporate marketing speak.' 
        },
        { role: 'user', content: prompt }
      ],
      max_tokens: 400,
      temperature: 0.8,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.statusText}`);
  }

  const data = await response.json();
  const content = data.choices[0].message.content;
  
  return content.split('\n')
    .map((line: string) => line.trim())
    .filter((line: string) => line.length > 0 && !line.match(/^\d+\.?\s*/) && line.includes('?'))
    .slice(0, 6);
}

function getSourceForSuggestion(text: string, isIndustry: boolean): string {
  if (text.includes('vs') || text.includes('alternatives') || text.includes('competitors')) return 'competitors';
  if (text.includes('trends') || text.includes('2024') || text.includes('innovations')) return 'trends';
  if (isIndustry) return 'industry';
  return 'gap';
}