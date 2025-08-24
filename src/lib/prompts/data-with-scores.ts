
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

interface PromptResponseData {
  prompt_id: string;
  score: number;
  org_brand_present: boolean;
  competitors_count: number;
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

    // Get recent results from prompt_provider_responses - last 7 days
    const promptIds = prompts.map(p => p.id);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: results } = await supabase
      .from('prompt_provider_responses')
      .select('prompt_id, score, org_brand_present, competitors_count, provider, run_at')
      .in('prompt_id', promptIds)
      .gte('run_at', sevenDaysAgo.toISOString())
      .eq('status', 'success');

    // Group results by prompt
    const resultsByPrompt = new Map<string, PromptResponseData[]>();
    if (results && Array.isArray(results)) {
      (results as PromptResponseData[]).forEach(result => {
        if (!resultsByPrompt.has(result.prompt_id)) {
          resultsByPrompt.set(result.prompt_id, []);
        }
        resultsByPrompt.get(result.prompt_id)!.push(result);
      });
    }

    // Build prompt data with visibility metrics
    return prompts.map(prompt => {
      const promptResults = resultsByPrompt.get(prompt.id) || [];
      const hasData = promptResults.length > 0;

      let visibilityScore = 0;
      let brandPct = 0;
      let competitorPct = 0;

      if (hasData) {
        // Calculate averages from recent results across all providers
        const scores = promptResults.map(r => r.score);
        visibilityScore = scores.reduce((sum, s) => sum + s, 0) / scores.length;

        const brandPresentCount = promptResults.filter(r => r.org_brand_present).length;
        brandPct = (brandPresentCount / promptResults.length) * 100;

        const totalCompetitors = promptResults.reduce((sum, r) => sum + (r.competitors_count || 0), 0);
        competitorPct = promptResults.length > 0 ? totalCompetitors / promptResults.length : 0;
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
