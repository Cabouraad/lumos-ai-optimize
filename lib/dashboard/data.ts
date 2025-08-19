/**
 * Dashboard data fetching utilities
 */

import { supabase } from '@/integrations/supabase/client';

export async function getDashboardData(orgId: string) {
  const today = new Date().toISOString().split('T')[0];
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // Get today's aggregate score (average of latest per-prompt per-provider scores)
  const { data: todayScores } = await supabase
    .from('visibility_results')
    .select(`
      score,
      prompt_runs!inner (
        prompt_id,
        provider_id,
        run_at,
        prompts!inner (
          org_id
        )
      )
    `)
    .eq('prompt_runs.prompts.org_id', orgId)
    .gte('prompt_runs.run_at', `${today}T00:00:00Z`)
    .lt('prompt_runs.run_at', `${today}T23:59:59Z`);

  // Calculate today's average score (convert to 0-100 scale for UI display)
  const todayAvg = todayScores && todayScores.length > 0 
    ? Math.round((todayScores.reduce((sum, r) => sum + r.score, 0) / todayScores.length) * 10) // Convert 0-10 to 0-100
    : 0;

  // Get 7-day daily averages for sparkline
  const { data: weeklyScores } = await supabase
    .from('visibility_results')
    .select(`
      score,
      prompt_runs!inner (
        run_at,
        prompts!inner (
          org_id
        )
      )
    `)
    .eq('prompt_runs.prompts.org_id', orgId)
    .gte('prompt_runs.run_at', sevenDaysAgo);

  // Group by day and calculate averages
  const dailyAverages = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const dayScores = weeklyScores?.filter(r => 
      (r.prompt_runs as any).run_at.startsWith(date)
    ) || [];
    const avg = dayScores.length > 0 
      ? dayScores.reduce((sum, r) => sum + r.score, 0) / dayScores.length
      : 0;
    dailyAverages.push(avg);
  }

  // Get top 5 missing prompts (where org absent today)
  const { data: missingPrompts } = await supabase
    .from('visibility_results')
    .select(`
      prompt_runs!inner (
        run_at,
        prompts!inner (
          id,
          text,
          org_id
        )
      )
    `)
    .eq('prompt_runs.prompts.org_id', orgId)
    .eq('org_brand_present', false)
    .gte('prompt_runs.run_at', `${today}T00:00:00Z`)
    .lt('prompt_runs.run_at', `${today}T23:59:59Z`)
    .limit(5);

  // Get top 5 competitors (from last 7 days)
  const { data: competitorData } = await supabase
    .from('visibility_results')
    .select(`
      brands_json,
      org_brand_present,
      prompt_runs!inner (
        run_at,
        prompts!inner (
          org_id
        )
      )
    `)
    .eq('prompt_runs.prompts.org_id', orgId)
    .gte('prompt_runs.run_at', sevenDaysAgo);

  // Count competitor mentions
  const competitorCounts: Record<string, number> = {};
  competitorData?.forEach(result => {
    if (Array.isArray(result.brands_json)) {
      result.brands_json.forEach((brand: string) => {
        if (brand && brand.length > 0) {
          competitorCounts[brand] = (competitorCounts[brand] || 0) + 1;
        }
      });
    }
  });

  const topCompetitors = Object.entries(competitorCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));

  // Get health data
  const { data: providers } = await supabase
    .from('llm_providers')
    .select('name, enabled');

  const { data: todayRuns } = await supabase
    .from('prompt_runs')
    .select(`
      status,
      token_in,
      token_out,
      prompts!inner (
        org_id
      )
    `)
    .eq('prompts.org_id', orgId)
    .gte('run_at', `${today}T00:00:00Z`)
    .lt('run_at', `${today}T23:59:59Z`);

  const totalTokens = todayRuns?.reduce((sum, run) => sum + run.token_in + run.token_out, 0) || 0;
  const errorRate = todayRuns?.length > 0 
    ? Math.round((todayRuns.filter(run => run.status === 'error').length / todayRuns.length) * 100)
    : 0;

  return {
    todayScore: todayAvg,
    sparklineData: dailyAverages,
    missingPrompts: missingPrompts?.map(r => (r.prompt_runs as any).prompts) || [],
    topCompetitors,
    health: {
      providers: providers || [],
      tokenSpend: totalTokens,
      errorRate
    }
  };
}