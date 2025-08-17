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
        prompts!inner(org_id)
      `)
      .eq('prompts.org_id', accountId)
      .gte('run_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .eq('status', 'success')
      .order('run_at', { ascending: false });

    if (!promptVisibility || !competitorShare || !recentRuns) {
      return [];
    }

    // 2) Compute signals
    const promptMap = new Map(promptVisibility.map(p => [p.prompt_id, p]));
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
        competitors: run.competitors || []
      });
    });

    // Collect citation frequency
    const citationFreq = new Map<string, {count: number, runs: string[], prompts: Set<string>}>();
    recentRuns.forEach(run => {
      const citations = run.citations || [];
      citations.forEach(citation => {
        if (!citationFreq.has(citation.value)) {
          citationFreq.set(citation.value, {count: 0, runs: [], prompts: new Set()});
        }
        const freq = citationFreq.get(citation.value)!;
        freq.count++;
        freq.runs.push(run.id);
        freq.prompts.add(run.prompt_id);
      });
    });

    // 3) Apply heuristic rules

    // R1: Missing on comparison/alternatives prompts
    const lowVisibilityPrompts = promptVisibility.filter(p => 
      p.avg_score_7d < 0.2 && 
      (p.text.toLowerCase().includes('best') || 
       p.text.toLowerCase().includes('compare') || 
       p.text.toLowerCase().includes('alternatives') ||
       p.text.toLowerCase().includes('vs '))
    );

    for (const prompt of lowVisibilityPrompts) {
      const competitors = competitorMap.get(prompt.prompt_id) || [];
      const topCompetitor = competitors.sort((a, b) => b.mean_score - a.mean_score)[0];
      
      recommendations.push({
        kind: 'content',
        title: `Create comparison content for "${prompt.text.slice(0, 50)}..."`,
        rationale: `Low brand visibility (${(prompt.avg_score_7d * 100).toFixed(1)}%) on comparison query. ${topCompetitor ? `${topCompetitor.brand_norm} dominates with ${(topCompetitor.mean_score * 100).toFixed(1)}%` : 'Competitors have strong presence'}.`,
        steps: [
          'Research top competitors mentioned in AI responses for this query',
          'Create comprehensive comparison page highlighting your unique advantages',
          'Optimize page for the exact query phrasing used in the prompt',
          'Add internal links from related product pages to boost authority'
        ],
        estLift: Math.min(0.20, 0.05 + (0.2 - prompt.avg_score_7d)),
        sourcePromptIds: [prompt.prompt_id],
        sourceRunIds: runsByPrompt.get(prompt.prompt_id)?.slice(0, 5).map(r => r.id) || [],
        citations: [],
        cooldownDays: 21
      });
    }

    // R2: Competitor dominance across multiple prompts
    const dominantCompetitors = new Map<string, string[]>();
    for (const [promptId, competitors] of competitorMap.entries()) {
      const dominant = competitors.find(c => c.mean_score > 0.6);
      if (dominant) {
        if (!dominantCompetitors.has(dominant.brand_norm)) {
          dominantCompetitors.set(dominant.brand_norm, []);
        }
        dominantCompetitors.get(dominant.brand_norm)!.push(promptId);
      }
    }

    for (const [competitor, promptIds] of dominantCompetitors.entries()) {
      if (promptIds.length >= 3) {
        const sourcePrompts = promptIds.slice(0, 3);
        const sourceRuns = sourcePrompts.flatMap(pid => 
          runsByPrompt.get(pid)?.slice(0, 2).map(r => r.id) || []
        );

        recommendations.push({
          kind: 'content',
          title: `Create "Your Brand vs ${competitor}" content series`,
          rationale: `${competitor} dominates across ${promptIds.length} prompts with >60% average score. Need direct comparison content.`,
          steps: [
            `Research ${competitor}'s positioning and key differentiators`,
            'Create detailed comparison highlighting your advantages',
            'Develop supporting content addressing common objections',
            'Build internal linking strategy to boost comparison pages'
          ],
          estLift: 0.15,
          sourcePromptIds: sourcePrompts,
          sourceRunIds: sourceRuns,
          citations: [],
          cooldownDays: 30
        });
      }
    }

    // R3: Recurring citation URLs
    const frequentCitations = Array.from(citationFreq.entries())
      .filter(([_, data]) => data.count >= 3 && data.prompts.size >= 2)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5);

    for (const [citation, data] of frequentCitations) {
      if (citation.startsWith('http')) {
        recommendations.push({
          kind: 'site',
          title: `Add case study page referencing ${new URL(citation).hostname}`,
          rationale: `URL "${citation}" appears in ${data.count} AI responses across ${data.prompts.size} different prompts. High-authority source worth referencing.`,
          steps: [
            'Review the cited source for key insights and data points',
            'Create case study or evidence page incorporating the source',
            'Structure content to address the specific queries that cite this source',
            'Add internal links from relevant product/service pages'
          ],
          estLift: 0.08,
          sourcePromptIds: Array.from(data.prompts),
          sourceRunIds: data.runs.slice(0, 10),
          citations: [{type: 'url', value: citation}],
          cooldownDays: 14
        });
      }
    }

    // R4: Zero presence prompts with good adjacent performance
    const zeroPresencePrompts = promptVisibility.filter(p => p.avg_score_7d === 0 && p.runs_7d >= 3);
    
    for (const prompt of zeroPresencePrompts) {
      // Check if similar prompts (by word overlap) have good performance
      const similarPrompts = promptVisibility.filter(other => {
        if (other.prompt_id === prompt.prompt_id) return false;
        const words1 = new Set(prompt.text.toLowerCase().split(/\s+/).filter(w => w.length > 3));
        const words2 = new Set(other.text.toLowerCase().split(/\s+/).filter(w => w.length > 3));
        const intersection = new Set([...words1].filter(x => words2.has(x)));
        return intersection.size >= 2 && other.avg_score_7d > 0.4;
      });

      if (similarPrompts.length > 0) {
        recommendations.push({
          kind: 'prompt',
          title: `Track variant of zero-visibility prompt: "${prompt.text.slice(0, 40)}..."`,
          rationale: `No brand presence despite ${prompt.runs_7d} runs, but similar prompts perform well (avg ${(similarPrompts.reduce((sum, p) => sum + p.avg_score_7d, 0) / similarPrompts.length * 100).toFixed(1)}%).`,
          steps: [
            'Analyze why similar prompts succeed while this one fails',
            'Create content variant addressing this specific query angle',
            'Add tracking for modified prompt with use-case qualifiers',
            'Monitor performance and iterate based on results'
          ],
          estLift: 0.12,
          sourcePromptIds: [prompt.prompt_id, ...similarPrompts.slice(0, 2).map(p => p.prompt_id)],
          sourceRunIds: runsByPrompt.get(prompt.prompt_id)?.slice(0, 3).map(r => r.id) || [],
          citations: [],
          cooldownDays: 14
        });
      }
    }

    // R5: Social opportunity for declining performance
    // For now, add a simple declining performance check (would need historical data for proper WoW)
    const lowPerformingPrompts = promptVisibility.filter(p => 
      p.avg_score_7d < 0.3 && p.avg_score_7d > 0 && p.runs_7d >= 5
    );

    for (const prompt of lowPerformingPrompts.slice(0, 3)) {
      recommendations.push({
        kind: 'social',
        title: `Create social thread addressing: "${prompt.text.slice(0, 40)}..."`,
        rationale: `Below-average performance (${(prompt.avg_score_7d * 100).toFixed(1)}%) on active prompt with ${prompt.runs_7d} recent runs. Social content can drive traffic.`,
        steps: [
          'Draft concise thread directly answering the query',
          'Include your unique perspective or data point',
          'Link to optimized landing page in thread',
          'Schedule during peak audience hours'
        ],
        estLift: 0.06,
        sourcePromptIds: [prompt.prompt_id],
        sourceRunIds: runsByPrompt.get(prompt.prompt_id)?.slice(0, 3).map(r => r.id) || [],
        citations: [],
        cooldownDays: 7
      });
    }

  } catch (error) {
    console.error('Error building recommendations:', error);
  }

  return recommendations;
}