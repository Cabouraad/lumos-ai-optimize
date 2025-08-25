
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

import { analyzeBrands, BrandAnalysisResult } from './enhanced-brand-analyzer.ts';

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
    console.log(`Prompt length: ${promptText?.length}`);

    if (!promptText || !provider) {
      console.error('Missing required parameters:', { promptText: !!promptText, provider: !!provider });
      return new Response(
        JSON.stringify({ error: 'Missing promptText or provider' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let result;
    let model = '';
    
    // Execute based on provider with extensive logging
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
        brandCount: result.brands.length, 
        tokenIn: result.tokenIn, 
        tokenOut: result.tokenOut,
        responseLength: result.responseText.length,
        brands: result.brands
      });

    } catch (providerError: any) {
      console.error(`${provider} execution failed:`, providerError.message);
      
      // Insert error record into new table
      if (orgId && promptId) {
        const { error: insertError } = await supabase
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
            score: 0
          });

        if (insertError) {
          console.error('Failed to insert error record:', insertError);
        }
      }

      throw providerError;
    }

    // Enhanced brand analysis - REQUIRED, no fallbacks
    let brandAnalysis: BrandAnalysisResult | null = null;
    let orgData: any = null;
    
    if (orgId) {
      console.log('Starting enhanced brand analysis...');
      
      // Get organization's brand catalog and organization info
      const [brandCatalogResult, orgResult] = await Promise.all([
        supabase
          .from('brand_catalog')
          .select('name, variants_json, is_org_brand')
          .eq('org_id', orgId),
        supabase
          .from('organizations')
          .select('name, domain')
          .eq('id', orgId)
          .single()
      ]);

      if (brandCatalogResult.error) {
        console.error('Error fetching brand catalog:', brandCatalogResult.error);
      }

      if (orgResult.error) {
        console.error('Error fetching organization:', orgResult.error);
      }

      const brandCatalogRaw = brandCatalogResult.data || [];
      orgData = orgResult.data;
      
      console.log(`Brand catalog fetched: ${brandCatalogRaw.length} brands`);
      console.log('Organization data:', orgData);
      
      // Transform brand catalog to ensure variants_json is properly typed
      let brandCatalog = brandCatalogRaw.map(brand => ({
        name: brand.name,
        is_org_brand: brand.is_org_brand,
        variants_json: Array.isArray(brand.variants_json) 
          ? brand.variants_json 
          : (brand.variants_json ? [brand.variants_json] : [])
      }));
      
      // Augment with organization fallback if no org brand exists
      const hasOrgBrand = brandCatalog.some(b => b.is_org_brand);
      if (!hasOrgBrand && orgData) {
        console.log('No org brand found, adding fallback from organization data');
        const orgVariants = [orgData.name];
        if (orgData.domain) {
          const domainBase = orgData.domain.replace(/\..*$/, ''); // Remove TLD
          orgVariants.push(domainBase, orgData.domain);
          
          // Add common descriptor variants
          if (domainBase.toLowerCase() === 'hubspot') {
            orgVariants.push('HubSpot Marketing Hub', 'Marketing Hub', 'HubSpot CRM');
          }
        }
        
        brandCatalog.push({
          name: orgData.name,
          is_org_brand: true,
          variants_json: orgVariants
        });
        
        console.log('Added synthetic org brand:', orgData.name, 'with variants:', orgVariants);
      }
      
      console.log('Final brand catalog:', brandCatalog);
      console.log('Org brands found:', brandCatalog.filter(b => b.is_org_brand));
      
      // Run enhanced brand analysis
      try {
        brandAnalysis = await analyzeBrands(
          result.responseText, 
          brandCatalog,
          {
            strictFiltering: true,
            confidenceThreshold: 0.6
          }
        );
          
        console.log('Enhanced brand analysis complete:', {
          orgBrands: brandAnalysis.orgBrands.length,
          competitors: brandAnalysis.competitors.length,
          score: brandAnalysis.score.score,
          confidence: brandAnalysis.score.confidence,
          processingTime: brandAnalysis.metadata.processingTime,
          falsePositivesRemoved: brandAnalysis.metadata.filteringStats.falsePositivesRemoved
        });
      } catch (error) {
        console.error('Enhanced brand analysis failed:', error);
        // Provide minimal safe response instead of legacy fallback
        brandAnalysis = {
          orgBrands: [],
          competitors: [],
          score: { 
            brandPresent: false, 
            brandPosition: null, 
            competitorCount: 0, 
            score: 0, 
            confidence: 0.1 
          },
          metadata: {
            totalBrandsExtracted: 0,
            responseLength: result.responseText.length,
            processingTime: 0,
            extractionMethod: 'enhanced-failed',
            filteringStats: { beforeFiltering: 0, afterFiltering: 0, falsePositivesRemoved: 0 }
          }
        };
      }
    } else {
      // No orgId provided - minimal analysis
      brandAnalysis = {
        orgBrands: [],
        competitors: [],
        score: { 
          brandPresent: false, 
          brandPosition: null, 
          competitorCount: 0, 
          score: 0, 
          confidence: 0.1 
        },
        metadata: {
          totalBrandsExtracted: 0,
          responseLength: result.responseText.length,
          processingTime: 0,
          extractionMethod: 'no-org-provided',
          filteringStats: { beforeFiltering: 0, afterFiltering: 0, falsePositivesRemoved: 0 }
        }
      };
    }

    // Insert into database and persist competitors
    let responseId: string | null = null;

    try {
      if (orgId && promptId) {
        // Calculate prominence for database (1-based, safe for DB)
        const prominence = brandAnalysis.score.brandPresent && brandAnalysis.score.brandPosition !== null
          ? Math.max(1, Math.floor(brandAnalysis.score.brandPosition / 10) + 1)
          : null;

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
            raw_ai_response: result.responseText || '',
            raw_evidence: JSON.stringify({
              brandAnalysis,
              legacyBrands: result.brands,
              metadata: brandAnalysis.metadata
            }),
            brands_json: brandAnalysis.orgBrands.map(b => b.name),
            org_brand_present: brandAnalysis.score.brandPresent,
            org_brand_prominence: prominence,
            competitors_json: brandAnalysis.competitors.map(c => c.name),
            competitors_count: brandAnalysis.score.competitorCount,
            score: brandAnalysis.score.score,
            metadata: {
              analysisConfidence: brandAnalysis.score.confidence,
              extractionMethod: brandAnalysis.metadata.extractionMethod,
              processingTime: brandAnalysis.metadata.processingTime,
              falsePositivesRemoved: brandAnalysis.metadata.filteringStats.falsePositivesRemoved
            }
          })
          .select()
          .single();

        if (insertError) {
          console.error('Failed to insert prompt_provider_responses:', insertError);
        } else if (responseRecord) {
          responseId = responseRecord.id;
          console.log('Successfully inserted enhanced response record:', responseId);
          
          // Persist competitors to brand catalog and competitor mentions
          await persistCompetitorData(supabase, orgId, promptId, brandAnalysis);
        }
      } else {
        console.log('Skipping persistence: missing orgId or promptId');
      }
    } catch (persistErr) {
      console.error('Persistence error:', persistErr);
    }

    const response = {
      success: true,
      responseText: result.responseText,
      brands: brandAnalysis.orgBrands.map(b => b.name),
      orgBrands: brandAnalysis.orgBrands.map(b => b.name),
      competitors: brandAnalysis.competitors.map(c => c.name),
      score: brandAnalysis.score.score,
      brandPresent: brandAnalysis.score.brandPresent,
      brandPosition: brandAnalysis.score.brandPosition,
      competitorCount: brandAnalysis.score.competitorCount,
      tokenIn: result.tokenIn || 0,
      tokenOut: result.tokenOut || 0,
      responseId,
      persisted: !!responseId,
      model,
      // Enhanced metadata
      analysisMetadata: brandAnalysis.metadata
    };

    console.log(`=== EXECUTE PROMPT SUCCESS ===`);
    
    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('=== EXECUTE PROMPT ERROR ===', error.message);
    console.error('Stack trace:', error.stack);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        stack: error.stack 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function executeOpenAI(promptText: string) {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) throw new Error('OpenAI API key not found');

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
          role: 'system',
          content: 'You are a helpful AI assistant. Answer the user\'s question comprehensively and naturally. After your response, include a JSON object with a single key "brands" containing an array of brand or company names you mentioned in your answer.'
        },
        {
          role: 'user',
          content: promptText
        }
      ],
      max_tokens: 1000,
      temperature: 0.7
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices[0].message.content;
  const usage = data.usage || {};

  // Extract brands from the response
  const brands = extractBrandsFromResponse(content);

  return {
    brands,
    responseText: content,
    tokenIn: usage.prompt_tokens || 0,
    tokenOut: usage.completion_tokens || 0,
  };
}

