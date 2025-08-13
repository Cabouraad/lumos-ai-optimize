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
  
  // If no business context provided, return empty to avoid generic suggestions
  if (keywords.length === 0 && !products && !audience && !businessDesc) {
    return [];
  }
  
  const keywordPrompts: string[] = [];
  
  // Primary keyword-focused queries - ONLY use actual user keywords
  keywords.forEach((keyword: string) => {
    const cleanKeyword = keyword.toLowerCase().trim();
    if (!cleanKeyword) return;
    
    // Target audience specific prompts
    if (audience) {
      const cleanAudience = audience.toLowerCase().trim();
      keywordPrompts.push(`Best ${cleanKeyword} solutions for ${cleanAudience}`);
      keywordPrompts.push(`${cleanKeyword} software comparison for ${cleanAudience}`);
      keywordPrompts.push(`Top rated ${cleanKeyword} platforms used by ${cleanAudience}`);
      keywordPrompts.push(`${cleanKeyword} tools with features designed for ${cleanAudience}`);
    } else {
      keywordPrompts.push(`Compare top ${cleanKeyword} software options`);
      keywordPrompts.push(`Best ${cleanKeyword} platforms with highest user ratings`);
      keywordPrompts.push(`${cleanKeyword} solutions with advanced features`);
    }
    
    // Pricing and evaluation prompts
    keywordPrompts.push(`${cleanKeyword} software pricing comparison and reviews`);
    keywordPrompts.push(`Which ${cleanKeyword} platform offers the best value?`);
    keywordPrompts.push(`Free vs paid ${cleanKeyword} tools comparison`);
    
    // Feature-specific prompts
    keywordPrompts.push(`${cleanKeyword} platforms with integration capabilities`);
    keywordPrompts.push(`User reviews: best ${cleanKeyword} software features`);
  });

  // Product/service specific prompts - ONLY use actual user products/services
  if (products) {
    const productWords = products.toLowerCase()
      .split(/[,\s&+]+/)
      .map(word => word.trim())
      .filter(word => word.length > 2);
    
    productWords.forEach(product => {
      if (audience) {
        keywordPrompts.push(`${product} solutions comparison for ${audience.toLowerCase()}`);
        keywordPrompts.push(`Best ${product} providers recommended by ${audience.toLowerCase()}`);
      } else {
        keywordPrompts.push(`Compare leading ${product} providers and features`);
        keywordPrompts.push(`${product} software with highest customer satisfaction`);
      }
      keywordPrompts.push(`${product} pricing models and cost comparison`);
      keywordPrompts.push(`User reviews: top ${product} platforms`);
    });
  }

  // Business description specific prompts - extract key terms from description
  if (businessDesc) {
    const businessWords = businessDesc.toLowerCase()
      .match(/\b(software|platform|tool|service|solution|system|app|technology)\w*\b/g) || [];
    
    businessWords.slice(0, 2).forEach(term => {
      if (audience) {
        keywordPrompts.push(`Best ${term} for ${audience.toLowerCase()} businesses`);
      } else {
        keywordPrompts.push(`Compare ${term} options for growing businesses`);
      }
    });
  }

  // Remove duplicates and limit
  const uniquePrompts = [...new Set(keywordPrompts)];
  return uniquePrompts.slice(0, 12);
}


function generateCompetitorPrompts(brandName: string, domain: string, context?: any): string[] {
  const keywords = context?.keywords || [];
  const audience = context?.target_audience || '';
  const products = context?.products_services || '';
  
  // If no business context provided, return empty to avoid generic suggestions
  if (keywords.length === 0 && !products && !audience) {
    return [];
  }
  
  const competitorPrompts: string[] = [];
  
  // Keyword-based comparison prompts - ONLY use actual user keywords
  keywords.forEach((keyword: string) => {
    const cleanKeyword = keyword.toLowerCase().trim();
    if (!cleanKeyword) return;
    
    competitorPrompts.push(`Compare leading ${cleanKeyword} software providers`);
    competitorPrompts.push(`${cleanKeyword} platforms: user ratings and reviews`);
    competitorPrompts.push(`Which ${cleanKeyword} solution has the best features?`);
    competitorPrompts.push(`${cleanKeyword} software: pricing and value comparison`);
    
    if (audience) {
      const cleanAudience = audience.toLowerCase().trim();
      competitorPrompts.push(`${cleanKeyword} recommendations from ${cleanAudience}`);
      competitorPrompts.push(`Best ${cleanKeyword} tools for ${cleanAudience} according to reviews`);
    }
  });

  // Product/service category comparisons - ONLY use actual user products/services
  if (products) {
    const productWords = products.toLowerCase()
      .split(/[,\s&+]+/)
      .map(word => word.trim())
      .filter(word => word.length > 2);
    
    productWords.forEach(product => {
      competitorPrompts.push(`${product} provider comparison: features vs pricing`);
      competitorPrompts.push(`User reviews: top ${product} companies ranked`);
      competitorPrompts.push(`${product} market leaders vs emerging competitors`);
      
      if (audience) {
        competitorPrompts.push(`${product} providers highly rated by ${audience.toLowerCase()}`);
      }
    });
  }

  // Audience-specific comparison prompts - ONLY if audience is specified
  if (audience) {
    const cleanAudience = audience.toLowerCase().trim();
    if (keywords.length > 0) {
      const primaryKeyword = keywords[0].toLowerCase();
      competitorPrompts.push(`${primaryKeyword} solutions comparison by ${cleanAudience} users`);
      competitorPrompts.push(`Most recommended ${primaryKeyword} platforms for ${cleanAudience}`);
    }
  }

  // Remove duplicates and limit
  const uniquePrompts = [...new Set(competitorPrompts)];
  return uniquePrompts.slice(0, 8);
}

