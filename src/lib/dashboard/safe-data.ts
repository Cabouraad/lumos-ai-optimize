import { supabase } from "@/integrations/supabase/client";
import { getOrgId } from "@/lib/auth";

export async function getSafeDashboardData() {
  try {
    const orgId = await getOrgId();

    // Providers (will now succeed due to RLS fix)
    const { data: providers, error: provErr } = await supabase
      .from("llm_providers")
      .select("name, enabled");
    if (provErr) throw provErr;

    // Prompts list (kept simple)
    const { data: prompts, error: pErr } = await supabase
      .from("prompts")
      .select("id, text, active, created_at")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (pErr) throw pErr;

    // Today's aggregate score
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    const { data: todayRuns, error: rErr } = await supabase
      .from("prompt_runs")
      .select("id, run_at, prompt_id")
      .in("prompt_id", (prompts ?? []).map(p => p.id))
      .gte("run_at", since.toISOString());
    if (rErr) throw rErr;

    // Read scores for those runs
    const { data: results, error: sErr } = await supabase
      .from("visibility_results")
      .select("score, prompt_run_id")
      .in("prompt_run_id", (todayRuns ?? []).map(r => r.id));
    if (sErr) throw sErr;

    const scores = (results ?? []).map(r => r.score);
    const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;

    return {
      providers: providers ?? [],
      prompts: prompts ?? [],
      avgScore,
      promptCount: prompts?.length ?? 0
    };
  } catch (error) {
    console.error("Dashboard data error:", error);
    throw error;
  }
}