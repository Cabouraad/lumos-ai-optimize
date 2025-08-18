/**
 * Recommendation engine for generating actionable insights from visibility data
 */

export type Reco = {
  kind: 'content' | 'social' | 'site' | 'prompt';
  title: string;
  rationale: string;
  steps: string[];         // 2-5 clear steps
  estLift: number;         // 0..1
  sourcePromptIds: string[];
  sourceRunIds: string[];
  citations: Array<{type: 'url' | 'ref', value: string}>;
  cooldownDays?: number;   // default 14
};

interface PromptVisibility {
  prompt_id: string;
  text: string;
  runs_7d: number;
  avg_score_7d: number;
}

interface CompetitorShare {
  prompt_id: string;
  brand_norm: string;
  mean_score: number;
  n: number;
}

interface RunData {
  id: string;
  prompt_id: string;
  citations: Array<{type: string, value: string}>;
  competitors: Array<{name: string, normalized: string, mentions: number}>;
  run_at?: string;
  prompt_text?: string;
}

export async function buildRecommendations(supabase: any, accountId: string): Promise<Reco[]> {
  const recommendations: Reco[] = [];

  try {
    // 1) Pull inputs (last 7d)
    const { data: promptVisibility } = await supabase
      .from('v_prompt_visibility_7d')
      .select('*')
      .eq('org_id', accountId);

    const { data: competitorShare } = await supabase
      .from('v_competitor_share_7d')
      .select('*')
      .eq('org_id', accountId);

    const { data: recentRuns } = await supabase
      .from('prompt_runs')
      .select(`
        id,
        prompt_id,
        citations,
        competitors,
        run_at,
        prompts!inner(org_id, text)
      `)
      .eq('prompts.org_id', accountId)
      .gte('run_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .in('status', ['success', 'completed'])
      .order('run_at', { ascending: false });

    if (!promptVisibility || !competitorShare || !recentRuns) {
      return [];
    }

    // 2) Compute signals and helper data structures
    const competitorMap = new Map<string, CompetitorShare[]>();
    
    competitorShare.forEach(cs => {
      if (!competitorMap.has(cs.prompt_id)) {
        competitorMap.set(cs.prompt_id, []);
      }
      competitorMap.get(cs.prompt_id)!.push(cs);
    });

    // Group runs by prompt
    const runsByPrompt = new Map<string, RunData[]>();
    recentRuns.forEach(run => {
      if (!runsByPrompt.has(run.prompt_id)) {
        runsByPrompt.set(run.prompt_id, []);
      }
      runsByPrompt.get(run.prompt_id)!.push({
        id: run.id,
        prompt_id: run.prompt_id,
        citations: run.citations || [],
        competitors: run.competitors || [],
        run_at: run.run_at,
        prompt_text: (run.prompts as any)?.text || ''
      });
    });

    // Collect citation frequency
    const citationFreq = new Map<string, {count: number, runs: string[], prompts: Set<string>}>();
    recentRuns.forEach(run => {
      const citations = run.citations || [];
      citations.forEach((citation: any) => {
        if (!citationFreq.has(citation.value)) {
          citationFreq.set(citation.value, {count: 0, runs: [], prompts: new Set()});
        }
        const freq = citationFreq.get(citation.value)!;
        freq.count++;
        freq.runs.push(run.id);
        freq.prompts.add(run.prompt_id);
      });
    });

    // Helper functions
    const HEAD_INTENTS = [/best/i, /compare|vs/i, /alternatives?/i];
    const isHeadPrompt = (txt: string) => HEAD_INTENTS.some(r => r.test(txt));

    // 3) Apply heuristic rules

    // R1: Missing presence on head prompts (adjusted threshold)
    const headPrompts = promptVisibility.filter(p => 
      p.avg_score_7d < 5.0 && isHeadPrompt(p.text)  // Changed from 0.2 to 5.0 for actual score range
    );

    for (const prompt of headPrompts) {
      const competitors = competitorMap.get(prompt.prompt_id) || [];
      const topCompetitor = competitors.sort((a, b) => b.mean_score - a.mean_score)[0];
      const runs = runsByPrompt.get(prompt.prompt_id) || [];
      const topCitations = runs.flatMap(r => r.citations).slice(0, 3);

      recommendations.push({
        kind: 'content',
        title: `Publish a comparison page for "${prompt.text.slice(0, 50)}..."`,
        rationale: `Your brand rarely appears for a high-intent query (${(prompt.avg_score_7d * 100).toFixed(1)}% visibility). ${topCompetitor ? `${topCompetitor.brand_norm} dominates citations and mentions.` : 'Competitors dominate citations and mentions.'}`,
        steps: [
          "Create a /compare/yourbrand-vs-competitor page with a summary table and FAQs.",
          "Add schema.org FAQ markup and internal links to Pricing and Case Studies.", 
          "Include 2–3 proof snippets and recent customer outcomes."
        ],
        estLift: 0.10,
        sourcePromptIds: [prompt.prompt_id],
        sourceRunIds: runs.slice(0, 5).map(r => r.id),
        citations: topCitations,
        cooldownDays: 21
      });
    }

    // R2: Single competitor dominates (adjusted threshold for 1-10 score range)
    const competitorDominance = new Map<string, string[]>();
    for (const [promptId, competitors] of competitorMap.entries()) {
      const dominant = competitors.find(c => c.mean_score >= 6.0);  // Changed from 0.6 to 6.0
      if (dominant) {
        if (!competitorDominance.has(dominant.brand_norm)) {
          competitorDominance.set(dominant.brand_norm, []);
        }
        competitorDominance.get(dominant.brand_norm)!.push(promptId);
      }
    }

    for (const [competitor, promptIds] of competitorDominance.entries()) {
      if (promptIds.length >= 3) {
        const sourcePrompts = promptIds.slice(0, 3);
        const sourceRuns = sourcePrompts.flatMap(pid => 
          runsByPrompt.get(pid)?.slice(0, 2).map(r => r.id) || []
        );

        recommendations.push({
          kind: 'content',
          title: `Create "YourBrand vs ${competitor}" pillar page + 2 use-case variants`,
          rationale: `${competitor} dominates across ${promptIds.length} prompts with 60%+ average visibility. Direct comparison content needed.`,
          steps: [
            "Write the pillar, then add sections targeting top use-cases where the competitor ranks.",
            "Link from homepage and relevant product pages.",
            "Share a short thread addressing key buying questions."
          ],
          estLift: 0.12,
          sourcePromptIds: sourcePrompts,
          sourceRunIds: sourceRuns,
          citations: [],
          cooldownDays: 30
        });
      }
    }

    // R3: Citations opportunity  
    const frequentCitations = Array.from(citationFreq.entries())
      .filter(([url, data]) => url.startsWith('http') && data.count >= 3 && data.prompts.size >= 2)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 3);

    for (const [citation, data] of frequentCitations) {
      recommendations.push({
        kind: 'site',
        title: `Add an Evidence/Resources page referencing ${new URL(citation).hostname}`,
        rationale: `URL "${citation}" appears in ${data.count} AI responses across ${data.prompts.size} different prompts. High-authority source worth referencing.`,
        steps: [
          "Curate the 3–5 most-cited resources into a single page.",
          "Add concise summaries and link them from related articles.",
          "Mark up with 'Article' schema."
        ],
        estLift: 0.07,
        sourcePromptIds: Array.from(data.prompts),
        sourceRunIds: data.runs.slice(0, 8),
        citations: [{type: 'url', value: citation}],
        cooldownDays: 14
      });
    }

    // R4: Visibility drop WoW on head prompt (>20%)
    // Get runs from last 6 days and split into two 3-day periods
    const sixDaysAgo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000);
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

    const { data: recentVisibilityRuns } = await supabase
      .from('visibility_results')
      .select(`
        score,
        prompt_runs!inner(prompt_id, run_at, prompts!inner(text, org_id))
      `)
      .eq('prompt_runs.prompts.org_id', accountId)
      .gte('prompt_runs.run_at', sixDaysAgo.toISOString())
      .in('prompt_runs.status', ['success', 'completed']);

    if (recentVisibilityRuns) {
      const scoresByPrompt = new Map<string, {recent: number[], older: number[], text: string}>();
      
      recentVisibilityRuns.forEach((result: any) => {
        const promptId = result.prompt_runs.prompt_id;
        const runDate = new Date(result.prompt_runs.run_at);
        const promptText = result.prompt_runs.prompts.text;
        
        if (!scoresByPrompt.has(promptId)) {
          scoresByPrompt.set(promptId, {recent: [], older: [], text: promptText});
        }
        
        const scores = scoresByPrompt.get(promptId)!;
        if (runDate >= threeDaysAgo) {
          scores.recent.push(result.score);
        } else {
          scores.older.push(result.score);
        }
      });

      for (const [promptId, {recent, older, text}] of scoresByPrompt.entries()) {
        if (recent.length > 0 && older.length > 0 && isHeadPrompt(text)) {
          const recentAvg = recent.reduce((sum, s) => sum + s, 0) / recent.length;
          const olderAvg = older.reduce((sum, s) => sum + s, 0) / older.length;
          const dropPercent = (olderAvg - recentAvg) / olderAvg;
          
          if (dropPercent > 0.2) { // >20% drop
            const runs = runsByPrompt.get(promptId) || [];
            
            recommendations.push({
              kind: 'social',
              title: `Publish a fast-answer thread for "${text.slice(0, 40)}..."`,
              rationale: `Visibility dropped ${(dropPercent * 100).toFixed(1)}% in recent days (${recentAvg.toFixed(1)} vs ${olderAvg.toFixed(1)} average score). Quick social response needed.`,
              steps: [
                "Post a 4–6 bullet answer with one proof stat.",
                "Link to the optimized guide or comparison page.",
                "Pin for 48 hours; reshare once."
              ],
              estLift: 0.05,
              sourcePromptIds: [promptId],
              sourceRunIds: runs.slice(0, 3).map(r => r.id),
              citations: [],
              cooldownDays: 7
            });
          }
        }
      }
    }

    // R5: Prompt coverage gap + adjacency (adjusted threshold)
    const lowPrompts = promptVisibility.filter(p => p.avg_score_7d < 6.0 && p.runs_7d >= 2);  // Changed from 0.3 to 6.0
    
    for (const lowPrompt of lowPrompts) {
      // Extract head keywords (first 2-3 significant words)
      const headKeywords = lowPrompt.text.toLowerCase()
        .split(/\s+/)
        .filter(word => word.length > 3 && !['best', 'top', 'compare', 'vs', 'versus', 'alternative'].includes(word))
        .slice(0, 3);
      
      if (headKeywords.length === 0) continue;
      
      // Find adjacent prompts with same head keywords but better performance
      const adjacentPrompts = promptVisibility.filter(other => {
        if (other.prompt_id === lowPrompt.prompt_id) return false;
        if (other.avg_score_7d < 7.0) return false;  // Changed from 0.4 to 7.0
        
        const otherKeywords = other.text.toLowerCase().split(/\s+/);
        return headKeywords.some(kw => otherKeywords.includes(kw));
      });

      if (adjacentPrompts.length > 0) {
        const avgAdjacentScore = adjacentPrompts.reduce((sum, p) => sum + p.avg_score_7d, 0) / adjacentPrompts.length;
        const suggestedVariant = `${lowPrompt.text} + use case modifier`;
        const runs = runsByPrompt.get(lowPrompt.prompt_id) || [];

        recommendations.push({
          kind: 'prompt',
          title: `Add a variant to track: "${suggestedVariant.slice(0, 50)}..."`,
          rationale: `Low performance (${(lowPrompt.avg_score_7d * 100).toFixed(1)}%) but similar prompts succeed (avg ${(avgAdjacentScore * 100).toFixed(1)}%). Coverage gap detected.`,
          steps: [
            "Add prompt variant including the missing modifier.",
            "Monitor for 7 days; if lift >10%, keep; otherwise rotate."
          ],
          estLift: 0.05,
          sourcePromptIds: [lowPrompt.prompt_id, ...adjacentPrompts.slice(0, 2).map(p => p.prompt_id)],
          sourceRunIds: runs.slice(0, 3).map(r => r.id),
          citations: [],
          cooldownDays: 14
        });
      }
    }

  } catch (error) {
    console.error('Error building recommendations:', error);
  }

  return recommendations;
}