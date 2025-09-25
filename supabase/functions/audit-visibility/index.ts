
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';
import { authenticateUser } from '../_shared/auth.ts';

const ORIGIN = Deno.env.get("APP_ORIGIN") ?? "https://llumos.app";

const corsHeaders = {
  'Access-Control-Allow-Origin': ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const user = await authenticateUser(req);
    
    // Get user's org
    const { data: userData } = await supabase
      .from('users')
      .select('org_id')
      .eq('id', user.id)
      .single();

    if (!userData?.org_id) {
      throw new Error('User organization not found');
    }

    const orgId = userData.org_id;

    // Audit visibility data flow
    const audit = {
      orgId,
      timestamp: new Date().toISOString(),
      checks: {}
    };

    // 1. Check prompts
    const { data: prompts, error: promptsError } = await supabase
      .from('prompts')
      .select('id, text, active, created_at')
      .eq('org_id', orgId);

    audit.checks.prompts = {
      count: prompts?.length || 0,
      active: prompts?.filter((p: any) => p.active).length || 0,
      error: promptsError?.message
    };

    // 2. Check recent prompt runs (last 24 hours)
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: recentRuns, error: runsError } = await supabase
      .from('prompt_runs')
      .select(`
        id, status, run_at, prompt_id,
        prompts!prompt_runs_prompt_id_fkey (org_id, text)
      `)
      .gte('run_at', yesterday)
      .order('run_at', { ascending: false });

    const orgRuns = recentRuns?.filter((run: any) => run.prompts?.org_id === orgId) || [];
    
    audit.checks.recentRuns = {
      total: orgRuns.length,
      successful: orgRuns.filter((r: any) => r.status === 'success').length,
      failed: orgRuns.filter((r: any) => r.status === 'error').length,
      error: runsError?.message
    };

    // 3. Check visibility results for recent runs
    if (orgRuns.length > 0) {
      const runIds = orgRuns.map((r: any) => r.id);
      const { data: visibilityResults, error: visError } = await supabase
        .from('visibility_results')
        .select('id, prompt_run_id, score, org_brand_present, competitors_count, brands_json')
        .in('prompt_run_id', runIds);

    audit.checks.visibilityResults = {
      count: visibilityResults?.length || 0,
      avgScore: visibilityResults?.length > 0 
        ? Math.round((visibilityResults.reduce((sum: number, r: any) => sum + r.score, 0) / visibilityResults.length) * 10) / 10
        : 0,
      brandPresentCount: visibilityResults?.filter((r: any) => r.org_brand_present).length || 0,
      error: visError?.message
    };
    }

    // 4. Check competitors from brand_catalog
    const { data: competitorBrands, error: competitorError } = await supabase
      .from('brand_catalog')
      .select('id, name, total_appearances, last_seen_at')
      .eq('org_id', orgId)
      .eq('is_org_brand', false)
      .order('last_seen_at', { ascending: false })
      .limit(10);

    audit.checks.competitors = {
      count: competitorBrands?.length || 0,
      recentlyActive: competitorBrands?.filter(c => 
        new Date(c.last_seen_at) > new Date(Date.now() - 24 * 60 * 60 * 1000)
      ).length || 0,
      error: competitorError?.message
    };

    // 5. Check brand catalog
    const { data: brandCatalog, error: brandError } = await supabase
      .from('brand_catalog')
      .select('id, name, is_org_brand, total_appearances, average_score')
      .eq('org_id', orgId);

    audit.checks.brandCatalog = {
      totalBrands: brandCatalog?.length || 0,
      orgBrands: brandCatalog?.filter(b => b.is_org_brand).length || 0,
      competitorBrands: brandCatalog?.filter(b => !b.is_org_brand).length || 0,
      error: brandError?.message
    };

    // Generate summary
    const hasRecentData = (audit.checks.recentRuns?.successful || 0) > 0 && 
                         (audit.checks.visibilityResults?.count || 0) > 0;
    
    audit.summary = {
      status: hasRecentData ? 'HEALTHY' : 'NO_RECENT_DATA',
      message: hasRecentData 
        ? `Found ${audit.checks.recentRuns.successful} successful runs with ${audit.checks.visibilityResults?.count} visibility results in the last 24 hours`
        : 'No recent successful prompt runs with visibility results found',
      recommendations: []
    };

    if (!hasRecentData) {
      audit.summary.recommendations.push('Run prompts manually to generate fresh visibility data');
    }

    if ((audit.checks.competitors?.recentlyActive || 0) === 0) {
      audit.summary.recommendations.push('Competitor mentions may not be updating - check brand detection logic');
    }

    return new Response(
      JSON.stringify(audit, null, 2),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error: unknown) {
    console.error('Audit error:', error);
    return new Response(
      JSON.stringify({
        error: error.message || 'Audit failed',
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
