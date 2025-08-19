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

    // Get prompts with their latest visibility results
    const { data: prompts, error } = await supabase
      .from("prompts")
      .select(`
        id, 
        text, 
        active, 
        created_at,
        prompt_runs (
          id,
          run_at,
          status,
          visibility_results (
            score,
            org_brand_present,
            competitors_count
          )
        )
      `)
      .eq("org_id", orgId)
      .eq("prompt_runs.status", "success")
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) throw error;

    return (prompts ?? []).map(prompt => {
      // Get all successful visibility results for this prompt
      const visibilityResults = prompt.prompt_runs
        ?.filter(run => run.status === 'success' && run.visibility_results?.length > 0)
        ?.flatMap(run => run.visibility_results || []) || [];

      let visibilityScore = 0;
      let brandPct = 0;
      let competitorPct = 0;
      const hasData = visibilityResults.length > 0;

      if (hasData) {
        // Calculate average visibility score
        const scores = visibilityResults.map(r => r.score || 0);
        visibilityScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
        
        // Calculate brand presence percentage
        const brandPresentCount = visibilityResults.filter(r => r.org_brand_present).length;
        brandPct = (brandPresentCount / visibilityResults.length) * 100;
        
        // Calculate average competitor count
        const totalCompetitors = visibilityResults.reduce((sum, r) => sum + (r.competitors_count || 0), 0);
        competitorPct = totalCompetitors / visibilityResults.length;
      }

      return {
        id: prompt.id,
        text: prompt.text,
        active: prompt.active,
        created_at: prompt.created_at,
        visibilityScore: hasData ? visibilityScore / 10 : 0, // Convert from 0-100 to 0-10 scale
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