async function executePerplexity(promptText: string) {
  const apiKey = Deno.env.get('PERPLEXITY_API_KEY');
  if (!apiKey) throw new Error('Perplexity API key not found');

  const headers = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  } as const;

  const url = 'https://api.perplexity.ai/chat/completions';
  let lastErr: any = null;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: 'sonar',
          messages: [
            { role: 'user', content: promptText }
          ]
        }),
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        const err = new Error(`Perplexity API error: ${response.status} ${response.statusText} - ${errText}`);
        if (response.status === 401 || response.status === 403) throw err; // don't retry auth
        lastErr = err;
        if (attempt < 3) {
          await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
          continue;
        }
        throw err;
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content ?? '';
      const usage = data.usage || {};

      const brands = extractBrandsFromResponse(content);

      return {
        brands,
        responseText: content,
        tokenIn: usage.prompt_tokens ?? 0,
        tokenOut: usage.completion_tokens ?? 0,
      };
    } catch (e) {
      lastErr = e;
      if (attempt < 3) await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
    }
  }

  throw lastErr || new Error('Perplexity failed');
}

async function executeGemini(promptText: string) {
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) throw new Error('Gemini API key not found');

  const models = ['gemini-2.5-flash-lite', 'gemini-1.5-flash-8b'];
  let lastErr: any = null;

  const buildBody = () => ({
    contents: [
      { parts: [{ text: promptText }] }
    ],
    generationConfig: {
      temperature: 0.7,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 2000,
    }
  });

  for (const model of models) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(buildBody()),
          }
        );

        if (!response.ok) {
          const errText = await response.text().catch(() => '');
          const err = new Error(`Gemini API error: ${response.status} ${response.statusText} - ${errText}`);
          if (response.status === 401 || response.status === 403) throw err; // don't retry auth
          lastErr = err;
          if (attempt < 3) {
            await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
            continue;
          }
          break; // try next model
        }

        const data = await response.json();
        const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const usage = data.usageMetadata || {};
        const brands = extractBrandsFromResponse(content);

        return {
          brands,
          responseText: content,
          tokenIn: usage.promptTokenCount || 0,
          tokenOut: usage.candidatesTokenCount || 0,
          model
        };
      } catch (e) {
        lastErr = e;
        if (attempt < 3) await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
      }
    }
  }

  throw lastErr || new Error('Gemini failed');
}

