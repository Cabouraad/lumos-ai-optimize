import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';
import { extractArtifacts, createBrandGazetteer } from '../_shared/visibility/extractArtifacts.ts';
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

    // Build org brand variants directly from brand_catalog
    const { data: orgBrandData, error: orgBrandError } = await supabase
      .from('brand_catalog')
      .select('name, variants_json')
      .eq('org_id', userOrgId)
      .eq('is_org_brand', true);

    if (orgBrandError) {
      console.error('Error fetching org brands:', orgBrandError);
    }

    // Build org brand variants with fallback - NORMALIZE for proper matching
    let orgBrandVariants: string[] = [];
    const normalizedUserBrands: string[] = [];
    if (orgBrandData && orgBrandData.length > 0) {
      for (const brand of orgBrandData) {
        orgBrandVariants.push(brand.name);
        normalizedUserBrands.push(brand.name.toLowerCase().replace(/[^\w\s.-]/g, '').replace(/\s+/g, ' ').trim());
        const variants = brand.variants_json || [];
        orgBrandVariants.push(...variants);
        variants.forEach(v => normalizedUserBrands.push(v.toLowerCase().replace(/[^\w\s.-]/g, '').replace(/\s+/g, ' ').trim()));
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
      normalizedUserBrands: normalizedUserBrands.length,
      competitorGazetteer: competitorGazetteer.length,
      responseLength: responseText.length
    });

    // Use extractArtifacts for primary matching - PASS NORMALIZED USER BRANDS
    const artifacts = extractArtifacts(responseText, normalizedUserBrands, competitorGazetteer);

    // SHADOW MODE: Compare current with V2 detection when flag enabled
    if (isEdgeFeatureEnabled('FEATURE_DETECTOR_SHADOW')) {
      try {
        // Compute current results from existing code (unchanged)
        const current: DetectionResult = {
          brands: artifacts.brands.map(b => b.name),
          competitors: artifacts.competitors.map(c => c.name)
        };
        
        // Compute proposed via simplified V2 detection
        const proposed = runSimpleV2Detection(responseText, providerId, orgBrandVariants, competitorGazetteer);

        const diffs = diffDetections(current, proposed);

        const context: LogContext = {
          provider: providerId,
          promptId,
          runId,
          method: 'current_vs_v2'
        };

        const sample = {
          responseLength: responseText.length,
          confidence: artifacts.metadata.analysis_confidence,
          metadata: {
            text_sample: responseText.substring(0, 200), // First 200 chars for spot checks
            current_method: 'extractArtifacts',
            proposed_method: 'simple_v2_detection',
            current_total: current.brands.length + current.competitors.length,
            proposed_total: proposed.brands.length + proposed.competitors.length
          }
        };

        // Log the comparison (no DB writes)
        logDetections(context, diffs, sample);
        
      } catch (error) {
        console.warn('Shadow V2 diagnostics failed:', error.message);
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

    // Update org brand tracking if mentioned - FIX: Use normalized brands for filtering
    for (const brand of artifacts.brands.filter(b => normalizedUserBrands.includes(b.normalized))) {
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