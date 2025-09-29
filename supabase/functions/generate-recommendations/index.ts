import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';
import { toCanonical, cleanCompetitorList } from '../_shared/brand-matching.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { orgId, accountId } = await req.json();
    const targetOrgId = orgId || accountId; // Support both parameter names

    if (!targetOrgId) {
      return new Response(JSON.stringify({ error: 'Missing orgId or accountId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Generating recommendations for org ${targetOrgId}`);
    
    const result = await generateRecommendations(targetOrgId, supabase);
    
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error generating recommendations:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error instanceof Error ? error.message : String(error),
      recommendationsCreated: 0
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function generateRecommendations(orgId: string, supabase: any) {
  try {
    // Get recent visibility results (last 30 days)
    const { data: results } = await supabase
      .from('prompt_provider_responses')
      .select(`
        *,
        prompts!inner (
          id,
          text,
          org_id
        )
      `)
      .eq('prompts.org_id', orgId)
      .gte('run_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .eq('status', 'success')
      .order('run_at', { ascending: false });

    if (!results || results.length === 0) {
      return { success: true, recommendationsCreated: 0, message: 'No recent data to analyze' };
    }

    // Get org info for brand analysis
    const { data: org } = await supabase
      .from('organizations')
      .select('name, business_description, target_audience')
      .eq('id', orgId)
      .single();

    const recommendations = [];
    
    // Analyze patterns and generate recommendations
    const analysis = await analyzeVisibilityResults(results, org, supabase, orgId);
    
    // Generate recommendations based on analysis
    if (analysis.lowVisibilityCount > 0) {
      recommendations.push({
        org_id: orgId,
        type: 'content',
        title: 'Improve Content Strategy',
        rationale: `${analysis.lowVisibilityCount} recent queries showed low brand visibility (score < 5). Consider creating targeted content around these topics to improve brand presence.`,
        status: 'open'
      });
    }

    if (analysis.notMentionedCount > 0) {
      recommendations.push({
        org_id: orgId,
        type: 'knowledge',
        title: 'Increase Brand Awareness',
        rationale: `Your brand wasn't mentioned in ${analysis.notMentionedCount} relevant queries. Focus on thought leadership content and SEO optimization for better discoverability.`,
        status: 'open'
      });
    }

    if (analysis.competitorAdvantage > 0) {
      recommendations.push({
        org_id: orgId,
        type: 'content',
        title: 'Competitive Content Gap',
        rationale: `Competitors appeared ${analysis.competitorAdvantage} more times than your brand. Create comparison content and highlight your unique value propositions.`,
        status: 'open'
      });
    }

    if (analysis.lowProminenceCount > 0) {
      recommendations.push({
        org_id: orgId,
        type: 'site',
        title: 'Improve Search Rankings',
        rationale: `Your brand appeared in ${analysis.lowProminenceCount} queries but with low prominence. Optimize SEO and create authoritative content to rank higher.`,
        status: 'open'
      });
    }

    if (analysis.topCompetitors.length > 0) {
      recommendations.push({
        org_id: orgId,
        type: 'content',
        title: 'Target Key Competitors',
        rationale: `Most mentioned competitors: ${analysis.topCompetitors.slice(0, 3).join(', ')}. Create content that directly addresses why customers should choose you over these alternatives.`,
        status: 'open'
      });
    }

    // Remove existing recommendations to avoid duplicates
    await supabase
      .from('recommendations')
      .delete()
      .eq('org_id', orgId)
      .neq('title', 'DOMAIN_TOKEN'); // Keep domain verification tokens

    // Insert new recommendations
    if (recommendations.length > 0) {
      const { error } = await supabase
        .from('recommendations')
        .insert(recommendations);

      if (error) {
        console.error('Error inserting recommendations:', error);
        return { success: false, error: error.message };
      }
    }

    return {
      success: true,
      recommendationsCreated: recommendations.length,
      analysis
    };

  } catch (error: unknown) {
    console.error('Error in generateRecommendations:', error);
    return { success: false, error: error.message };
  }
}

async function analyzeVisibilityResults(results: any[], org: any, supabase: any, orgId: string) {
  let lowVisibilityCount = 0;
  let notMentionedCount = 0;
  let lowProminenceCount = 0;
  let orgMentions = 0;

  // Fetch brand catalog for canonicalization
  const { data: brandCatalog } = await supabase
    .from('brand_catalog')
    .select('id, name, variants_json, is_org_brand')
    .eq('org_id', orgId);

  // Create canonical brand mapping
  const canonicalMap = toCanonical(brandCatalog || []);

  const allCompetitorBrands: string[] = [];

  for (const result of results) {
    const score = result.score || 0;
    const orgPresent = result.org_brand_present;
    const prominence = result.org_brand_prominence;
    const brands = (result.brands_json || []);

    // Count low visibility (score < 5)
    if (score < 5) {
      lowVisibilityCount++;
    }

    // Count when org not mentioned
    if (!orgPresent) {
      notMentionedCount++;
    } else {
      orgMentions++;
      
      // Count low prominence when present
      if (prominence !== null && prominence > 2) {
        lowProminenceCount++;
      }
    }

    // Collect competitor brands for canonicalization
    const competitors = result.competitors_json || [];
    allCompetitorBrands.push(...competitors);
  }

  // Clean and canonicalize competitors
  const cleanedCompetitors = cleanCompetitorList(allCompetitorBrands, canonicalMap);
  const topCompetitors = cleanedCompetitors
    .slice(0, 5)
    .map(c => c.canonical);

  const totalCompetitorMentions = cleanedCompetitors.reduce((sum, c) => sum + c.mentions, 0);
  const competitorAdvantage = Math.max(0, totalCompetitorMentions - orgMentions);

  console.log(`[analyzeVisibilityResults] Found ${cleanedCompetitors.length} canonical competitors, ${topCompetitors.length} top competitors`);

  return {
    totalResults: results.length,
    lowVisibilityCount,
    notMentionedCount,
    lowProminenceCount,
    competitorAdvantage,
    topCompetitors,
    orgMentions,
    totalCompetitorMentions
  };
}