
import { supabase } from "@/integrations/supabase/client";
import { getOrgId } from "@/lib/auth";

export async function getSafeDashboardData() {
  try {
    const orgId = await getOrgId();

    // 1) Load prompts for this org (IDs only)
    const { data: prompts, error: promptsError } = await supabase
      .from("prompts")
      .select("id, text, active, created_at")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false });

    if (promptsError) throw promptsError;

    const promptIds = (prompts || []).map(p => p.id);

    // Early return with empty defaults if no prompts yet
    if (promptIds.length === 0) {
      return {
        avgScore: 0,
        overallScore: 0,
        trend: 0,
        promptCount: 0,
        providers: [],
        prompts: [],
        chartData: [],
        totalRuns: 0,
        recentRunsCount: 0,
      };
    }

    // 2) Parallel fetch: providers, today's runs, historical runs (last 30 days)
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [providersRes, todayRunsRes, historicalRunsRes] = await Promise.all([
      supabase.from("llm_providers").select("id, name, enabled"),
      supabase
        .from("prompt_runs")
        .select("id, prompt_id, status, run_at")
        .in("prompt_id", promptIds)
        .eq("status", "success")
        .gte("run_at", startOfToday.toISOString())
        .lt("run_at", endOfToday.toISOString()),
      supabase
        .from("prompt_runs")
        .select("id, prompt_id, status, run_at")
        .in("prompt_id", promptIds)
        .eq("status", "success")
        .gte("run_at", thirtyDaysAgo.toISOString())
        .order("run_at", { ascending: true }),
    ]);

    if (providersRes.error) throw providersRes.error;
    if (todayRunsRes.error) throw todayRunsRes.error;
    if (historicalRunsRes.error) throw historicalRunsRes.error;

    const providers = providersRes.data || [];
    const todayRuns = todayRunsRes.data || [];
    const historicalRuns = historicalRunsRes.data || [];

    // 3) Fetch visibility_results for the union of run ids
    const allRunIds = Array.from(new Set([...todayRuns, ...historicalRuns].map(r => r.id)));

    let visibilityByRun = new Map<string, number>();
    if (allRunIds.length > 0) {
      const { data: visResults, error: visError } = await supabase
        .from("visibility_results")
        .select("prompt_run_id, score")
        .in("prompt_run_id", allRunIds);
      if (visError) throw visError;
      (visResults || []).forEach(v => visibilityByRun.set(v.prompt_run_id, v.score));
    }

    // 4) Compute today's average
    const todayScores = todayRuns
      .map(r => visibilityByRun.get(r.id))
      .filter((s): s is number => typeof s === "number");

    const todayAvg = todayScores.length > 0
      ? Math.round((todayScores.reduce((sum, s) => sum + s, 0) / todayScores.length) * 10) / 10
      : 0;

    // 5) Compute overall (last 7 days) average and trend
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

    const last7Runs = historicalRuns.filter(r => new Date(r.run_at) >= sevenDaysAgo);
    const prev7Runs = historicalRuns.filter(r => new Date(r.run_at) < sevenDaysAgo && new Date(r.run_at) >= fourteenDaysAgo);

    const last7Scores = last7Runs
      .map(r => visibilityByRun.get(r.id))
      .filter((s): s is number => typeof s === "number");

    const prev7Scores = prev7Runs
      .map(r => visibilityByRun.get(r.id))
      .filter((s): s is number => typeof s === "number");

    const overallScore = last7Scores.length > 0
      ? Math.round((last7Scores.reduce((sum, s) => sum + s, 0) / last7Scores.length) * 10) / 10
      : 0;

    const prevAvg = prev7Scores.length > 0
      ? prev7Scores.reduce((sum, s) => sum + s, 0) / prev7Scores.length
      : 0;

    const trend = prevAvg > 0 ? Math.round((((overallScore - prevAvg) / prevAvg) * 100) * 10) / 10 : 0;

    // 6) Build chart data (daily averages across last 30 days)
    const byDay = new Map<string, number[]>();
    historicalRuns.forEach(r => {
      const score = visibilityByRun.get(r.id);
      if (typeof score !== "number") return;
      const day = new Date(r.run_at).toISOString().split("T")[0];
      if (!byDay.has(day)) byDay.set(day, []);
      byDay.get(day)!.push(score);
    });

    const chartData = Array.from(byDay.entries())
      .map(([date, scores]) => ({
        date,
        score: Math.round((scores.reduce((sum, s) => sum + s, 0) / scores.length) * 10) / 10,
        runs: scores.length,
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return {
      avgScore: todayAvg,
      overallScore,
      trend,
      promptCount: prompts?.length || 0,
      providers,
      prompts: prompts || [],
      chartData,
      totalRuns: historicalRuns.length,
      recentRunsCount: last7Scores.length,
    };

  } catch (error) {
    console.error("Dashboard data error:", error);
    throw error;
  }
}
