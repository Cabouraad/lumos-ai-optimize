import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';
import { extractArtifacts, createBrandGazetteer } from '../_shared/visibility/extractArtifacts.ts';
import { GLOBAL_COMPETITORS, findGlobalCompetitor } from '../_shared/global-competitors-gazetteer.ts';
import { isEdgeFeatureEnabled } from '../_shared/feature-flags.ts';
import { 
  diffDetections, 
  logDetections, 
  runSimpleV2Detection,
  type DetectionResult,
  type LogContext
} from '../_shared/detection-diagnostics.ts';

const ORIGIN = Deno.env.get("APP_ORIGIN") ?? "https://llumos.app";

const corsHeaders = {
  'Access-Control-Allow-Origin': ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Get authenticated user's org ID
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      throw new Error('Invalid user token');
    }

    const { data: userData, error: orgError } = await supabase
      .from('users')
      .select('org_id')
      .eq('id', user.id)
      .single();

    if (orgError || !userData) {
      throw new Error('User organization not found');
    }

    const userOrgId = userData.org_id;

const { promptId, providerId, responseText, citations, brands } = await req.json();

    if (!promptId || !providerId || !responseText) {
      return new Response(JSON.stringify({ error: 'Missing required parameters' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const runId = crypto.randomUUID();
    console.log(`Analyzing response for prompt ${promptId} (org: ${userOrgId}, run: ${runId})`);

    // Get prompt data (verify it belongs to user's org)
    const { data: prompt, error: promptError } = await supabase
      .from('prompts')
      .select('text')
      .eq('id', promptId)
      .eq('org_id', userOrgId)
      .single();

    if (promptError) {
      console.error('Error fetching prompt:', promptError);
      throw new Error('Failed to fetch prompt');
    }

// Extract citations first if not provided
  let extractedCitations = citations;
  if (!extractedCitations && responseText) {
    console.log('📎 Extracting citations from response text...');
    
    const { extractPerplexityCitations, extractGeminiCitations, extractOpenAICitations } = 
      await import('../_shared/citations-enhanced.ts');
    
    try {
      switch (providerId) {
        case 'perplexity':
          extractedCitations = extractPerplexityCitations({}, responseText);
          break;
        case 'gemini':
          extractedCitations = extractGeminiCitations({}, responseText);
          break;
        case 'openai':
        default:
          extractedCitations = extractOpenAICitations(responseText);
          break;
      }
      
      if (extractedCitations?.citations?.length > 0) {
        console.log(`✅ Extracted ${extractedCitations.citations.length} citations from ${providerId} response`);
      } else {
        console.log(`⚠️ No citations extracted from ${providerId} response`);
      }
    } catch (error: unknown) {
      console.error('❌ Citation extraction failed:', error);
      extractedCitations = null;
    }
  }

// Use comprehensive brand response analyzer
  console.log('🔍 Starting comprehensive brand analysis...');
  
  // Get organization's brand catalog data
  const { data: brandCatalog } = await supabase
    .from('brand_catalog')
    .select('name, variants_json, is_org_brand')
    .eq('org_id', userOrgId);
    
  if (!brandCatalog) {
    console.error('❌ No brand catalog found for organization');
    return new Response(
      JSON.stringify({ error: 'No brand catalog found for organization' }),
      { status: 400, headers: corsHeaders }
    );
  }
  
  // Get organization data
  const { data: orgData } = await supabase
    .from('organizations')
    .select('name, domain, keywords, competitors, products_services')
    .eq('id', userOrgId)
    .single();
  
  // Use the comprehensive brand analyzer
  const { analyzePromptResponse } = await import('../_shared/brand-response-analyzer.ts');
  
  const analysis = await analyzePromptResponse(
    responseText,
    {
      name: orgData?.name || 'Unknown',
      domain: orgData?.domain,
      keywords: orgData?.keywords,
      competitors: orgData?.competitors,
      products_services: orgData?.products_services
    },
    brandCatalog
  );
  
  console.log(`🎯 Comprehensive analysis complete:`, {
    orgBrandPresent: analysis.org_brand_present,
    orgBrandProminence: analysis.org_brand_prominence, 
    competitors: analysis.competitors_json.length,
    score: analysis.score,
    method: analysis.metadata.analysis_method,
    citations: citations ? citations.citations?.length || 0 : 0
  });

  // Store results in prompt_provider_responses using upsert function
  const { data: responseId, error: responseError } = await supabase.rpc(
    'upsert_prompt_provider_response',
    {
      p_prompt_id: promptId,
      p_provider: providerId,
      p_org_id: userOrgId,
      p_score: analysis.score,
      p_org_brand_present: analysis.org_brand_present,
      p_org_brand_prominence: analysis.org_brand_prominence,
      p_competitors_count: analysis.competitors_json.length,
      p_brands_json: analysis.brands_json,
      p_competitors_json: analysis.competitors_json,
      p_metadata: {
        ...analysis.metadata,
        response_length: responseText.length,
        ...(brands && { input_brands: brands })
      },
      p_raw_ai_response: responseText,
      p_status: 'success'
    }
  );

  if (responseError) {
    console.error('❌ Error storing response:', responseError);
    return new Response(
      JSON.stringify({ error: 'Failed to store response data' }),
      { status: 500, headers: corsHeaders }
    );
  }

  let citationsStoredId = null;

  // Store citations if extracted or provided
  if (extractedCitations && extractedCitations.citations && extractedCitations.citations.length > 0) {
    console.log(`📎 Storing ${extractedCitations.citations.length} citations`);
    
    const { error: citationError } = await supabase
      .from('prompt_provider_responses')
      .update({ citations_json: extractedCitations })
      .eq('id', responseId);

    if (citationError) {
      console.error('❌ Error storing citations:', citationError);
    } else {
      citationsStoredId = responseId;
      console.log('✅ Citations stored successfully');
    }
  } else {
    console.log('ℹ️ No citations to store');
  }

  // Store visibility results with comprehensive data
  const { error: visibilityError } = await supabase
    .from('visibility_results')
    .insert({
      prompt_run_id: promptRunData.id,
      org_id: userOrgId,
      visibility_score: analysis.score,
      org_brand_present: analysis.org_brand_present,
      org_brand_prominence: analysis.org_brand_prominence,
      competitors_count: analysis.competitors_json.length,
      competitors_json: analysis.competitors_json,
      brands_json: analysis.brands_json,
      metadata: analysis.metadata
    });

  if (visibilityError) {
    console.error('❌ Error storing visibility results:', visibilityError);
  }

  // Update competitor mentions using RPC calls
  for (const competitorName of analysis.competitors_json) {
    await supabase.rpc('upsert_competitor_mention', {
      p_org_id: userOrgId,
      p_competitor_name: competitorName,
      p_confidence_score: 0.9, // High confidence from comprehensive analysis
      p_mention_context: 'Comprehensive analysis detection'
    });
  }

  // Update brand mentions
  for (const brandName of analysis.brands_json) {
    await supabase.rpc('upsert_competitor_brand', {
      p_org_id: userOrgId,
      p_brand_name: brandName,
      p_score: Math.round(analysis.score)
    });
  }

  // Trigger citation analysis in background if citations were stored
  if (citationsStoredId && extractedCitations?.citations?.some((c: any) => c.brand_mention === 'unknown')) {
    console.log('🚀 Triggering background citation analysis');
    
    // Use background task to avoid blocking the response
    const cronSecret = Deno.env.get('CRON_SECRET');
    if (cronSecret) {
      // Call citation-mention worker asynchronously
      fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/citation-mention`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${cronSecret}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ response_id: citationsStoredId })
      }).catch(error => {
        console.error('Background citation analysis failed:', error);
      });
    }
  }

  console.log('✅ Comprehensive analysis complete, results stored');

  return new Response(
    JSON.stringify({ 
      success: true,
      analysis: {
        orgBrandPresent: analysis.org_brand_present,
        orgBrandProminence: analysis.org_brand_prominence,
        visibilityScore: analysis.score,
        competitorsCount: analysis.competitors_json.length,
        brandsFound: analysis.brands_json.length,
        confidence: analysis.metadata.confidence_score,
        method: analysis.metadata.analysis_method,
        breakdown: {
          catalogCompetitors: analysis.metadata.catalog_competitors,
          globalCompetitors: analysis.metadata.global_competitors,
          discoveredCompetitors: analysis.metadata.discovered_competitors
        }
      }
    }),
    { headers: corsHeaders }
  );

  } catch (error: any) {
    console.error('Error analyzing AI response:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});