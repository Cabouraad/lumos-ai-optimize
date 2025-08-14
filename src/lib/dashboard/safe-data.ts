import { supabase } from "@/integrations/supabase/client";
import { getOrgId } from "@/lib/auth";

export async function getSafeDashboardData() {
  try {
    const orgId = await getOrgId();

    // Get all data in parallel
    const [promptsResult, providersResult, todayRunsResult, historicalResult] = await Promise.all([
      supabase.from("prompts").select("id, text, active, created_at").eq("org_id", orgId).order("created_at", { ascending: false }),
      supabase.from("llm_providers").select("id, name, enabled"),
      supabase.from("prompt_runs")
        .select(`
          id, status, run_at,
          visibility_results (score)
        `)
        .gte('run_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString())
        .lt('run_at', new Date(new Date().setHours(23, 59, 59, 999)).toISOString())
        .eq('status', 'success')
        .in('prompt_id', 
          (await supabase.from("prompts").select("id").eq("org_id", orgId)).data?.map(p => p.id) || []
        ),
      supabase.from("prompt_runs")
        .select(`
          id, status, run_at,
          visibility_results (score)
        `)
        .gte('run_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()) // Last 30 days
        .eq('status', 'success')
        .in('prompt_id', 
          (await supabase.from("prompts").select("id").eq("org_id", orgId)).data?.map(p => p.id) || []
        )
        .order('run_at', { ascending: true })
    ]);

    if (promptsResult.error) throw promptsResult.error;
    if (providersResult.error) throw providersResult.error;
    if (todayRunsResult.error) throw todayRunsResult.error;
    if (historicalResult.error) throw historicalResult.error;

    // Calculate today's average score
    const todayScores = todayRunsResult.data
      ?.filter(run => run.visibility_results?.length > 0)
      ?.map(run => run.visibility_results[0].score) || [];
    
    const todayAvg = todayScores.length > 0 
      ? Math.round((todayScores.reduce((sum, score) => sum + score, 0) / todayScores.length) * 10) / 10
      : 0;

    // Calculate overall visibility score (last 7 days average)
    const last7Days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentScores = historicalResult.data
      ?.filter(run => {
        const runDate = new Date(run.run_at);
        return runDate >= last7Days && run.visibility_results?.length > 0;
      })
      ?.map(run => run.visibility_results[0].score) || [];

    const overallScore = recentScores.length > 0
      ? Math.round((recentScores.reduce((sum, score) => sum + score, 0) / recentScores.length) * 10) / 10
      : 0;

    // Process historical data for the chart (group by day)
    const dailyScores = new Map<string, { scores: number[], date: string }>();
    
    historicalResult.data?.forEach(run => {
      if (run.visibility_results?.length > 0) {
        const date = new Date(run.run_at).toISOString().split('T')[0];
        if (!dailyScores.has(date)) {
          dailyScores.set(date, { scores: [], date });
        }
        dailyScores.get(date)!.scores.push(run.visibility_results[0].score);
      }
    });

    const chartData = Array.from(dailyScores.values()).map(day => ({
      date: day.date,
      score: Math.round((day.scores.reduce((sum, score) => sum + score, 0) / day.scores.length) * 10) / 10,
      runs: day.scores.length
    })).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Calculate trend (comparing last 7 days to previous 7 days)
    const previous7Days = historicalResult.data
      ?.filter(run => {
        const runDate = new Date(run.run_at);
        const startRange = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
        const endRange = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        return runDate >= startRange && runDate < endRange && run.visibility_results?.length > 0;
      })
      ?.map(run => run.visibility_results[0].score) || [];

    const previousAvg = previous7Days.length > 0
      ? previous7Days.reduce((sum, score) => sum + score, 0) / previous7Days.length
      : 0;

    const trend = previousAvg > 0 ? ((overallScore - previousAvg) / previousAvg) * 100 : 0;

    return {
      avgScore: todayAvg,
      overallScore,
      trend: Math.round(trend * 10) / 10,
      promptCount: promptsResult.data?.length || 0,
      providers: providersResult.data || [],
      prompts: promptsResult.data || [],
      chartData,
      totalRuns: historicalResult.data?.length || 0,
      recentRunsCount: recentScores.length
    };

  } catch (error) {
    console.error("Dashboard data error:", error);
    throw error;
  }
}