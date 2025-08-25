import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AnalysisResult {
  orgBrands: string[];
  competitors: string[];
  brandPresent: boolean;
  brandPosition: number | null;
  score: number;
  confidence: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { promptText, provider, orgId, promptId } = await req.json();
    
    console.log(`=== EXECUTE PROMPT START ===`);
    console.log(`Provider: ${provider}`);
    console.log(`OrgId: ${orgId}`);
    console.log(`PromptId: ${promptId}`);

    if (!promptText || !provider) {
      return new Response(
        JSON.stringify({ error: 'Missing promptText or provider' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Execute prompt with provider
    let result;
    let model = '';
    
    try {
      switch (provider.toLowerCase()) {
        case 'openai':
          console.log('Executing with OpenAI...');
          result = await executeOpenAI(promptText);
          model = 'gpt-4o-mini';
          break;
        case 'perplexity':
          console.log('Executing with Perplexity...');
          result = await executePerplexity(promptText);
          model = 'sonar';
          break;
        case 'gemini':
          console.log('Executing with Gemini...');
          result = await executeGemini(promptText);
          model = result.model || 'gemini-2.5-flash-lite';
          break;
        default:
          throw new Error(`Unknown provider: ${provider}`);
      }

      console.log(`${provider} execution successful:`, { 
        responseLength: result.responseText.length,
        tokenIn: result.tokenIn, 
        tokenOut: result.tokenOut
      });

    } catch (providerError: any) {
      console.error(`${provider} execution failed:`, providerError.message);
      
      // Insert error record
      if (orgId && promptId) {
        await supabase
          .from('prompt_provider_responses')
          .insert({
            org_id: orgId,
            prompt_id: promptId,
            provider: provider.toLowerCase(),
            model,
            status: 'error',
            error: providerError.message,
            token_in: 0,
            token_out: 0,
            brands_json: [],
            org_brand_present: false,
            competitors_json: [],
            competitors_count: 0,
            score: 0,
            raw_ai_response: ''
          });
      }
      throw providerError;
    }

    // NEW ANALYSIS SYSTEM - Analyze the actual response
    let analysis: AnalysisResult = {
      orgBrands: [],
      competitors: [],
      brandPresent: false,
      brandPosition: null,
      score: 0,
      confidence: 0.5
    };

    if (orgId && result.responseText) {
      console.log('Starting NEW response analysis...');
      analysis = await analyzeResponse(supabase, result.responseText, orgId);
      console.log('Analysis complete:', analysis);
    }

    // Insert results into database
    let responseId: string | null = null;
    
    if (orgId && promptId) {
      const { data: responseRecord, error: insertError } = await supabase
        .from('prompt_provider_responses')
        .insert({
          org_id: orgId,
          prompt_id: promptId,
          provider: provider.toLowerCase(),
          model,
          status: 'success',
          token_in: result.tokenIn || 0,
          token_out: result.tokenOut || 0,
          raw_ai_response: result.responseText,
          brands_json: analysis.orgBrands,
          org_brand_present: analysis.brandPresent,
          org_brand_prominence: analysis.brandPosition,
          competitors_json: analysis.competitors,
          competitors_count: analysis.competitors.length,
          score: analysis.score,
          metadata: {
            analysisConfidence: analysis.confidence,
            extractionMethod: 'new-analysis-v1',
            processingTime: 0
          }
        })
        .select()
        .single();

      if (insertError) {
        console.error('Failed to insert response:', insertError);
      } else if (responseRecord) {
        responseId = responseRecord.id;
        console.log('Successfully inserted response record:', responseId);
        
        // Persist competitor data for analytics
        await persistCompetitorData(supabase, orgId, promptId, analysis);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        responseId,
        responseText: result.responseText,
        brands: analysis.orgBrands,
        orgBrands: analysis.orgBrands,
        competitors: analysis.competitors,
        orgBrandPresent: analysis.brandPresent,
        orgBrandPosition: analysis.brandPosition,
        competitorCount: analysis.competitors.length,
        score: analysis.score,
        tokenIn: result.tokenIn || 0,
        tokenOut: result.tokenOut || 0,
        model,
        confidence: analysis.confidence
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('=== EXECUTE PROMPT ERROR ===', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * NEW ANALYSIS SYSTEM - Clean, effective response analysis
 */
async function analyzeResponse(supabase: any, responseText: string, orgId: string): Promise<AnalysisResult> {
  console.log('=== NEW ANALYSIS START ===');
  
  // Step 1: Get organization context
  const [orgResult, brandCatalogResult] = await Promise.all([
    supabase
      .from('organizations')
      .select('name, domain, business_description, keywords')
      .eq('id', orgId)
      .single(),
    supabase
      .from('brand_catalog')
      .select('name, variants_json, is_org_brand')
      .eq('org_id', orgId)
  ]);

  const org = orgResult.data;
  const brandCatalog = brandCatalogResult.data || [];
  
  if (!org) {
    console.error('No organization found');
    return {
      orgBrands: [],
      competitors: [],
      brandPresent: false,
      brandPosition: null,
      score: 0,
      confidence: 0.1
    };
  }

  console.log('Organization:', org.name, org.domain);
  console.log('Brand catalog entries:', brandCatalog.length);

  // Step 2: Build comprehensive brand variants
  const orgBrandVariants = buildBrandVariants(org, brandCatalog);
  console.log('Org brand variants:', orgBrandVariants);

  // Step 3: Detect organization brands in response
  const detectedOrgBrands = detectBrands(responseText, orgBrandVariants);
  console.log('Detected org brands:', detectedOrgBrands);

  // Step 4: Extract potential competitors
  const potentialCompetitors = extractCompetitors(responseText);
  console.log('Potential competitors extracted:', potentialCompetitors.length);

  // Step 5: Filter competitors using industry context
  const validCompetitors = filterCompetitors(potentialCompetitors, org, orgBrandVariants);
  console.log('Valid competitors after filtering:', validCompetitors);

  // Step 6: Calculate position and score
  const brandPresent = detectedOrgBrands.brands.length > 0;
  const brandPosition = brandPresent ? detectedOrgBrands.firstPosition : null;
  const score = calculateScore(brandPresent, brandPosition, validCompetitors.length, responseText.length);

  console.log('=== ANALYSIS RESULTS ===');
  console.log('Brand present:', brandPresent);
  console.log('Brand position:', brandPosition);
  console.log('Competitors:', validCompetitors.length);
  console.log('Score:', score);

  return {
    orgBrands: detectedOrgBrands.brands,
    competitors: validCompetitors,
    brandPresent,
    brandPosition,
    score,
    confidence: 0.9
  };
}

/**
 * Build comprehensive brand variants from org data and catalog
 */
function buildBrandVariants(org: any, brandCatalog: any[]): string[] {
  const variants = new Set<string>();
  
  // Add organization name and domain variants
  if (org.name) {
    variants.add(org.name);
    
    // Add common business suffixes
    const baseName = org.name.replace(/\s+(inc|llc|corp|ltd|limited|company)$/i, '').trim();
    variants.add(baseName);
    
    // Add domain-based variants
    if (org.domain) {
      const domainBase = org.domain.replace(/\..*$/, '');
      variants.add(domainBase);
      variants.add(org.domain);
      
      // Special handling for common patterns
      if (domainBase.toLowerCase() === 'hubspot') {
        variants.add('HubSpot');
        variants.add('HubSpot Marketing Hub');
        variants.add('Marketing Hub');
        variants.add('HubSpot CRM');
        variants.add('HubSpot Marketing Automation');
      }
    }
  }

  // Add catalog variants
  brandCatalog
    .filter(brand => brand.is_org_brand)
    .forEach(brand => {
      variants.add(brand.name);
      if (brand.variants_json && Array.isArray(brand.variants_json)) {
        brand.variants_json.forEach(variant => variants.add(variant));
      }
    });

  return Array.from(variants).filter(v => v && v.length > 1);
}

/**
 * Detect organization brands in response text
 */
function detectBrands(text: string, brandVariants: string[]): { brands: string[], firstPosition: number | null } {
  const detectedBrands = new Set<string>();
  let firstPosition: number | null = null;
  
  // Sort variants by length (longest first) for better matching
  const sortedVariants = brandVariants.sort((a, b) => b.length - a.length);
  
  for (const variant of sortedVariants) {
    const regex = new RegExp(`\\b${variant.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    const matches = Array.from(text.matchAll(regex));
    
    if (matches.length > 0) {
      detectedBrands.add(variant);
      
      // Track first position
      const position = matches[0].index!;
      if (firstPosition === null || position < firstPosition) {
        firstPosition = position;
      }
      
      console.log(`Found brand "${variant}" at position ${position}`);
    }
  }
  
  return {
    brands: Array.from(detectedBrands),
    firstPosition
  };
}

/**
 * Extract potential competitor names from response text
 */
function extractCompetitors(text: string): string[] {
  const competitors = new Set<string>();
  
  // Pattern 1: Two-word business names
  const businessPatterns = [
    /\b[A-Z][a-z]+ (?:Analytics|Marketing|Cloud|Hub|Platform|Suite|Pro|Studio|Labs|Works|Systems|Solutions|CRM|Insights|Manager|Central|Express|Business|Enterprise|Software|Tools|App)\b/g,
    /\b[A-Z][a-z]{2,}\.(?:com|io|net|org|ai|co|app)\b/g,
    /\b[A-Z][a-z]*[A-Z][a-zA-Z]+\b/g
  ];
  
  for (const pattern of businessPatterns) {
    const matches = text.match(pattern) || [];
    matches.forEach(match => {
      if (match.length > 3 && match.length < 50) {
        competitors.add(match.trim());
      }
    });
  }
  
  // Pattern 2: Known marketing/business brands
  const knownBrands = [
    'Salesforce', 'Marketo', 'Pardot', 'Mailchimp', 'Klaviyo', 'ConvertKit', 
    'ActiveCampaign', 'Drip', 'Hootsuite', 'Buffer', 'Sprout Social', 'CoSchedule',
    'Later', 'Canva', 'Adobe', 'Google Analytics', 'Facebook', 'LinkedIn',
    'Twitter', 'Instagram', 'YouTube', 'TikTok', 'Pinterest', 'Snapchat'
  ];
  
  for (const brand of knownBrands) {
    const regex = new RegExp(`\\b${brand}\\b`, 'gi');
    if (regex.test(text)) {
      competitors.add(brand);
    }
  }
  
  return Array.from(competitors);
}

/**
 * Filter competitors to remove false positives and irrelevant matches
 */
function filterCompetitors(competitors: string[], org: any, orgBrandVariants: string[]): string[] {
  const filtered = competitors.filter(competitor => {
    const lower = competitor.toLowerCase();
    
    // Remove if it matches org brand
    if (orgBrandVariants.some(variant => 
      lower.includes(variant.toLowerCase()) || variant.toLowerCase().includes(lower)
    )) {
      console.log(`Filtered out org brand: ${competitor}`);
      return false;
    }
    
    // Remove generic terms
    const genericTerms = [
      'social media', 'email marketing', 'content marketing', 'digital marketing',
      'search engine', 'content management', 'customer relationship', 'project management',
      'automation', 'analytics', 'insights', 'dashboard', 'platform', 'software',
      'marketing', 'advertising', 'campaign', 'strategy', 'optimization', 'tracking'
    ];
    
    if (genericTerms.some(term => lower === term || lower.includes(term) && competitor.length < 20)) {
      console.log(`Filtered out generic term: ${competitor}`);
      return false;
    }
    
    // Remove common words
    const commonWords = [
      'social', 'media', 'email', 'content', 'digital', 'online', 'web', 'mobile',
      'data', 'analytics', 'insights', 'marketing', 'advertising', 'campaign',
      'business', 'enterprise', 'solution', 'service', 'platform', 'software',
      'system', 'tool', 'app', 'website', 'site', 'page', 'blog', 'post'
    ];
    
    if (commonWords.includes(lower)) {
      console.log(`Filtered out common word: ${competitor}`);
      return false;
    }
    
    // Keep if length is reasonable and has business context
    return competitor.length >= 3 && competitor.length <= 40;
  });
  
  // Limit to top 20 to prevent noise
  return filtered.slice(0, 20);
}

/**
 * Calculate visibility score based on brand presence, position, and competition
 */
function calculateScore(brandPresent: boolean, brandPosition: number | null, competitorCount: number, responseLength: number): number {
  let score = 0;
  
  if (brandPresent) {
    // Base score for brand presence
    score = 6;
    
    // Position bonus (earlier = better)
    if (brandPosition !== null) {
      const relativePosition = brandPosition / responseLength;
      if (relativePosition < 0.1) score += 2; // Very early
      else if (relativePosition < 0.3) score += 1; // Early
      else if (relativePosition < 0.5) score += 0.5; // Middle
      // No bonus for late mentions
    }
    
    // Competition penalty
    const competitionPenalty = Math.min(2, competitorCount * 0.2);
    score -= competitionPenalty;
    
    // Ensure minimum score if brand is present
    score = Math.max(3, score);
  } else {
    // No brand presence - score based on competition level
    score = Math.max(0, 2 - (competitorCount * 0.1));
  }
  
  return Math.round(Math.min(10, Math.max(0, score)) * 10) / 10;
}

/**
 * Persist competitor data for analytics and insights
 */
async function persistCompetitorData(supabase: any, orgId: string, promptId: string, analysis: AnalysisResult) {
  console.log('Persisting competitor data...');
  
  try {
    // Update brand catalog
    for (const competitor of analysis.competitors) {
      await supabase.rpc('upsert_competitor_brand', {
        p_org_id: orgId,
        p_brand_name: competitor,
        p_score: analysis.score || 0
      });
    }
    
    // Update competitor mentions
    for (const competitor of analysis.competitors) {
      await supabase.rpc('upsert_competitor_mention', {
        p_org_id: orgId,
        p_prompt_id: promptId,
        p_competitor_name: competitor,
        p_normalized_name: competitor.toLowerCase().trim(),
        p_position: null,
        p_sentiment: 'neutral'
      });
    }
    
    console.log('Competitor data persisted successfully');
  } catch (error) {
    console.error('Error persisting competitor data:', error);
  }
}

// Provider execution functions (keep existing implementations)
async function executeOpenAI(promptText: string) {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) throw new Error('OpenAI API key not configured');

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: promptText
        }
      ],
      max_tokens: 2000,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  const responseText = data.choices[0]?.message?.content || '';
  
  return {
    responseText,
    tokenIn: data.usage?.prompt_tokens || 0,
    tokenOut: data.usage?.completion_tokens || 0,
  };
}

async function executePerplexity(promptText: string) {
  const apiKey = Deno.env.get('PERPLEXITY_API_KEY');
  if (!apiKey) throw new Error('Perplexity API key not configured');

  const response = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.1-sonar-small-128k-online',
      messages: [
        {
          role: 'user',
          content: promptText
        }
      ],
      max_tokens: 1000,
      temperature: 0.2,
      top_p: 0.9,
      return_images: false,
      return_related_questions: false,
      search_recency_filter: 'month',
      frequency_penalty: 1
    }),
  });

  if (!response.ok) {
    throw new Error(`Perplexity API error: ${response.status}`);
  }

  const data = await response.json();
  const responseText = data.choices[0]?.message?.content || '';
  
  return {
    responseText,
    tokenIn: data.usage?.prompt_tokens || 0,
    tokenOut: data.usage?.completion_tokens || 0,
  };
}

async function executeGemini(promptText: string) {
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) throw new Error('Gemini API key not configured');

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{
        parts: [{
          text: promptText
        }]
      }],
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 2048,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const data = await response.json();
  const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  
  return {
    responseText,
    model: 'gemini-2.0-flash-exp',
    tokenIn: data.usageMetadata?.promptTokenCount || 0,
    tokenOut: data.usageMetadata?.candidatesTokenCount || 0,
  };
}
