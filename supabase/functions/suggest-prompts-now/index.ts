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

    // Get organization data including keywords and business context
    const { data: org } = await supabase
      .from('organizations')
      .select('name, domain, plan_tier, keywords, products_services, target_audience, business_description')
      .eq('id', orgId)
      .single();

    if (!org) {
      return new Response(JSON.stringify({ error: 'Organization not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const result = await generateSuggestions(orgId, org.name, org.domain, org, supabase, openaiKey);
    
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

async function generateSuggestions(orgId: string, orgName: string, orgDomain: string, orgData: any, supabase: any, openaiKey?: string) {
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

    // Build keyword context for enhanced suggestions
    const keywordContext = {
      keywords: orgData.keywords || [],
      products_services: orgData.products_services || '',
      target_audience: orgData.target_audience || '',
      business_description: orgData.business_description || ''
    };

    // Generate suggestions based on different strategies with keyword context
    const suggestions: string[] = [];

    // Strategy 1: Industry-specific prompts
    const industryPrompts = generateIndustryPrompts(industry, mainBrand, keywordContext);
    suggestions.push(...industryPrompts);

    // Strategy 2: Competitor analysis prompts
    const competitorPrompts = generateCompetitorPrompts(mainBrand, domain, keywordContext);
    suggestions.push(...competitorPrompts);

    // Strategy 3: Gap analysis from low-scoring results
    if (recentResults) {
      const lowScorePrompts = analyzeLowScoreResults(recentResults, mainBrand, keywordContext);
      suggestions.push(...lowScorePrompts);
    }

    // Strategy 4: Trending topics (if OpenAI is available)
    if (openaiKey) {
      try {
        const trendingPrompts = await generateTrendingPrompts(mainBrand, industry, openaiKey, keywordContext);
        suggestions.push(...trendingPrompts);
      } catch (aiError) {
        console.error('Error generating AI suggestions:', aiError);
      }
    }

    // Deduplicate and limit
    const uniqueSuggestions = [...new Set(suggestions)].slice(0, 20);

    // Check for existing suggestions to avoid duplicates
    const { data: existingSuggestions } = await supabase
      .from('suggested_prompts')
      .select('text')
      .eq('org_id', orgId)
      .eq('accepted', false);

    const existingTexts = new Set(existingSuggestions?.map(s => s.text) || []);
    const newSuggestions = uniqueSuggestions.filter(text => !existingTexts.has(text));

    // If we have fewer than 5 new suggestions, clear old ones to make room for fresh content
    if (newSuggestions.length < 5 && existingSuggestions && existingSuggestions.length > 10) {
      console.log('Clearing old suggestions to make room for fresh content');
      await supabase
        .from('suggested_prompts')
        .delete()
        .eq('org_id', orgId)
        .eq('accepted', false);
      
      // Use all unique suggestions since we cleared the old ones
      const finalSuggestions = uniqueSuggestions;
      
      const insertData = finalSuggestions.map((text, index) => ({
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
        error: null,
        message: 'Refreshed suggestions with new content'
      };
    }

    // Insert only new suggestions
    if (newSuggestions.length > 0) {
      const insertData = newSuggestions.map((text, index) => ({
        org_id: orgId,
        text,
        source: getSourceForSuggestion(text, index < industryPrompts.length),
        accepted: false
      }));

      const { error: insertError } = await supabase
        .from('suggested_prompts')
        .insert(insertData);

      if (insertError) {
        console.error('Error inserting suggestions:', insertError);
        return { success: false, error: insertError.message, suggestionsCreated: 0 };
      }

      return { 
        success: true, 
        suggestionsCreated: insertData.length,
        error: null
      };
    }

    // No new suggestions to add
    return { 
      success: true, 
      suggestionsCreated: 0,
      error: null,
      message: 'No new suggestions to add - all current suggestions already exist'
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

function generateIndustryPrompts(industry: string, brandName: string, context?: any): string[] {
  const keywords = context?.keywords || [];
  const products = context?.products_services || '';
  const audience = context?.target_audience || '';
  const businessDesc = context?.business_description || '';
  
  // Generate keyword-specific prompts first
  const keywordPrompts: string[] = [];
  
  // Primary keyword-focused queries
  keywords.slice(0, 5).forEach((keyword: string) => {
    const cleanKeyword = keyword.toLowerCase();
    
    if (audience) {
      keywordPrompts.push(`Best ${cleanKeyword} software for ${audience}`);
      keywordPrompts.push(`${cleanKeyword} solution for ${audience} - recommendations?`);
    } else {
      keywordPrompts.push(`Best ${cleanKeyword} software for small businesses`);
      keywordPrompts.push(`${cleanKeyword} solution comparison 2024`);
    }
    
    keywordPrompts.push(`How to choose the right ${cleanKeyword} platform`);
    keywordPrompts.push(`${cleanKeyword} vs alternatives - which is better?`);
    keywordPrompts.push(`Looking for affordable ${cleanKeyword} tool under $100/month`);
  });

  // Industry + keyword combinations
  if (industry && keywords.length > 0) {
    keywords.slice(0, 3).forEach((keyword: string) => {
      keywordPrompts.push(`${keyword} for ${industry} companies`);
      keywordPrompts.push(`${industry} ${keyword} software recommendations`);
    });
  }

  // Product/service specific prompts
  if (products) {
    const productWords = products.toLowerCase().split(/[,\s]+/).filter(word => word.length > 3);
    productWords.slice(0, 3).forEach(product => {
      if (audience) {
        keywordPrompts.push(`${product} platform for ${audience}`);
      }
      keywordPrompts.push(`Best ${product} software solution`);
      keywordPrompts.push(`${product} tool comparison guide`);
    });
  }

  // Industry-specific base prompts (without brand names)
  const industryPrompts: Record<string, string[]> = {
    'technology': [
      'What\'s the most reliable project management tool for remote teams?',
      'Best CRM for tech startups under 50 employees?',
      'Looking for time tracking software that integrates with Slack',
      'Most secure password manager for small tech companies',
      'API documentation tool that\'s actually easy to use'
    ],
    'healthcare': [
      'HIPAA-compliant patient portal software recommendations',
      'Best EMR system for solo practitioners?',
      'Medical scheduling software that reduces no-shows',
      'Telehealth platform with good patient experience',
      'Practice management software for specialty clinics'
    ],
    'finance': [
      'Client portal software for financial advisors',
      'Best expense management tool for remote finance teams',
      'Trading platform with advanced analytics',
      'Secure payment processing for financial services',
      'Loan origination software for community banks'
    ],
    'retail': [
      'Multi-channel inventory management system',
      'Customer loyalty program that actually works',
      'E-commerce platform for fashion brands',
      'POS system with good offline capabilities',
      'Retail analytics dashboard for small chains'
    ],
    'education': [
      'Learning management system for K-12 schools',
      'Student engagement platform for online courses',
      'Gradebook software with parent portal access',
      'Virtual classroom tool with breakout rooms',
      'Plagiarism detection for academic institutions'
    ]
  };

  const basePrompts = industryPrompts[industry] || [
    `Professional ${industry} software recommendations`,
    `Best ${industry} platform for growing businesses`,
    `${industry} tool with strong customer support`,
    `Affordable ${industry} solution for small teams`,
    `${industry} software with mobile app access`
  ];

  // Combine and deduplicate
  const allPrompts = [...keywordPrompts, ...basePrompts];
  const uniquePrompts = [...new Set(allPrompts)];
  
  return uniquePrompts.slice(0, 12);
}

function generateCompetitorPrompts(brandName: string, domain: string, context?: any): string[] {
  const keywords = context?.keywords || [];
  const audience = context?.target_audience || '';
  const products = context?.products_services || '';
  
  const competitorPrompts: string[] = [];
  
  // Keyword-based comparison prompts (no brand names)
  keywords.slice(0, 4).forEach((keyword: string) => {
    const cleanKeyword = keyword.toLowerCase();
    
    competitorPrompts.push(`Top ${cleanKeyword} platforms comparison 2024`);
    competitorPrompts.push(`${cleanKeyword} software alternatives comparison`);
    competitorPrompts.push(`Which ${cleanKeyword} tool is most cost-effective?`);
    
    if (audience) {
      competitorPrompts.push(`${cleanKeyword} options for ${audience} - pros and cons`);
    }
  });

  // Product/service category comparisons
  if (products) {
    const productWords = products.toLowerCase().split(/[,\s]+/).filter(word => word.length > 3);
    productWords.slice(0, 3).forEach(product => {
      competitorPrompts.push(`${product} providers comparison chart`);
      competitorPrompts.push(`Best ${product} service for the price`);
    });
  }

  // Generic comparison prompts based on audience
  if (audience) {
    competitorPrompts.push(`Software comparison for ${audience}`);
    competitorPrompts.push(`Best value platforms for ${audience}`);
    competitorPrompts.push(`${audience} software reviews and comparisons`);
  }

  // Industry comparison prompts
  const industryComparisons = [
    'Market leaders vs emerging platforms in this space',
    'Enterprise vs small business solution comparison',
    'Open source vs commercial software options',
    'Cloud-based vs on-premise solutions comparison',
    'Budget-friendly alternatives to premium tools'
  ];

  const allPrompts = [...competitorPrompts, ...industryComparisons];
  const uniquePrompts = [...new Set(allPrompts)];
  
  return uniquePrompts.slice(0, 8);
}

function analyzeLowScoreResults(results: any[], brandName: string, context?: any): string[] {
  const keywords = context?.keywords || [];
  const audience = context?.target_audience || '';
  const products = context?.products_services || '';
  const lowScoreResults = results.filter(r => r.score < 3);
  
  if (lowScoreResults.length === 0) return [];
  
  // Generate visibility-focused prompts without brand names
  const visibilityPrompts: string[] = [];
  
  // Keyword-focused visibility queries
  keywords.slice(0, 3).forEach((keyword: string) => {
    const cleanKeyword = keyword.toLowerCase();
    
    if (audience) {
      visibilityPrompts.push(`Where to find reliable ${cleanKeyword} for ${audience}`);
      visibilityPrompts.push(`${cleanKeyword} recommendations for ${audience}`);
    }
    
    visibilityPrompts.push(`Hidden gems in ${cleanKeyword} software`);
    visibilityPrompts.push(`Underrated ${cleanKeyword} tools worth trying`);
    visibilityPrompts.push(`${cleanKeyword} solutions that actually work`);
  });

  // Product/service discovery prompts
  if (products) {
    const productWords = products.toLowerCase().split(/[,\s]+/).filter(word => word.length > 3);
    productWords.slice(0, 2).forEach(product => {
      visibilityPrompts.push(`Best kept secrets in ${product} software`);
      visibilityPrompts.push(`${product} tools that are worth the investment`);
    });
  }

  // Generic discovery and visibility prompts
  const discoveryPrompts = [
    'Lesser-known but powerful business tools',
    'Software solutions that punch above their weight',
    'Hidden alternatives to mainstream platforms',
    'Up-and-coming tools in this industry',
    'Software recommendations from industry insiders'
  ];

  if (audience) {
    discoveryPrompts.push(`Insider recommendations for ${audience}`);
    discoveryPrompts.push(`What tools do successful ${audience} actually use?`);
  }

  const allPrompts = [...visibilityPrompts, ...discoveryPrompts];
  const uniquePrompts = [...new Set(allPrompts)];
  
  return uniquePrompts.slice(0, 8);
}

async function generateTrendingPrompts(brandName: string, industry: string, apiKey: string, context?: any): Promise<string[]> {
  const keywords = context?.keywords || [];
  const products = context?.products_services || '';
  const audience = context?.target_audience || '';
  const businessDesc = context?.business_description || '';
  
  // Build enhanced context for AI
  let contextPrompt = `Generate 8 realistic search queries for ${industry} solutions in 2024`;
  
  if (businessDesc) {
    contextPrompt += ` (Business: ${businessDesc})`;
  }
  
  if (keywords.length > 0) {
    contextPrompt += `. Key areas: ${keywords.slice(0, 3).join(', ')}`;
  }
  
  if (products) {
    contextPrompt += `. Main offerings: ${products.slice(0, 100)}`;
  }
  
  if (audience) {
    contextPrompt += `. Target audience: ${audience.slice(0, 100)}`;
  }
  
  const prompt = `${contextPrompt}. Make them conversational and natural, like real user questions that potential customers would search for. NEVER mention specific brand names. Examples:
- "What's the best [solution] for [specific use case]?"
- "I'm looking for [tool] that [specific need]"  
- "Should I switch from [current solution type] to [new solution type]?"
- "Affordable [solution category] for [audience type]"
- "Looking for [solution] under $X per month"
- "[Solution type] with [specific feature] - recommendations?"

Make them specific, problem-focused, and conversational. Focus on buyer intent and pain points. Use the keywords and business context provided but never include specific company or brand names. Return only search queries, one per line.`;

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
      max_tokens: 500,
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
    .filter((line: string) => line.length > 0 && !line.match(/^\d+\.?\s*/) && line.length < 120)
    .slice(0, 8);
}

function getSourceForSuggestion(text: string, isIndustry: boolean): string {
  if (text.includes('vs') || text.includes('alternatives') || text.includes('competitors')) return 'competitors';
  if (text.includes('trends') || text.includes('2024') || text.includes('innovations')) return 'trends';
  if (isIndustry) return 'industry';
  return 'gap';
}