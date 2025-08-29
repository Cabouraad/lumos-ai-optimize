import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { extractArtifacts } from '../_shared/visibility/extractArtifacts.ts';
import { extractBrandsFromText, type BrandCatalogEntry } from '../_shared/unified-brand-extraction.ts';
import { computeEnhancedVisibilityScore } from '../_shared/scoring/enhanced-visibility.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const openaiKey = Deno.env.get('OPENAI_API_KEY');
  
  if (!openaiKey) {
    return new Response(JSON.stringify({ error: 'OpenAI API key not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { promptId, orgId, providerId, responseText, citations, brands } = await req.json();

    if (!promptId || !orgId || !providerId || !responseText) {
      return new Response(JSON.stringify({ error: 'Missing required parameters' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Analyzing response for prompt ${promptId}`);

    // Get organization brand catalog and prompt data
    const [brandCatalogResult, promptResult] = await Promise.all([
      supabase
        .from('brand_catalog')
        .select('name, variants_json, is_org_brand')
        .eq('org_id', orgId),
      supabase
        .from('prompts')
        .select('text')
        .eq('id', promptId)
        .single()
    ]);

    if (brandCatalogResult.error) {
      console.error('Error fetching brand catalog:', brandCatalogResult.error);
      throw new Error('Failed to fetch brand catalog');
    }

    if (promptResult.error) {
      console.error('Error fetching prompt:', promptResult.error);
      throw new Error('Failed to fetch prompt');
    }

    const brandCatalog = brandCatalogResult.data;
    const prompt = promptResult.data;

    // Extract enhanced artifacts
    const userBrandNorms = brandCatalog
      .filter(b => b.is_org_brand)
      .flatMap(b => [b.name.toLowerCase(), ...(b.variants_json || []).map((v: string) => v.toLowerCase())]);
    
    const gazetteer = brandCatalog.map(b => b.name);
    const artifacts = extractArtifacts(responseText, userBrandNorms, gazetteer);

    // Calculate brand presence and prominence
    const orgBrandPresent = artifacts.brands.some(b => 
      userBrandNorms.includes(b.normalized)
    );
    
    const orgBrandProminence = orgBrandPresent 
      ? Math.max(...artifacts.brands
          .filter(b => userBrandNorms.includes(b.normalized))
          .map(b => b.first_pos_ratio * 100))
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
        raw_evidence: JSON.stringify(artifacts.citations)
      });

    if (visibilityError) {
      console.error('Error creating visibility results:', visibilityError);
      throw new Error('Failed to create visibility results');
    }

    // Persist competitor mentions with proper tracking
    for (const competitor of artifacts.competitors) {
      try {
        const { error: mentionError } = await supabase.rpc('upsert_competitor_mention', {
          p_org_id: orgId,
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
          p_org_id: orgId,
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
          p_org_id: orgId,
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