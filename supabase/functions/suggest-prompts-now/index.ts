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
  
  // Generate specific, buyer-intent focused prompts based on keywords
  const keywordPrompts: string[] = [];
  
  // Primary keyword-focused queries (matching the reference style)
  keywords.slice(0, 4).forEach((keyword: string) => {
    const cleanKeyword = keyword.toLowerCase();
    
    // Comparison and evaluation prompts
    keywordPrompts.push(`Compare ${cleanKeyword} software pricing and plans for small businesses`);
    keywordPrompts.push(`Best free ${cleanKeyword} tools for ${audience || 'startups'}`);
    keywordPrompts.push(`Top ${cleanKeyword} platforms with customizable workflows`);
    keywordPrompts.push(`${cleanKeyword} software comparison for ${audience || 'growing companies'}`);
    
    // Feature-specific prompts
    keywordPrompts.push(`Which ${cleanKeyword} platform integrates seamlessly with popular tools?`);
    keywordPrompts.push(`${cleanKeyword} solutions with AI-driven features`);
    keywordPrompts.push(`User ratings for top ${cleanKeyword} software solutions`);
    
    // Problem-solving prompts
    keywordPrompts.push(`Where to find affordable ${cleanKeyword} solutions`);
    keywordPrompts.push(`${cleanKeyword} platforms for remote teams under 50 employees`);
  });

  // Product/service specific prompts matching the reference format
  if (products) {
    const productWords = products.toLowerCase().split(/[,\s]+/).filter(word => word.length > 3);
    productWords.slice(0, 3).forEach(product => {
      keywordPrompts.push(`Compare key features of leading ${product} software`);
      keywordPrompts.push(`${product} tools with advanced analytics and reporting`);
      keywordPrompts.push(`User reviews comparing ${product} vs traditional solutions`);
      if (audience) {
        keywordPrompts.push(`${product} software comparison for ${audience}`);
      }
    });
  }

  // Industry-specific templates matching the reference style
  const industryTemplates: Record<string, string[]> = {
    'technology': [
      'Best project management tools with API integrations for developers',
      'Compare code repository platforms for enterprise teams',
      'DevOps tools with built-in security scanning features',
      'Cloud hosting providers with automatic scaling capabilities',
      'User ratings for top developer productivity software'
    ],
    'healthcare': [
      'HIPAA-compliant patient portal software with mobile access',
      'Compare EMR systems pricing for solo practitioners',
      'Medical billing platforms with insurance claim automation',
      'Telehealth solutions with prescription management features',
      'Practice management software comparison for specialty clinics'
    ],
    'finance': [
      'Compare wealth management platforms for independent advisors',
      'Trading software with advanced charting and analysis tools',
      'Payment processing solutions with fraud protection features',
      'Accounting software comparison for financial services firms',
      'Client portal platforms with document sharing capabilities'
    ],
    'retail': [
      'Multi-channel inventory management systems with real-time sync',
      'POS systems with integrated loyalty program features',
      'E-commerce platforms comparison for fashion retailers',
      'Customer analytics tools with behavioral tracking',
      'Supply chain management software for retail chains'
    ],
    'education': [
      'Learning management systems with interactive content creation',
      'Student information systems with parent portal access',
      'Online course platforms with certification management',
      'Virtual classroom tools with breakout room capabilities',
      'Gradebook software comparison for K-12 schools'
    ]
  };

  const industryPrompts = industryTemplates[industry] || [
    `Compare ${industry} software solutions for mid-size companies`,
    `Best ${industry} platforms with mobile app access`,
    `${industry} tools with advanced reporting and analytics`,
    `User reviews for leading ${industry} software providers`,
    `${industry} solutions with third-party integrations`
  ];

  // Combine all prompts
  const allPrompts = [...keywordPrompts, ...industryPrompts];
  const uniquePrompts = [...new Set(allPrompts)];
  
  return uniquePrompts.slice(0, 15);
}