function analyzeLowScoreResults(results: any[], brandName: string, context?: any): string[] {
  const keywords = context?.keywords || [];
  const audience = context?.target_audience || '';
  const products = context?.products_services || '';
  const lowScoreResults = results.filter(r => r.score < 3);
  
  if (lowScoreResults.length === 0) return [];
  
  // If no business context provided, return empty to avoid generic suggestions
  if (keywords.length === 0 && !products && !audience) {
    return [];
  }
  
  const discoveryPrompts: string[] = [];
  
  // Keyword-focused discovery queries - ONLY use actual user keywords
  keywords.forEach((keyword: string) => {
    const cleanKeyword = keyword.toLowerCase().trim();
    if (!cleanKeyword) return;
    
    discoveryPrompts.push(`Alternative ${cleanKeyword} solutions with unique features`);
    discoveryPrompts.push(`${cleanKeyword} platforms with excellent customer reviews`);
    discoveryPrompts.push(`Affordable ${cleanKeyword} tools with premium features`);
    
    if (audience) {
      const cleanAudience = audience.toLowerCase().trim();
      discoveryPrompts.push(`${cleanKeyword} solutions highly rated by ${cleanAudience}`);
      discoveryPrompts.push(`Budget-friendly ${cleanKeyword} options for ${cleanAudience}`);
    }
  });

  // Product/service discovery prompts - ONLY use actual user products/services
  if (products) {
    const productWords = products.toLowerCase()
      .split(/[,\s&+]+/)
      .map(word => word.trim())
      .filter(word => word.length > 2);
    
    productWords.forEach(product => {
      discoveryPrompts.push(`Innovative ${product} companies with strong user ratings`);
      discoveryPrompts.push(`${product} providers offering exceptional value`);
      
      if (audience) {
        discoveryPrompts.push(`${product} solutions preferred by ${audience.toLowerCase()}`);
      }
    });
  }

  // Brand visibility improvement prompts based on actual context
  if (keywords.length > 0 && audience) {
    const primaryKeyword = keywords[0].toLowerCase();
    const cleanAudience = audience.toLowerCase();
    discoveryPrompts.push(`${primaryKeyword} tools that ${cleanAudience} actually recommend`);
    discoveryPrompts.push(`Most trusted ${primaryKeyword} platforms among ${cleanAudience}`);
  }

  // Remove duplicates and limit
  const uniquePrompts = [...new Set(discoveryPrompts)];
  return uniquePrompts.slice(0, 6);
}

async function generateTrendingPrompts(brandName: string, industry: string, apiKey: string, context?: any): Promise<string[]> {
  const keywords = context?.keywords || [];
  const products = context?.products_services || '';
  const audience = context?.target_audience || '';
  const businessDesc = context?.business_description || '';
  
  // If no business context provided, return empty to avoid generic AI suggestions
  if (keywords.length === 0 && !products && !audience && !businessDesc) {
    return [];
  }
  
  // Build highly specific context based on actual business data
  let contextPrompt = 'Generate 6 specific search queries based on this business context:';
  
  if (businessDesc) {
    contextPrompt += ` Business: "${businessDesc}"`;
  }
  
  if (keywords.length > 0) {
    contextPrompt += ` Keywords: ${keywords.join(', ')}`;
  }
  
  if (products) {
    contextPrompt += ` Products/Services: ${products}`;
  }
  
  if (audience) {
    contextPrompt += ` Target Audience: ${audience}`;
  }
  
  const prompt = `${contextPrompt}

Create buyer-intent search queries that combine these specific business elements. Use this format:
- "Compare [keyword] software for [audience]"  
- "Best [product/service] platforms with [specific feature]"
- "[keyword] solutions: pricing and reviews"
- "User ratings for [keyword] tools designed for [audience]"
- "Which [product] offers the best value for [audience]?"
- "[keyword] software comparison: features vs cost"

IMPORTANT: Only use the exact keywords, products, services, and audience provided above. Do not add generic industry terms or make assumptions. Each query must contain elements from the business context provided. Return only search queries, one per line.`;

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
          content: 'You are an expert at generating targeted search queries. You must only use the specific business context provided - never add generic terms or make assumptions about the business.' 
        },
        { role: 'user', content: prompt }
      ],
      max_tokens: 400,
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
    .filter((line: string) => line.length > 0 && !line.match(/^\d+\.?\s*/) && line.length < 120)
    .slice(0, 6);
}

function getSourceForSuggestion(text: string, isIndustry: boolean): string {
  if (text.includes('vs') || text.includes('alternatives') || text.includes('competitors')) return 'competitors';
  if (text.includes('trends') || text.includes('2024') || text.includes('innovations')) return 'trends';
  if (isIndustry) return 'industry';
  return 'gap';
}