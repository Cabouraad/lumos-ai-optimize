
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

    // Get prompts with their latest visibility results using proper foreign key relationships
    const { data: prompts, error } = await supabase
      .from("prompts")
      .select(`
        id, 
        text, 
        active, 
        created_at,
        prompt_runs!prompts_prompt_id_fkey (
          id,
          run_at,
          status,
          visibility_results!visibility_results_prompt_run_id_fkey (
            score,
            org_brand_present,
            competitors_count
          )
        )
      `)
      .eq("org_id", orgId)
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
        // Calculate average visibility score (scores are already 0-10, no need to divide by 10)
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
        visibilityScore: Math.round(visibilityScore * 10) / 10, // Keep 0-10 scale, just round to 1 decimal
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