function generateCompetitorPrompts(brandName: string, domain: string, context?: any): string[] {
  const keywords = context?.keywords || [];
  const audience = context?.target_audience || '';
  const products = context?.products_services || '';
  
  const competitorPrompts: string[] = [];
  
  // Keyword-based comparison prompts matching reference style
  keywords.slice(0, 3).forEach((keyword: string) => {
    const cleanKeyword = keyword.toLowerCase();
    
    competitorPrompts.push(`Compare key features of leading ${cleanKeyword} software`);
    competitorPrompts.push(`User ratings for top ${cleanKeyword} solutions`);
    competitorPrompts.push(`${cleanKeyword} platforms with best customer support ratings`);
    competitorPrompts.push(`Which ${cleanKeyword} tool offers the best value for money?`);
    
    if (audience) {
      competitorPrompts.push(`${cleanKeyword} software comparison for ${audience}`);
      competitorPrompts.push(`User reviews: ${cleanKeyword} tools for ${audience}`);
    }
  });

  // Product/service category comparisons in reference style
  if (products) {
    const productWords = products.toLowerCase().split(/[,\s]+/).filter(word => word.length > 3);
    productWords.slice(0, 2).forEach(product => {
      competitorPrompts.push(`Compare ${product} providers: features and pricing`);
      competitorPrompts.push(`User reviews comparing ${product} vs traditional solutions`);
      competitorPrompts.push(`${product} software with highest user satisfaction ratings`);
    });
  }

  // Generic comparison prompts based on audience/industry
  const genericComparisons = [
    'Software comparison: enterprise vs small business solutions',
    'Cloud-based vs on-premise platform comparison',
    'User ratings for industry-leading software providers',
    'Compare pricing models: subscription vs one-time purchase',
    'Platform integration capabilities comparison chart'
  ];

  if (audience) {
    genericComparisons.push(`Software recommendations based on ${audience} reviews`);
    genericComparisons.push(`Compare solutions designed specifically for ${audience}`);
  }

  const allPrompts = [...competitorPrompts, ...genericComparisons];
  const uniquePrompts = [...new Set(allPrompts)];
  
  return uniquePrompts.slice(0, 10);
}

function analyzeLowScoreResults(results: any[], brandName: string, context?: any): string[] {
  const keywords = context?.keywords || [];
  const audience = context?.target_audience || '';
  const products = context?.products_services || '';
  const lowScoreResults = results.filter(r => r.score < 3);
  
  if (lowScoreResults.length === 0) return [];
  
  // Generate discovery-focused prompts in reference style
  const discoveryPrompts: string[] = [];
  
  // Keyword-focused discovery queries matching the reference format
  keywords.slice(0, 3).forEach((keyword: string) => {
    const cleanKeyword = keyword.toLowerCase();
    
    discoveryPrompts.push(`Where to find reliable ${cleanKeyword} solutions for small businesses`);
    discoveryPrompts.push(`User ratings for lesser-known ${cleanKeyword} platforms`);
    discoveryPrompts.push(`${cleanKeyword} tools with exceptional customer support`);
    
    if (audience) {
      discoveryPrompts.push(`${cleanKeyword} recommendations from ${audience} users`);
      discoveryPrompts.push(`Best ${cleanKeyword} solutions for ${audience} on a budget`);
    }
  });

  // Product/service discovery prompts
  if (products) {
    const productWords = products.toLowerCase().split(/[,\s]+/).filter(word => word.length > 3);
    productWords.slice(0, 2).forEach(product => {
      discoveryPrompts.push(`Compare emerging ${product} platforms vs established players`);
      discoveryPrompts.push(`${product} software with unique features and capabilities`);
      discoveryPrompts.push(`User reviews: hidden gems in ${product} solutions`);
    });
  }

  // Generic discovery prompts in the reference style
  const genericDiscovery = [
    'User ratings for up-and-coming software platforms',
    'Compare new vs established players in the software market',
    'Software solutions with exceptional value for small businesses',
    'Platform recommendations from industry professionals',
    'Tools with best customer satisfaction ratings in the industry'
  ];

  if (audience) {
    genericDiscovery.push(`Software recommendations specifically for ${audience}`);
    genericDiscovery.push(`User reviews: best tools for ${audience} workflows`);
  }

  const allPrompts = [...discoveryPrompts, ...genericDiscovery];
  const uniquePrompts = [...new Set(allPrompts)];
  
  return uniquePrompts.slice(0, 10);
}

async function generateTrendingPrompts(brandName: string, industry: string, apiKey: string, context?: any): Promise<string[]> {
  const keywords = context?.keywords || [];
  const products = context?.products_services || '';
  const audience = context?.target_audience || '';
  const businessDesc = context?.business_description || '';
  
  // Build enhanced context for AI with reference style examples
  let contextPrompt = `Generate 8 realistic, specific search queries for ${industry} solutions in 2024`;
  
  if (businessDesc) {
    contextPrompt += ` (Business focus: ${businessDesc})`;
  }
  
  if (keywords.length > 0) {
    contextPrompt += `. Key solution areas: ${keywords.slice(0, 3).join(', ')}`;
  }
  
  if (products) {
    contextPrompt += `. Main offerings: ${products.slice(0, 100)}`;
  }
  
  if (audience) {
    contextPrompt += `. Target audience: ${audience.slice(0, 100)}`;
  }
  
  const prompt = `${contextPrompt}. Make them specific, buyer-intent focused queries that match this style:
- "Compare [solution] software pricing and plans for small businesses"
- "Best free [tool] tools for [audience]"
- "User ratings for top [solution] software solutions"
- "Which [platform] integrates seamlessly with popular tools?"
- "[Solution] platforms with AI-driven features"
- "Where to find affordable [solution] for [audience]"
- "Compare key features of leading [tool] software"
- "User reviews comparing [solution] vs traditional approaches"

Focus on comparisons, ratings, features, pricing, and integrations. Make them sound like real buyer research queries. Never include specific company or brand names. Return only search queries, one per line.`;

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