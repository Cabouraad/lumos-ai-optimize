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
  
  if (domainLower.includes('tech') || domainLower.includes('software') || domainLower.includes('app')) return 'Technology';
  if (domainLower.includes('health') || domainLower.includes('medical') || domainLower.includes('care')) return 'Healthcare';
  if (domainLower.includes('finance') || domainLower.includes('bank') || domainLower.includes('invest')) return 'Finance';
  if (domainLower.includes('retail') || domainLower.includes('shop') || domainLower.includes('store')) return 'Retail';
  if (domainLower.includes('food') || domainLower.includes('restaurant') || domainLower.includes('cafe')) return 'Food & Beverage';
  if (domainLower.includes('travel') || domainLower.includes('hotel') || domainLower.includes('tour')) return 'Travel';
  if (domainLower.includes('edu') || domainLower.includes('school') || domainLower.includes('university')) return 'Education';
  
  return 'Business Services';
}

function generateIndustryPrompts(industry: string, brandName: string): string[] {
  const templates: Record<string, string[]> = {
    'Technology': [
      `Best ${industry.toLowerCase()} solutions for small businesses`,
      `${industry} trends and innovations in 2024`,
      `How to choose the right ${industry.toLowerCase()} provider`,
      `${brandName} vs competitors in ${industry.toLowerCase()}`,
      `Top ${industry.toLowerCase()} companies to watch`
    ],
    'Healthcare': [
      `Best healthcare providers in my area`,
      `Healthcare technology solutions for patients`,
      `How to choose a healthcare provider`,
      `${brandName} healthcare services review`,
      `Top healthcare innovations 2024`
    ],
    'Finance': [
      `Best financial services for small business`,
      `How to choose a financial advisor`,
      `Financial planning tools and services`,
      `${brandName} vs other financial institutions`,
      `Top fintech companies 2024`
    ]
  };

  return templates[industry] || [
    `Best ${industry.toLowerCase()} services`,
    `${industry} companies comparison`,
    `How to choose ${industry.toLowerCase()} provider`,
    `${brandName} review and alternatives`,
    `Top ${industry.toLowerCase()} trends 2024`
  ];
}

function generateCompetitorPrompts(brandName: string, domain: string): string[] {
  return [
    `${brandName} vs competitors`,
    `${brandName} alternatives`,
    `Best companies like ${brandName}`,
    `${brandName} review and comparison`,
    `Who are ${brandName} main competitors`
  ];
}

function analyzeLowScoreResults(results: any[], brandName: string): string[] {
  const lowScoreResults = results.filter(r => r.score < 3);
  
  if (lowScoreResults.length === 0) return [];
  
  return [
    `${brandName} market position analysis`,
    `How ${brandName} compares to industry leaders`,
    `${brandName} brand visibility strategy`,
    `Improving ${brandName} online presence`
  ];
}

async function generateTrendingPrompts(brandName: string, industry: string, apiKey: string): Promise<string[]> {
  const prompt = `Generate 5 trending search prompts for 2024 related to ${industry} industry that could mention ${brandName}. Focus on current trends, consumer interests, and comparison searches. Return only the search prompts, one per line.`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a marketing expert who generates relevant search prompts.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 300,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.statusText}`);
  }

  const data = await response.json();
  const content = data.choices[0].message.content;
  
  return content.split('\n')
    .map((line: string) => line.trim())
    .filter((line: string) => line.length > 0 && !line.match(/^\d+\.?\s*/))
    .slice(0, 5);
}

function getSourceForSuggestion(text: string, isIndustry: boolean): string {
  if (text.includes('vs') || text.includes('alternatives') || text.includes('competitors')) return 'competitors';
  if (text.includes('trends') || text.includes('2024') || text.includes('innovations')) return 'trends';
  if (isIndustry) return 'industry';
  return 'gap';
}