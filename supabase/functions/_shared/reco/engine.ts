/**
 * Enhanced recommendation engine for generating actionable insights from visibility data
 */

import { 
  analyzeContentGaps, 
  analyzeSEOOpportunities, 
  analyzeSocialOpportunities, 
  analyzePartnershipOpportunities, 
  analyzeEmailOpportunities,
  generateFallbackRecommendations 
} from './enhanced-generators.ts';

export type Reco = {
  kind: 'content' | 'social' | 'site' | 'prompt';
  title: string;
  rationale: string;
  steps: string[];         // 6-10 detailed steps
  estLift: number;         // 0..1
  sourcePromptIds: string[];
  sourceRunIds: string[];
  citations: Array<{type: 'url' | 'ref', value: string}>;
  cooldownDays?: number;   // default 14
  timeline?: string;       // implementation timeline
  resources?: string;      // required resources/roles
  expectedImpact?: string; // expected impact description
  kpis?: string[];        // key performance indicators
  topic_key?: string;     // for deduplication
  batch_id?: string;      // for tracking
};

interface PromptVisibility {
  prompt_id: string;
  text: string;
  runs_7d: number;
  avg_score_7d: number;
}

interface CompetitorShare {
  prompt_id: string;
  competitor_name: string; // canonical name from RPC
  share: number;           // percentage share (0-100)
  total_mentions: number;  // absolute mentions count
}

interface RunData {
  id: string;
  prompt_id: string;
  citations: Array<{type: string, value: string}>;
  competitors: Array<{name: string, normalized: string, mentions: number}>;
  run_at?: string;
  prompt_text?: string;
}

