import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { detectCompetitors } from '../_shared/enhanced-competitor-detector.ts';
import { computeEnhancedVisibilityScore } from '../_shared/scoring/enhanced-visibility.ts';
import { getUserOrgId } from '../_shared/auth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://llumos.app',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Credentials': 'true'
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const openaiKey = Deno.env.get('OPENAI_API_KEY');
  
  if (!openaiKey) {
    return new Response(JSON.stringify({ error: 'OpenAI API key not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: req.headers.get('Authorization')! } }
  });

  try {
    // Verify authentication and get user's org ID (ignore orgId from request for security)
    const userOrgId = await getUserOrgId(supabase);

    const { promptId, providerId, responseText, citations, brands } = await req.json();

    if (!promptId || !providerId || !responseText) {
      return new Response(JSON.stringify({ error: 'Missing required parameters' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Analyzing response for prompt ${promptId} (org: ${userOrgId})`);

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

    // Use enhanced competitor detection with user's org ID
    console.log('🔍 Starting enhanced competitor detection...');
    const detectionResult = await detectCompetitors(supabase, userOrgId, responseText, {
      useNERFallback: true,
      maxCandidates: 15,
      confidenceThreshold: 0.7
    });

    console.log('✅ Detection complete:', {
      competitors: detectionResult.competitors.length,
      orgBrands: detectionResult.orgBrands.length,
      rejected: detectionResult.rejectedTerms.length,
      gazetteerMatches: detectionResult.metadata.gazetteer_matches,
      nerMatches: detectionResult.metadata.ner_matches
    });

    // Convert to legacy artifacts format for compatibility
    const artifacts = {
      brands: detectionResult.orgBrands.map(brand => ({
        name: brand.name,
        normalized: brand.normalized,
        confidence: brand.confidence,
        first_pos_ratio: brand.first_pos_ratio,
        mentions: brand.mentions,
        sentiment: 'neutral' as const
      })),
      competitors: detectionResult.competitors.map(comp => ({
        name: comp.name,
        normalized: comp.normalized,
        confidence: comp.confidence,
        first_pos_ratio: comp.first_pos_ratio,
        mentions: comp.mentions,
        sentiment: 'neutral' as const
      })),
      citations: [],
      metadata: {
        analysis_confidence: 0.9,
        response_length: responseText.length,
        verified_brands_count: detectionResult.competitors.length,
        rejected_terms_count: detectionResult.rejectedTerms.length,
        detection_method: 'enhanced_v2',
        processing_time_ms: detectionResult.metadata.processing_time_ms
      }
    };

    // Calculate brand presence and prominence
    const userBrandNorms = detectionResult.orgBrands.map(brand => brand.normalized);
    const orgBrandPresent = detectionResult.orgBrands.length > 0;
    
    // Calculate prominence based on actual position data
    const orgBrandProminence = orgBrandPresent && detectionResult.orgBrands.length > 0
      ? Math.round((1 - detectionResult.orgBrands[0].first_pos_ratio) * 100) // Convert to prominence score
      : 0;

    // Calculate visibility score using enhanced scoring
    const visibilityMetrics = {
      brandPresent: orgBrandPresent,
      brandPosition: orgBrandProminence,
      brandMentions: artifacts.brands.filter(b => userBrandNorms.includes(b.normalized)).length,
      competitorCount: artifacts.competitors.length,
      competitorMentions: artifacts.competitors.reduce((sum, c) => sum + c.mentions, 0),
      sentiment: artifacts.brands.find(b => userBrandNorms.includes(b.normalized))?.sentiment || 'neutral',
      contextRelevance: artifacts.metadata.analysis_confidence,
      responseLength: artifacts.metadata.response_length
    };

    const visibilityScore = Math.round(computeEnhancedVisibilityScore({
      brandPresent: orgBrandPresent,
      brandPosition: orgBrandProminence / 100,
      brandMentions: visibilityMetrics.brandMentions,
      competitorCount: visibilityMetrics.competitorCount,
      competitorMentions: visibilityMetrics.competitorMentions,
      sentiment: visibilityMetrics.sentiment as 'positive' | 'negative' | 'neutral',
      contextRelevance: visibilityMetrics.contextRelevance,
      responseLength: visibilityMetrics.responseLength
    }).overallScore * 100);

    // Create prompt run record
    const { data: promptRun, error: runError } = await supabase
      .from('prompt_runs')
      .insert({
        prompt_id: promptId,
        provider_id: providerId,
        status: 'completed',
        citations: citations || artifacts.citations,
        brands: artifacts.brands,
        competitors: artifacts.competitors,
        token_in: 0, // Would need to calculate from actual usage
        token_out: 0,
        cost_est: 0
      })
      .select()
      .single();

    if (runError) {
      console.error('Error creating prompt run:', runError);
      throw new Error('Failed to create prompt run');
    }

    // Create visibility results
    const { error: visibilityError } = await supabase
      .from('visibility_results')
      .insert({
        prompt_run_id: promptRun.id,
        org_brand_present: orgBrandPresent,
        org_brand_prominence: Math.round(orgBrandProminence),
        score: visibilityScore,
        competitors_count: artifacts.competitors.length,
        brands_json: artifacts.brands,
        raw_ai_response: responseText.substring(0, 5000), // Truncate if too long
        raw_evidence: JSON.stringify({
          detection_metadata: detectionResult.metadata,
          rejected_terms: detectionResult.rejectedTerms.slice(0, 20)
        })
      });

    if (visibilityError) {
      console.error('Error creating visibility results:', visibilityError);
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
    for (const brand of artifacts.brands.filter(b => userBrandNorms.includes(b.normalized))) {
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
      orgBrandProminence: Math.round(orgBrandProminence),
      competitorsCount: artifacts.competitors.length,
      brandsFound: artifacts.brands.length,
      citationsCount: artifacts.citations.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in analyze-ai-response function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});