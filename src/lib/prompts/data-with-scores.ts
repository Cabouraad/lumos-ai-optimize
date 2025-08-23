
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

    // Get prompts
    const { data: prompts } = await supabase
      .from('prompts')
      .select('id, text, active, created_at')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });

    if (!prompts || prompts.length === 0) {
      return [];
    }

    // Get recent runs for these prompts
    const promptIds = prompts.map(p => p.id);
    const { data: runs } = await supabase
      .from('prompt_runs')
      .select('id, prompt_id')
      .in('prompt_id', promptIds)
      .eq('status', 'success')
      .order('run_at', { ascending: false })
      .limit(500);

    // Get visibility results for these runs
    const runIds = (runs || []).map(r => r.id);
    let visibilityResults: any[] = [];
    
    if (runIds.length > 0) {
      const { data: results } = await supabase
        .from('visibility_results')
        .select('prompt_run_id, score, org_brand_present, competitors_count')
        .in('prompt_run_id', runIds);
      
      visibilityResults = results || [];
    }

    // Map results by run, then by prompt
    const resultsByRun = new Map();
    visibilityResults.forEach(r => {
      resultsByRun.set(r.prompt_run_id, r);
    });

    const resultsByPrompt = new Map<string, any[]>();
    (runs || []).forEach(run => {
      const result = resultsByRun.get(run.id);
      if (result) {
        if (!resultsByPrompt.has(run.prompt_id)) {
          resultsByPrompt.set(run.prompt_id, []);
        }
        resultsByPrompt.get(run.prompt_id)!.push(result);
      }
    });

    // Build prompt data with visibility metrics
    return prompts.map(prompt => {
      const promptResults = resultsByPrompt.get(prompt.id) || [];
      const hasData = promptResults.length > 0;

      let visibilityScore = 0;
      let brandPct = 0;
      let competitorPct = 0;

      if (hasData) {
        // Calculate averages
        const scores = promptResults.map(r => r.score);
        visibilityScore = scores.reduce((sum, s) => sum + s, 0) / scores.length;

        const brandPresentCount = promptResults.filter(r => r.org_brand_present).length;
        brandPct = (brandPresentCount / promptResults.length) * 100;

        const totalCompetitors = promptResults.reduce((sum, r) => sum + (r.competitors_count || 0), 0);
        competitorPct = totalCompetitors / promptResults.length;
      }

      return {
        id: prompt.id,
        text: prompt.text,
        active: prompt.active,
        created_at: prompt.created_at,
        visibilityScore: Math.round(visibilityScore * 10) / 10,
        brandPct: Math.round(brandPct),
        competitorPct: Math.round(competitorPct),
        hasData
      };
    });

  } catch (error) {
    console.error("Prompts data error:", error);
    throw error;
  }
}