export async function buildRecommendations(supabase: any, accountId: string, forceNew: boolean = false): Promise<Reco[]> {
  const recommendations: Reco[] = [];
  const batchId = `batch_${Date.now()}`;
  const cooldownDays = 14;

  try {
    // Get organization info for personalization
    const { data: orgInfo } = await supabase
      .from('organizations')
      .select('name, domain')
      .eq('id', accountId)
      .single();

    // 1) Pull inputs (last 7d) using secure functions
    const { data: promptVisibility } = await supabase.rpc('get_prompt_visibility_7d', {
      requesting_org_id: accountId
    });

    const { data: competitorShare } = await supabase.rpc('get_competitor_share_7d', {
      p_org_id: accountId
    });

    const { data: recentRuns } = await supabase
      .from('prompt_provider_responses')
      .select(`
        id,
        prompt_id,
        citations_json,
        competitors_json,
        run_at,
        prompts!inner(org_id, text)
      `)
      .eq('prompts.org_id', accountId)
      .gte('run_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .eq('status', 'success')
      .order('run_at', { ascending: false });

    // Get existing recommendations across ALL statuses for novelty detection
    const cooldownWindow = new Date(Date.now() - cooldownDays * 24 * 60 * 60 * 1000);
    const { data: existingRecos } = await supabase
      .from('recommendations')
      .select('title, type, created_at, metadata')
      .eq('org_id', accountId)
      .gte('created_at', cooldownWindow.toISOString());

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
        citations: run.citations_json || [],
        competitors: run.competitors_json || [],
        run_at: run.run_at,
        prompt_text: (run.prompts as any)?.text || ''
      });
    });

    // Collect citation frequency
    const citationFreq = new Map<string, {count: number, runs: string[], prompts: Set<string>}>();
    recentRuns.forEach(run => {
      const citations = run.citations_json || [];
      citations.forEach((citation: any) => {
        const url = typeof citation === 'string' ? citation : citation.link || citation.url || citation.value;
        if (url && !citationFreq.has(url)) {
          citationFreq.set(url, {count: 0, runs: [], prompts: new Set()});
        }
        if (url) {
          const freq = citationFreq.get(url)!;
          freq.count++;
          freq.runs.push(run.id);
          freq.prompts.add(run.prompt_id);
        }
      });
    });

    // Helper functions
    const HEAD_INTENTS = [/best/i, /compare|vs/i, /alternatives?/i];
    const isHeadPrompt = (txt: string) => HEAD_INTENTS.some(r => r.test(txt));
    
    // Generate topic key for deduplication
    const generateTopicKey = (kind: string, title: string, promptIds: string[], competitors: string[] = []): string => {
      const normalizedTitle = title.toLowerCase().replace(/[^\w\s]/g, '').split(' ').slice(0, 5).join('_');
      const promptKey = promptIds.slice(0, 3).sort().join('_');
      const competitorKey = competitors.slice(0, 2).sort().join('_');
      return `${kind}_${normalizedTitle}_${promptKey}_${competitorKey}`.substring(0, 100);
    };

    // Extract existing topic keys within cooldown window
    const existingTopicKeys = new Set();
    (existingRecos || []).forEach(existing => {
      if (existing.metadata?.topic_key) {
        existingTopicKeys.add(existing.metadata.topic_key);
      }
      // Also generate legacy topic keys for old recommendations without topic_key
      if (!existing.metadata?.topic_key) {
        const legacyKey = generateTopicKey(existing.type, existing.title, [], []);
        existingTopicKeys.add(legacyKey);
      }
    });

    // Check if recommendation is novel (not in cooldown)
    const isNovel = (topicKey: string): boolean => {
      return forceNew || !existingTopicKeys.has(topicKey);
    };

    // Novelty bias: shuffle candidates with timestamp seed for different results on consecutive runs
    const shuffleWithSeed = <T>(array: T[]): T[] => {
      const shuffled = [...array];
      const seed = Math.floor(Date.now() / (1000 * 60 * 10)); // Changes every 10 minutes
      let random = seed;
      for (let i = shuffled.length - 1; i > 0; i--) {
        random = (random * 9301 + 49297) % 233280; // Linear congruential generator
        const j = Math.floor((random / 233280) * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return shuffled;
    };

    // 3) Build candidate pool by category for diversity enforcement
    const candidatesByCategory = {
      content: [] as Reco[],
      site: [] as Reco[],
      social: [] as Reco[],
      prompt: [] as Reco[]
    };

    // R1: Missing presence on head prompts (adjusted threshold)
    const headPrompts = shuffleWithSeed(promptVisibility.filter(p => 
      p.avg_score_7d < 5.0 && isHeadPrompt(p.text)
    )).slice(0, 5); // Limit for performance

    for (const prompt of headPrompts) {
      const title = `Create comprehensive comparison guide: "${prompt.text.slice(0, 40)}..."`;
      const competitors = competitorMap.get(prompt.prompt_id) || [];
      const topCompetitor = competitors.sort((a, b) => (b.total_mentions - a.total_mentions) || (b.share - a.share))[0];
      const runs = runsByPrompt.get(prompt.prompt_id) || [];
      const topCitations = runs.flatMap(r => r.citations).slice(0, 3);
      const topicKey = generateTopicKey('content', title, [prompt.prompt_id], [topCompetitor?.competitor_name || '']);

      if (!isNovel(topicKey)) continue;

      candidatesByCategory.content.push({
        kind: 'content',
        title,
        rationale: `Critical visibility gap: only ${(prompt.avg_score_7d * 100).toFixed(1)}% visibility on high-intent query. ${topCompetitor ? `${topCompetitor.competitor_name} dominates with superior content positioning.` : 'Competitors dominate through better content strategy.'}`,
        steps: [
          "Research competitor positioning and identify content gaps in comparison landscape",
          "Create comprehensive comparison page with detailed feature matrix, pricing analysis, and use case scenarios",
          "Add FAQ schema markup targeting specific buyer questions and objections", 
          "Include 3-5 customer testimonials with specific ROI metrics and implementation timelines",
          "Build internal link network from product pages, case studies, and pricing page",
          "Create retargeting campaigns for comparison page visitors with demo/trial CTAs",
          `Optimize for target keywords: ${prompt.text.split(' ').slice(0, 3).join(' ')}, comparison, alternative, vs [competitor]`,
          "Set up conversion tracking to measure impact on sales pipeline and demo requests"
        ],
        estLift: 0.18,
        sourcePromptIds: [prompt.prompt_id],
        sourceRunIds: runs.slice(0, 5).map(r => r.id),
        citations: topCitations,
        cooldownDays: 21,
        timeline: "3-4 weeks (1 week research, 2 weeks content creation, 1 week optimization)",
        resources: "Content strategist, product marketing manager, customer success (for testimonials)",
        expectedImpact: "15-25% improvement in conversion rate for comparison-seeking prospects",
        kpis: ["Organic traffic to comparison pages", "Demo conversion rate", "Sales pipeline velocity", "Competitive win rate"],
        topic_key: topicKey,
        batch_id: batchId
      });
    }

    // R2: Competitor dominance opportunities
    const competitorDominance = new Map<string, string[]>();
    for (const [promptId, competitors] of competitorMap.entries()) {
      const dominant = competitors.find(c => c.share >= 40 || c.total_mentions >= 3);
      if (dominant) {
        if (!competitorDominance.has(dominant.competitor_name)) {
          competitorDominance.set(dominant.competitor_name, []);
        }
        competitorDominance.get(dominant.competitor_name)!.push(promptId);
      }
    }

    for (const [competitor, promptIds] of competitorDominance.entries()) {
      if (promptIds.length >= 2) {
        const title = `Develop "${orgInfo?.name || 'YourBrand'} vs ${competitor}" content strategy`;
        const sourcePrompts = promptIds.slice(0, 3);
        const sourceRuns = sourcePrompts.flatMap(pid => 
          runsByPrompt.get(pid)?.slice(0, 2).map(r => r.id) || []
        );
        const topicKey = generateTopicKey('content', title, sourcePrompts, [competitor]);

        if (!isNovel(topicKey)) continue;

        candidatesByCategory.content.push({
          kind: 'content',
          title,
          rationale: `${competitor} dominates ${promptIds.length} prompts with 60%+ visibility. Strategic competitive content needed to capture market share.`,
          steps: [
            `Conduct comprehensive competitive analysis of ${competitor}'s content strategy and positioning`,
            "Create detailed comparison pillar page with feature matrix, pricing analysis, and use case scenarios",
            "Develop 3-4 use-case specific comparison articles targeting different buyer personas",
            "Add customer testimonials highlighting specific advantages over competitor",
            "Build retargeting campaigns for visitors who engage with competitive content",
            "Create sales enablement materials including battlecards and objection handling guides",
            "Set up conversion tracking to measure competitive win rate improvements",
            "Establish ongoing monitoring of competitor mentions and response opportunities"
          ],
          estLift: 0.20,
          sourcePromptIds: sourcePrompts,
          sourceRunIds: sourceRuns,
          citations: [],
          cooldownDays: 30,
          timeline: "4-6 weeks (1 week competitive research, 3 weeks content creation, 2 weeks optimization)",
          resources: "Product marketing, competitive intelligence, sales team input, customer success",
          expectedImpact: "15-25% improvement in competitive deal win rate and faster sales cycles",
          kpis: ["Competitive content engagement", "Demo conversion rate", "Sales cycle velocity", "Win rate vs specific competitor"],
          topic_key: topicKey,
          batch_id: batchId
        });
      }
    }

    // R3: Citation opportunities (site category)
    const frequentCitations = Array.from(citationFreq.entries())
      .filter(([url, data]) => url.startsWith('http') && data.count >= 3 && data.prompts.size >= 2)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 4);

    for (const [citation, data] of frequentCitations) {
      const title = `Create authoritative resource hub replacing ${new URL(citation).hostname} dependencies`;
      const topicKey = generateTopicKey('site', title, Array.from(data.prompts).slice(0, 3), []);

      if (!isNovel(topicKey)) continue;

      candidatesByCategory.site.push({
        kind: 'site',
        title,
        rationale: `External source "${new URL(citation).hostname}" cited in ${data.count} AI responses across ${data.prompts.size} prompts. Opportunity to capture this authority internally.`,
        steps: [
          "Analyze the frequently-cited external content to understand why it's being referenced",
          "Create comprehensive internal resource that covers the same topics with added expertise",
          "Add original data, case studies, and expert insights not available in external source",
          "Implement structured data markup (Article, FAQ, How-To) for better AI visibility",
          "Update existing content to link to new authoritative resource instead of external sources",
          "Create downloadable assets and tools to increase engagement and sharing",
          "Set up tracking to monitor citation changes and organic traffic improvements",
          "Establish content update schedule to maintain authority and freshness"
        ],
        estLift: 0.15,
        sourcePromptIds: Array.from(data.prompts).slice(0, 4),
        sourceRunIds: data.runs.slice(0, 8),
        citations: [{type: 'url', value: citation}],
        cooldownDays: 28,
        timeline: "5-7 weeks (2 weeks research and analysis, 3-4 weeks content creation, 1 week technical implementation)",
        resources: "Content strategist, subject matter expert, technical writer, SEO specialist",
        expectedImpact: "10-20% increase in organic authority and 25-35% improvement in related query visibility",
        kpis: ["Citation frequency in AI responses", "Organic traffic growth", "Page authority metrics", "Content engagement"],
        topic_key: topicKey,
        batch_id: batchId
      });
    }

    // R4: Visibility drop opportunities (social category)
    const sixDaysAgo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000);
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

    const { data: recentVisibilityRuns } = await supabase
      .from('prompt_provider_responses')
      .select(`
        score,
        prompt_id,
        run_at,
        prompts!inner(text, org_id)
      `)
      .eq('prompts.org_id', accountId)
      .gte('run_at', sixDaysAgo.toISOString())
      .eq('status', 'success');

    if (recentVisibilityRuns) {
      const scoresByPrompt = new Map<string, {recent: number[], older: number[], text: string}>();
      
      recentVisibilityRuns.forEach((result: any) => {
        const promptId = result.prompt_id;
        const runDate = new Date(result.run_at);
        const promptText = result.prompts.text;
        
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
            const title = `Launch urgent social response campaign for "${text.slice(0, 35)}..." visibility drop`;
            const runs = runsByPrompt.get(promptId) || [];
            const topicKey = generateTopicKey('social', title, [promptId], []);

            if (!isNovel(topicKey)) continue;
            
            candidatesByCategory.social.push({
              kind: 'social',
              title,
              rationale: `Critical visibility drop: ${(dropPercent * 100).toFixed(1)}% decline in recent days (${recentAvg.toFixed(1)} vs ${olderAvg.toFixed(1)}). Immediate social engagement needed.`,
              steps: [
                "Create urgent 5-7 tweet thread addressing the query with authoritative insights",
                "Include 1-2 compelling data points or customer success metrics",
                "Tag relevant industry leaders and potential amplifiers in the space",
                "Cross-post adapted version to LinkedIn with professional insights and call-to-action",
                "Engage actively with replies and retweet relevant responses for 48 hours",
                "Pin the thread to profile and reshare at optimal engagement times",
                "Monitor social signals and mentions to track immediate impact on visibility",
                "Follow up with detailed blog post or resource if thread gains significant traction"
              ],
              estLift: 0.08,
              sourcePromptIds: [promptId],
              sourceRunIds: runs.slice(0, 3).map(r => r.id),
              citations: [],
              cooldownDays: 7,
              timeline: "48-72 hours immediate response, 1 week monitoring and optimization",
              resources: "Social media manager, subject matter expert for content validation",
              expectedImpact: "5-12% recovery in visibility within 1 week, increased social engagement",
              kpis: ["Social engagement metrics", "Visibility score recovery", "Website traffic from social", "Brand mention frequency"],
              topic_key: topicKey,
              batch_id: batchId
            });
          }
        }
      }
    }

    // R5: Enhanced content gaps from generators
    const contentGaps = analyzeContentGaps(promptVisibility, runsByPrompt, orgInfo);
    for (const gap of contentGaps) {
      const topicKey = generateTopicKey(gap.kind, gap.title, gap.sourcePromptIds, []);
      if (!isNovel(topicKey)) continue;
      
      candidatesByCategory[gap.kind as keyof typeof candidatesByCategory].push({
        ...gap,
        topic_key: topicKey,
        batch_id: batchId
      });
    }

    // R6: SEO opportunities from generators
    const seoOpportunities = analyzeSEOOpportunities(promptVisibility, runsByPrompt, citationFreq, orgInfo);
    for (const seo of seoOpportunities) {
      const topicKey = generateTopicKey(seo.kind, seo.title, seo.sourcePromptIds, []);
      if (!isNovel(topicKey)) continue;
      
      candidatesByCategory[seo.kind as keyof typeof candidatesByCategory].push({
        ...seo,
        topic_key: topicKey,
        batch_id: batchId
      });
    }

    // R7: Social opportunities from generators
    const socialOpportunities = analyzeSocialOpportunities(promptVisibility, competitorMap, orgInfo);
    for (const social of socialOpportunities) {
      const topicKey = generateTopicKey(social.kind, social.title, social.sourcePromptIds, []);
      if (!isNovel(topicKey)) continue;
      
      candidatesByCategory[social.kind as keyof typeof candidatesByCategory].push({
        ...social,
        topic_key: topicKey,
        batch_id: batchId
      });
    }

    // R8: Partnership opportunities from generators
    const partnershipOpps = analyzePartnershipOpportunities(citationFreq, competitorMap, orgInfo);
    for (const partnership of partnershipOpps) {
      const topicKey = generateTopicKey(partnership.kind, partnership.title, partnership.sourcePromptIds, []);
      if (!isNovel(topicKey)) continue;
      
      candidatesByCategory[partnership.kind as keyof typeof candidatesByCategory].push({
        ...partnership,
        topic_key: topicKey,
        batch_id: batchId
      });
    }

    // R9: Email opportunities from generators  
    const emailOpportunities = analyzeEmailOpportunities(promptVisibility, runsByPrompt, orgInfo);
    for (const email of emailOpportunities) {
      const topicKey = generateTopicKey(email.kind, email.title, email.sourcePromptIds, []);
      if (!isNovel(topicKey)) continue;
      
      candidatesByCategory[email.kind as keyof typeof candidatesByCategory].push({
        ...email,
        topic_key: topicKey,
        batch_id: batchId
      });
    }

    // 4) Enforce category diversity with round-robin selection
    const targetMix = { content: 5, site: 3, social: 3, prompt: 2 }; // Target distribution
    const selectedRecos: Reco[] = [];

    // Round-robin selection to ensure diversity
    const categories = Object.keys(targetMix) as Array<keyof typeof candidatesByCategory>;
    let totalSelected = 0;
    
    while (totalSelected < 13 && categories.some(cat => candidatesByCategory[cat].length > 0)) {
      for (const category of categories) {
        const candidates = candidatesByCategory[category];
        const target = targetMix[category];
        const currentCount = selectedRecos.filter(r => r.kind === category).length;
        
        if (candidates.length > 0 && currentCount < target) {
          const selected = candidates.shift()!;
          selectedRecos.push(selected);
          totalSelected++;
          
          if (totalSelected >= 13) break;
        }
      }
    }

    // Fill remaining slots with highest-lift candidates from any category
    while (totalSelected < 15) {
      const allRemaining = Object.values(candidatesByCategory).flat()
        .sort((a, b) => b.estLift - a.estLift);
      
      if (allRemaining.length === 0) break;
      
      const next = allRemaining[0];
      selectedRecos.push(next);
      
      // Remove from candidate pool
      const category = next.kind;
      const index = candidatesByCategory[category].findIndex(r => r.topic_key === next.topic_key);
      if (index >= 0) {
        candidatesByCategory[category].splice(index, 1);
      }
      
      totalSelected++;
    }

    // Add novelty-based fallbacks if still under minimum
    if (selectedRecos.length < 8) {
      const fallbacks = generateFallbackRecommendations(promptVisibility, orgInfo, 8 - selectedRecos.length, batchId);
      for (const fallback of fallbacks) {
        if (isNovel(fallback.topic_key!)) {
          selectedRecos.push(fallback);
        }
      }
    }

    recommendations.push(...selectedRecos);
    
    console.log(`[buildRecommendations] Generated ${recommendations.length} recommendations with category distribution:`, 
      categories.reduce((acc, cat) => ({ ...acc, [cat]: recommendations.filter(r => r.kind === cat).length }), {}));

  } catch (error) {
    console.error('Error building recommendations:', error);
  }

  // Sort by estimated lift (highest first) and limit to top 15
  return recommendations
    .sort((a, b) => b.estLift - a.estLift)
    .slice(0, 15);
}