/**
 * Extract brands from AI response - tries JSON first, falls back to text analysis  
 */
function extractBrandsFromResponse(text: string): string[] {
  // Strip code fences first and try JSON extraction
  let cleanText = text.replace(/```(?:json)?\s*([\s\S]*?)\s*```/g, '$1');
  
  const jsonPatterns = [
    /\{[^}]*"brands"[^}]*\}/g,
    /"brands"\s*:\s*\[[^\]]*\]/g
  ];
  
  for (const pattern of jsonPatterns) {
    const matches = Array.from(cleanText.matchAll(pattern));
    for (const match of matches) {
      try {
        let jsonStr = match[0];
        if (jsonStr.includes('"brands"') && !jsonStr.startsWith('{')) {
          jsonStr = `{${jsonStr}}`;
        }
        
        const parsed = JSON.parse(jsonStr);
        if (parsed.brands && Array.isArray(parsed.brands)) {
          return parsed.brands.filter(brand => typeof brand === 'string' && brand.trim().length > 0);
        }
      } catch {
        continue;
      }
    }
  }
  
  // Fallback to text extraction
  return extractBrandsFromText(text);
}

/**
 * Fallback brand extraction from text content using patterns - improved version for fallback analysis
 */
function extractBrandsFromText(text: string, orgData?: any): string[] {
  const brandPatterns = [
    // Prioritize org brand variants first
    ...(orgData ? [
      new RegExp(`\\b${orgData.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi'),
      ...(orgData.domain ? [new RegExp(`\\b${orgData.domain.replace(/\..*$/, '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi')] : [])
    ] : []),
    
    // Two-word brands like "Google Analytics", "HubSpot Marketing"
    /\b[A-Z][a-z]+ (?:Analytics|Marketing|Cloud|Hub|Platform|Suite|Pro|Studio|Labs|Works|Systems|Solutions|CRM|Insights|Manager|Central|Express|Business|Enterprise)\b/g,
    
    // Domain names - strong brand indicators  
    /\b[A-Z][a-z]{2,}\.(?:com|io|net|org|ai|co|app)\b/g,
    
    // CamelCase with 2+ capitals: "HubSpot", "JavaScript", "iPhone"
    /\b[A-Z][a-z]*[A-Z][a-zA-Z]+\b/g,
    
    // Well-known marketing/business brands
    /\b(?:HubSpot|Salesforce|Marketo|Pardot|Mailchimp|Klaviyo|ConvertKit|ActiveCampaign|Drip|Hootsuite|Buffer|Sprout Social|CoSchedule|Later|Canva|Adobe|Google|Microsoft|Meta|Facebook|Instagram|LinkedIn|Twitter|YouTube|TikTok|Pinterest|Snapchat|WhatsApp)\b/gi,
    
    // Two-word brands like "Google Cloud"
    /\b[A-Z][a-z]+ [A-Z][a-z]+\b/g,
    
    // Single capitalized words (more selective)
    /\b[A-Z][a-z]{3,}\b/g
  ];
  
  const brands = new Set<string>();
  
  for (const pattern of brandPatterns) {
    const matches = text.match(pattern);
    if (matches) {
      matches.forEach(match => {
        const cleanMatch = match.trim();
        if (!isCommonWord(cleanMatch) && cleanMatch.length > 2) {
          brands.add(cleanMatch);
        }
      });
    }
  }
  
  // Filter common false positives
  const filteredBrands = Array.from(brands).filter(brand => {
    const lower = brand.toLowerCase();
    
    // Keep known marketing brands
    if (['hubspot', 'salesforce', 'marketo', 'mailchimp', 'hootsuite', 'buffer'].some(known => lower.includes(known))) {
      return true;
    }
    
    // Filter out generic terms
    if (['social media', 'email marketing', 'content marketing', 'digital marketing'].includes(lower)) {
      return false;
    }
    
    return true;
  });
  
  return filteredBrands.slice(0, 20); // Limit to prevent noise
}

