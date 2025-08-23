
import { supabase } from "@/integrations/supabase/client";
import { getOrgId } from "@/lib/auth";

export async function getSafeDashboardData() {
  try {
    const orgId = await getOrgId();

    // Get basic org data
    const [promptsResult, providersResult] = await Promise.all([
      supabase.from("prompts").select("id, text, active, created_at").eq("org_id", orgId),
      supabase.from("llm_providers").select("id, name, enabled")
    ]);

    const promptIds = (promptsResult.data || []).map(p => p.id);

    if (promptIds.length === 0) {
      return {
        avgScore: 0,
        overallScore: 0,
        trend: 0,
        promptCount: 0,
        providers: providersResult.data || [],
        prompts: promptsResult.data || [],
        chartData: [],
        totalRuns: 0,
        recentRunsCount: 0
      };
    }

    // Get runs and visibility data
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    const { data: runs } = await supabase
      .from('prompt_runs')
      .select('id, run_at, prompt_id')
      .in('prompt_id', promptIds)
      .eq('status', 'success')
      .gte('run_at', thirtyDaysAgo.toISOString())
      .order('run_at', { ascending: true });

    if (!runs || runs.length === 0) {
      return {
        avgScore: 0,
        overallScore: 0,
        trend: 0,
        promptCount: promptsResult.data?.length || 0,
        providers: providersResult.data || [],
        prompts: promptsResult.data || [],
        chartData: [],
        totalRuns: 0,
        recentRunsCount: 0
      };
    }

    // Get visibility results
    const runIds = runs.map(r => r.id);
    const { data: results } = await supabase
      .from('visibility_results')
      .select('prompt_run_id, score')
      .in('prompt_run_id', runIds);

    const resultsByRun = new Map();
    (results || []).forEach(r => {
      resultsByRun.set(r.prompt_run_id, r.score);
    });

    // Calculate metrics
    const today = new Date().toISOString().split('T')[0];
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

    // Today's scores
    const todayScores = runs
      .filter(r => r.run_at.startsWith(today))
      .map(r => resultsByRun.get(r.id))
      .filter(s => typeof s === 'number');

    const avgScore = todayScores.length > 0 
      ? todayScores.reduce((sum, s) => sum + s, 0) / todayScores.length 
      : 0;

    // Last 7 days scores
    const last7DaysScores = runs
      .filter(r => new Date(r.run_at) >= sevenDaysAgo)
      .map(r => resultsByRun.get(r.id))
      .filter(s => typeof s === 'number');

    const overallScore = last7DaysScores.length > 0
      ? last7DaysScores.reduce((sum, s) => sum + s, 0) / last7DaysScores.length
      : 0;

    // Previous 7 days for trend
    const prev7DaysScores = runs
      .filter(r => {
        const date = new Date(r.run_at);
        return date >= fourteenDaysAgo && date < sevenDaysAgo;
      })
      .map(r => resultsByRun.get(r.id))
      .filter(s => typeof s === 'number');

    const prevAvg = prev7DaysScores.length > 0
      ? prev7DaysScores.reduce((sum, s) => sum + s, 0) / prev7DaysScores.length
      : 0;

    const trend = prevAvg > 0 ? ((overallScore - prevAvg) / prevAvg) * 100 : 0;

    // Chart data - group by day
    const dailyScores = new Map<string, number[]>();
    runs.forEach(run => {
      const score = resultsByRun.get(run.id);
      if (typeof score === 'number') {
        const date = run.run_at.split('T')[0];
        if (!dailyScores.has(date)) {
          dailyScores.set(date, []);
        }
        dailyScores.get(date)!.push(score);
      }
    });

    const chartData = Array.from(dailyScores.entries())
      .map(([date, scores]) => ({
        date,
        score: Math.round((scores.reduce((sum, s) => sum + s, 0) / scores.length) * 10) / 10,
        runs: scores.length
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return {
      avgScore: Math.round(avgScore * 10) / 10,
      overallScore: Math.round(overallScore * 10) / 10,
      trend: Math.round(trend * 10) / 10,
      promptCount: promptsResult.data?.length || 0,
      providers: providersResult.data || [],
      prompts: promptsResult.data || [],
      chartData,
      totalRuns: runs.length,
      recentRunsCount: last7DaysScores.length
    };

  } catch (error) {
    console.error("Dashboard data error:", error);
    throw error;
  }
}
