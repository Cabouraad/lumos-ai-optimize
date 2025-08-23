
import { supabase } from "@/integrations/supabase/client";
import { getOrgId } from "@/lib/auth";

export interface PromptWithScore {
  id: string;
  text: string;
  active: boolean;
  created_at: string;
  visibilityScore: number;
  brandPct: number;
  competitorPct: number;
  hasData: boolean;
}

export async function getPromptsWithScores(): Promise<PromptWithScore[]> {
  try {
    const orgId = await getOrgId();

    // Get prompts first
    const { data: prompts, error: promptsError } = await supabase
      .from("prompts")
      .select("id, text, active, created_at")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(200);

    if (promptsError) throw promptsError;

    if (!prompts || prompts.length === 0) {
      return [];
    }

    // Get prompt runs for these prompts
    const promptIds = prompts.map(p => p.id);
    const { data: promptRuns, error: runsError } = await supabase
      .from("prompt_runs")
      .select("id, prompt_id, status")
      .in("prompt_id", promptIds)
      .eq("status", "success");

    if (runsError) {
      console.warn("Error fetching prompt runs:", runsError);
    }

    // Get visibility results for successful runs
    const runIds = promptRuns?.map(r => r.id) || [];
    let visibilityResults: any[] = [];
    
    if (runIds.length > 0) {
      const { data: vResults, error: vError } = await supabase
        .from("visibility_results")
        .select("prompt_run_id, score, org_brand_present, competitors_count")
        .in("prompt_run_id", runIds);

      if (vError) {
        console.warn("Error fetching visibility results:", vError);
      } else {
        visibilityResults = vResults || [];
      }
    }

    // Map prompts to their results
    return prompts.map(prompt => {
      // Find runs for this prompt
      const promptRunsForPrompt = promptRuns?.filter(run => run.prompt_id === prompt.id) || [];
      const runIdsForPrompt = promptRunsForPrompt.map(r => r.id);
      
      // Find visibility results for this prompt's runs
      const visibilityResultsForPrompt = visibilityResults.filter(vr => 
        runIdsForPrompt.includes(vr.prompt_run_id)
      );

      let visibilityScore = 0;
      let brandPct = 0;
      let competitorPct = 0;
      const hasData = visibilityResultsForPrompt.length > 0;

      if (hasData) {
        // Calculate average visibility score (scores are already 0-10)
        const scores = visibilityResultsForPrompt.map(r => r.score || 0);
        visibilityScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
        
        // Calculate brand presence percentage
        const brandPresentCount = visibilityResultsForPrompt.filter(r => r.org_brand_present).length;
        brandPct = (brandPresentCount / visibilityResultsForPrompt.length) * 100;
        
        // Calculate average competitor count
        const totalCompetitors = visibilityResultsForPrompt.reduce((sum, r) => sum + (r.competitors_count || 0), 0);
        competitorPct = totalCompetitors / visibilityResultsForPrompt.length;
      }

      return {
        id: prompt.id,
        text: prompt.text,
        active: prompt.active,
        created_at: prompt.created_at,
        visibilityScore: Math.round(visibilityScore * 10) / 10, // Keep 0-10 scale, round to 1 decimal
        brandPct: Math.round(brandPct),
        competitorPct: Math.round(competitorPct),
        hasData,
      };
    });
  } catch (error) {
    console.error("Prompts data error:", error);
    throw error;
  }
}