/**
 * Persist competitor data to brand_catalog and competitor_mentions tables
 */
async function persistCompetitorData(
  supabase: any, 
  orgId: string, 
  promptId: string, 
  brandAnalysis: BrandAnalysisResult
) {
  console.log(`Persisting competitor data: ${brandAnalysis.competitors.length} competitors`);
  
  // Persist each competitor to brand catalog and mentions
  for (const competitor of brandAnalysis.competitors) {
    try {
      // Add to competitor mentions table
      const { error: mentionError } = await supabase.rpc('upsert_competitor_mention', {
        p_org_id: orgId,
        p_prompt_id: promptId,
        p_competitor_name: competitor.name,
        p_normalized_name: competitor.normalized,
        p_position: competitor.firstPosition || null,
        p_sentiment: 'neutral'
      });

      if (mentionError) {
        console.error('Error upserting competitor mention:', mentionError);
      } else {
        console.log(`✅ Persisted competitor mention: ${competitor.name}`);
      }

      // Add to brand catalog
      const competitorScore = Math.round(competitor.confidence * 100);
      const { error: brandError } = await supabase.rpc('upsert_competitor_brand', {
        p_org_id: orgId,
        p_brand_name: competitor.name,
        p_score: competitorScore
      });

      if (brandError) {
        console.error('Error upserting competitor brand:', brandError);
      } else {
        console.log(`✅ Persisted competitor brand: ${competitor.name} (score: ${competitorScore})`);
      }
    } catch (error) {
      console.error(`Error processing competitor ${competitor.name}:`, error);
    }
  }
  
  console.log(`Competitor persistence complete for prompt ${promptId}`);
}

/**
 * Check if a word is likely a common non-brand term
 */
function isCommonWord(word: string): boolean {
  const commonWords = [
    'The', 'This', 'That', 'Here', 'There', 'When', 'Where', 'What', 'How',
    'Some', 'Many', 'Most', 'All', 'Best', 'Good', 'Better', 'Great',
    'First', 'Last', 'Next', 'New', 'Old', 'Other', 'Another', 'Each', 'Every',
    'More', 'Less', 'Much', 'Such', 'Only', 'Also', 'Even', 'Still'
  ];
  return commonWords.includes(word);
}
