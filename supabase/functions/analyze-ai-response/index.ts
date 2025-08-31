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

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
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
    method: analysis.metadata.analysis_method
  });

  // Store results in database using comprehensive analysis
  const { data: promptRunData, error: promptRunError } = await supabase
    .from('prompt_runs')
    .insert({
      prompt_id: promptId,
      org_id: userOrgId,
      run_at: new Date().toISOString(),
      visibility_score: analysis.score,
      org_brand_present: analysis.org_brand_present,
      org_brand_prominence: analysis.org_brand_prominence,
      competitors_count: analysis.competitors_json.length,
      metadata: {
        analysis_method: analysis.metadata.analysis_method,
        confidence_score: analysis.metadata.confidence_score,
        response_length: responseText.length,
        catalog_competitors: analysis.metadata.catalog_competitors,
        global_competitors: analysis.metadata.global_competitors,
        discovered_competitors: analysis.metadata.discovered_competitors,
        ...brands && { input_brands: brands }
      }
    })
    .select()
    .single();

  if (promptRunError) {
    console.error('❌ Error storing prompt run:', promptRunError);
    return new Response(
      JSON.stringify({ error: 'Failed to store prompt run data' }),
      { status: 500, headers: corsHeaders }
    );
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