import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';
import { extractArtifacts, createBrandGazetteer } from '../_shared/visibility/extractArtifacts.ts';
import { isOptimizationFeatureEnabled } from '../../src/config/featureFlags.ts';
import { 
  diffDetections, 
  logDetections, 
  normalizeDetectionResult,
  type DetectionResult,
  type LogContext 
} from '../../src/lib/detect/diagnostics.ts';
import { preprocessText } from '../../src/lib/detect/preprocess.ts';

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

    // Build org brand variants directly from brand_catalog
    const { data: orgBrandData, error: orgBrandError } = await supabase
      .from('brand_catalog')
      .select('name, variants_json')
      .eq('org_id', userOrgId)
      .eq('is_org_brand', true);

    if (orgBrandError) {
      console.error('Error fetching org brands:', orgBrandError);
    }

    // Build org brand variants with fallback
    let orgBrandVariants: string[] = [];
    if (orgBrandData && orgBrandData.length > 0) {
      for (const brand of orgBrandData) {
        orgBrandVariants.push(brand.name);
        const variants = brand.variants_json || [];
        orgBrandVariants.push(...variants);
      }
    }

    // Build competitor gazetteer from brand_catalog only
    const { data: competitorData, error: competitorError } = await supabase
      .from('brand_catalog')
      .select('name, variants_json')
      .eq('org_id', userOrgId)
      .eq('is_org_brand', false);

    if (competitorError) {
      console.error('Error fetching competitors:', competitorError);
    }

    const competitorGazetteer = createBrandGazetteer(competitorData || []);

    console.log('📋 Analysis setup:', {
      orgBrandVariants: orgBrandVariants.length,
      competitorGazetteer: competitorGazetteer.length,
      responseLength: responseText.length
    });

    // Use extractArtifacts for primary matching
    const artifacts = extractArtifacts(responseText, orgBrandVariants, competitorGazetteer);

    // Shadow mode diagnostics - test alternative extraction methods if enabled
    if (isOptimizationFeatureEnabled('FEATURE_DETECTOR_SHADOW')) {
      try {
        // Import enhanced detector for comparison
        const { detectCompetitorsWithFallback } = await import('../_shared/competitor-detection/integration.ts');
        const enhancedResult = await detectCompetitorsWithFallback(responseText, userOrgId, supabase);
        
        // Compare results
        const currentResult = normalizeDetectionResult({
          brands: artifacts.brands.map(b => b.name),
          competitors: artifacts.competitors.map(c => c.name)
        });
        
        const proposedResult = normalizeDetectionResult({
          brands: enhancedResult.orgBrands.map(b => b.name),
          competitors: enhancedResult.competitors.map(c => c.name)
        });
        
        const diffs = diffDetections(currentResult, proposedResult);
        
        const context: LogContext = {
          provider: providerId,
          promptId,
          runId,
          method: 'artifacts_vs_enhanced'
        };
        
        const sample = {
          responseLength: responseText.length,
          confidence: artifacts.metadata.analysis_confidence,
          metadata: {
            current_method: 'extractArtifacts',
            proposed_method: enhancedResult.metadata.detection_method,
            current_total: currentResult.brands.length + currentResult.competitors.length,
            proposed_total: proposedResult.brands.length + proposedResult.competitors.length
          }
        };
        
        logDetections(context, diffs, sample);
        
        // Also test with preprocessed text
        const preprocessed = preprocessText(responseText);
        const preprocessedArtifacts = extractArtifacts(preprocessed.plainText, orgBrandVariants, competitorGazetteer);
        const preprocessedResult = normalizeDetectionResult({
          brands: preprocessedArtifacts.brands.map(b => b.name),
          competitors: preprocessedArtifacts.competitors.map(c => c.name)
        });
        
        const preprocessedDiffs = diffDetections(currentResult, preprocessedResult);
        
        const preprocessedContext: LogContext = {
          provider: providerId + '-preprocessed',
          promptId,
          runId,
          method: 'artifacts_vs_preprocessed_artifacts'
        };
        
        const preprocessedSample = {
          responseLength: responseText.length,
          confidence: artifacts.metadata.analysis_confidence,
          metadata: {
            current_method: 'extractArtifacts',
            proposed_method: 'extractArtifacts_preprocessed',
            current_total: currentResult.brands.length + currentResult.competitors.length,
            proposed_total: preprocessedResult.brands.length + preprocessedResult.competitors.length,
            preprocessing: {
              original_length: responseText.length,
              processed_length: preprocessed.plainText.length,
              anchors_extracted: preprocessed.anchors.length,
              domains_extracted: preprocessed.domains.length,
              size_reduction_pct: Math.round(((responseText.length - preprocessed.plainText.length) / responseText.length) * 100)
            }
          }
        };
        
        logDetections(preprocessedContext, preprocessedDiffs, preprocessedSample);
        
      } catch (error) {
        console.warn('Shadow diagnostics failed:', error.message);
      }
    }

    // Determine brand presence and ordinal prominence
    const orgBrandPresent = artifacts.brands.length > 0;
    let orgBrandProminence: number | null = null;

    if (orgBrandPresent && artifacts.brands.length > 0) {
      // Calculate ordinal position (1st, 2nd, 3rd, etc.)
      const firstBrand = artifacts.brands[0];
      // Convert first_pos_ratio to ordinal position
      const position = Math.max(1, Math.round(firstBrand.first_pos_ratio * 10) + 1);
      orgBrandProminence = Math.min(position, 10); // Cap at 10th position
    }

    // Calculate visibility score aligned with client-side analyzer
    let visibilityScore = 1; // Base score

    if (orgBrandPresent) {
      visibilityScore = 6; // Brand found baseline
      
      // Position bonus (earlier = better)
      if (orgBrandProminence !== null) {
        if (orgBrandProminence === 1) visibilityScore += 3; // First position
        else if (orgBrandProminence <= 3) visibilityScore += 2; // Top 3
        else if (orgBrandProminence <= 6) visibilityScore += 1; // Top 6
      }
      
      // Competition penalty
      const competitorsCount = artifacts.competitors.length;
      if (competitorsCount > 8) visibilityScore -= 2;
      else if (competitorsCount > 4) visibilityScore -= 1;
    }

    // Ensure score is within bounds
    visibilityScore = Math.max(1, Math.min(10, visibilityScore));

    console.log('🎯 Analysis complete:', {
      orgBrandPresent,
      orgBrandProminence,
      visibilityScore,
      catalogCompetitors: artifacts.competitors.length
    });

    // Create prompt run record
    const { data: promptRun, error: runError } = await supabase
      .from('prompt_runs')
      .insert({
        prompt_id: promptId,
        provider_id: providerId,
        raw_response: responseText,
        visibility_score: visibilityScore,
        brands_detected: artifacts.brands.map(b => b.name),
        competitors_detected: artifacts.competitors.map(c => c.name),
        citations: citations || [],
        run_at: new Date().toISOString()
      })
      .select()
      .single();

    if (runError) {
      console.error('Error creating prompt run:', runError);
      throw new Error('Failed to create prompt run');
    }

    // Create visibility results record
    const { data: visibilityResult, error: visibilityError } = await supabase
      .from('visibility_results')
      .insert({
        prompt_run_id: promptRun.id,
        org_id: userOrgId,
        org_brand_present: orgBrandPresent,
        org_brand_prominence: orgBrandProminence,
        competitors_count: artifacts.competitors.length,
        visibility_score: visibilityScore,
        brands_json: artifacts.brands.map(b => b.name),
        competitors_json: artifacts.competitors.map(c => c.name),
        citations_json: citations || [],
        analysis_metadata: {
          analysis_version: '2.1',
          extraction_method: 'enhanced_artifacts',
          competitor_conf_threshold: 0.8,
          response_length: responseText.length
        }
      })
      .select()
      .single();

    if (visibilityError) {
      console.error('Error creating visibility result:', visibilityError);
      throw new Error('Failed to create visibility results');
    }

    // Persist competitor mentions with proper tracking
    for (const competitor of artifacts.competitors) {
      try {
        const { error: mentionError } = await supabase.rpc('upsert_competitor_mention', {
          p_org_id: userOrgId,
          p_prompt_id: promptId,
          p_competitor_name: competitor.name,
          p_normalized_name: competitor.normalized,
          p_position: competitor.first_pos_ratio,
          p_sentiment: competitor.sentiment || 'neutral'
        });

        if (mentionError) {
          console.error('Error upserting competitor mention:', mentionError);
        }

        // Also update brand catalog
        const { error: brandError } = await supabase.rpc('upsert_competitor_brand', {
          p_org_id: userOrgId,
          p_brand_name: competitor.name,
          p_score: Math.round(competitor.confidence * 100)
        });

        if (brandError) {
          console.error('Error upserting competitor brand:', brandError);
        }
      } catch (error) {
        console.error('Error processing competitor:', error);
      }
    }

    // Update org brand tracking if mentioned
    for (const brand of artifacts.brands.filter(b => orgBrandVariants.includes(b.normalized))) {
      try {
        const { error: mentionError } = await supabase.rpc('upsert_competitor_mention', {
          p_org_id: userOrgId,
          p_prompt_id: promptId,
          p_competitor_name: brand.name,
          p_normalized_name: brand.normalized,
          p_position: brand.first_pos_ratio,
          p_sentiment: brand.sentiment || 'neutral'
        });

        if (mentionError) {
          console.error('Error upserting org brand mention:', mentionError);
        }
      } catch (error) {
        console.error('Error processing org brand mention:', error);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      promptRunId: promptRun.id,
      visibilityScore,
      orgBrandPresent,
      orgBrandProminence: orgBrandProminence,
      competitorsCount: artifacts.competitors.length,
      brandsDetected: artifacts.brands.map(b => b.name),
      competitorsDetected: artifacts.competitors.map(c => c.name),
      citations: citations || [],
      metadata: {
        analysis_version: '2.1',
        extraction_method: 'enhanced_artifacts',
        response_length: responseText.length
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Error analyzing AI response:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});