/**
 * Enhanced recommendation generators for diverse content types
 */

import { Reco } from './engine.ts';

interface PromptVisibility {
  prompt_id: string;
  text: string;
  runs_7d: number;
  avg_score_7d: number;
}

interface RunData {
  id: string;
  prompt_id: string;
  citations: Array<{type: string, value: string}>;
  competitors: Array<{name: string, normalized: string, mentions: number}>;
  run_at?: string;
  prompt_text?: string;
}

interface CompetitorShare {
  prompt_id: string;
  competitor_name: string; // canonical name from RPC
  share: number;           // percentage share (0-100) 
  total_mentions: number;  // absolute mentions count
}

interface OrgInfo {
  name?: string;
  domain?: string;
}

export function analyzeContentGaps(
  promptVisibility: PromptVisibility[], 
  runsByPrompt: Map<string, RunData[]>, 
  orgInfo?: OrgInfo
): Reco[] {
  const recommendations: Reco[] = [];
  
  // Analyze missing content formats
  const formatAnalysis = {
    tutorials: promptVisibility.filter((p: PromptVisibility) => /how to|tutorial|guide/i.test(p.text) && p.avg_score_7d < 4),
    reviews: promptVisibility.filter((p: PromptVisibility) => /review|rating|opinion/i.test(p.text) && p.avg_score_7d < 4),
    casestudies: promptVisibility.filter((p: PromptVisibility) => /case study|success story|example/i.test(p.text) && p.avg_score_7d < 4),
    faqs: promptVisibility.filter((p: PromptVisibility) => /faq|question|help|support/i.test(p.text) && p.avg_score_7d < 4)
  };

  // Tutorial/Guide content gap
  if (formatAnalysis.tutorials.length >= 2) {
    const topTutorials = formatAnalysis.tutorials.slice(0, 3);
    const sourceRuns = topTutorials.flatMap((t: any) => runsByPrompt.get(t.prompt_id)?.slice(0, 2).map((r: any) => r.id) || []);
    
    recommendations.push({
      kind: 'content',
      title: `Create comprehensive tutorial series addressing ${topTutorials.length} how-to queries`,
      rationale: `Multiple tutorial-seeking queries show low visibility (avg ${(topTutorials.reduce((sum, t) => sum + t.avg_score_7d, 0) / topTutorials.length * 100).toFixed(1)}%). Educational content gap detected.`,
      steps: [
        "Create 3-5 step-by-step tutorials covering identified gaps",
        "Include screenshots, code examples, or video walkthroughs",
        "Add FAQ section for each tutorial",
        "Cross-link tutorials in a learning path",
        "Optimize for featured snippets with structured markup"
      ],
      estLift: 0.08,
      sourcePromptIds: topTutorials.map((t: any) => t.prompt_id),
      sourceRunIds: sourceRuns,
      citations: [],
      cooldownDays: 21
    });
  }

  // Review/Rating content gap
  if (formatAnalysis.reviews.length >= 1) {
    const review = formatAnalysis.reviews[0];
    const runs = runsByPrompt.get(review.prompt_id) || [];
    
    recommendations.push({
      kind: 'content',  
      title: `Publish authentic customer review collection page`,
      rationale: `Review-seeking queries underperforming (${(review.avg_score_7d * 100).toFixed(1)}% visibility). Trust signals needed.`,
      steps: [
        "Collect 10-15 detailed customer reviews with specific outcomes",
        "Include reviewer photos, company names, and use cases",
        "Add star ratings schema markup",
        "Create review summary with key themes",
        "Link from product pages and testimonials"
      ],
      estLift: 0.07,
      sourcePromptIds: [review.prompt_id],
      sourceRunIds: runs.slice(0, 3).map((r: any) => r.id),
      citations: [],
      cooldownDays: 30
    });
  }

  return recommendations;
}

export function analyzeSEOOpportunities(
  promptVisibility: PromptVisibility[],
  runsByPrompt: Map<string, RunData[]>,
  citationFreq: Map<string, {count: number, runs: string[], prompts: Set<string>}>,
  orgInfo?: OrgInfo
): Reco[] {
  const recommendations: Reco[] = [];

  // Schema markup opportunity
  const structuredDataOpps = promptVisibility.filter((p: PromptVisibility) => 
    /faq|question|price|review|compare/i.test(p.text) && p.avg_score_7d < 6
  );

  if (structuredDataOpps.length >= 2) {
    const topOpps = structuredDataOpps.slice(0, 3);
    const sourceRuns = topOpps.flatMap((o: PromptVisibility) => runsByPrompt.get(o.prompt_id)?.slice(0, 2).map((r: any) => r.id) || []);

    recommendations.push({
      kind: 'site',
      title: `Implement structured data markup for ${topOpps.length} underperforming pages`,
      rationale: `FAQ, pricing, and comparison queries showing low AI visibility. Rich snippets could improve mentions.`,
      steps: [
        "Add FAQ schema to question-based content",
        "Implement Product schema on comparison pages", 
        "Add Review schema to customer testimonials",
        "Test with Google's Rich Results Test",
        "Monitor for featured snippet improvements"
      ],
      estLift: 0.09,
      sourcePromptIds: topOpps.map((o: PromptVisibility) => o.prompt_id),
      sourceRunIds: sourceRuns,
      citations: [],
      cooldownDays: 14
    });
  }

  // Internal linking opportunity
  const linkingOpportunity = Array.from(citationFreq.entries())
    .filter(([url, data]: [string, any]) => !url.includes(orgInfo?.domain || 'yourdomain') && data.prompts.size >= 3)
    .slice(0, 1);

  if (linkingOpportunity.length > 0) {
    const [externalUrl, data] = linkingOpportunity[0];
    
    recommendations.push({
      kind: 'site',
      title: `Create internal content hub to replace external citation dependencies`,
      rationale: `External source "${new URL(externalUrl).hostname}" cited across ${data.prompts.size} prompts. Opportunity to capture this traffic internally.`,
      steps: [
        "Analyze the external content being cited",
        "Create comprehensive internal resource covering same topics", 
        "Add expert insights and original data",
        "Update existing content to link to new resource",
        "Submit for indexing and monitor citation changes"
      ],
      estLift: 0.11,
      sourcePromptIds: Array.from(data.prompts),
      sourceRunIds: data.runs.slice(0, 5),
      citations: [{type: 'url', value: externalUrl}],
      cooldownDays: 28
    });
  }

  return recommendations;
}

export function analyzeSocialOpportunities(
  promptVisibility: PromptVisibility[],
  competitorMap: Map<string, CompetitorShare[]>,
  orgInfo?: OrgInfo
): Reco[] {
  const recommendations: Reco[] = [];

  // Trending topic social opportunity
  const trendingPrompts = promptVisibility
    .filter((p: PromptVisibility) => p.runs_7d >= 3 && p.avg_score_7d < 5)
    .sort((a: PromptVisibility, b: PromptVisibility) => b.runs_7d - a.runs_7d)
    .slice(0, 2);

  for (const prompt of trendingPrompts) {
    recommendations.push({
      kind: 'social',
      title: `Launch Twitter/LinkedIn thread series on "${prompt.text.slice(0, 40)}..."`,
      rationale: `High-frequency query (${prompt.runs_7d} runs in 7 days) with low visibility (${(prompt.avg_score_7d * 100).toFixed(1)}%). Social engagement opportunity.`,
      steps: [
        "Create 5-7 tweet thread with key insights and takeaways",
        "Include 1-2 data points or customer examples", 
        "Add relevant hashtags and tag industry leaders",
        "Engage with replies and retweet responses",
        "Cross-post adapted version to LinkedIn"
      ],
      estLift: 0.04,
      sourcePromptIds: [prompt.prompt_id],
      sourceRunIds: [],
      citations: [],
      cooldownDays: 7
    });
  }

  // Video content opportunity
  const visualPrompts = promptVisibility.filter((p: PromptVisibility) => 
    /demo|tutorial|example|show|how/i.test(p.text) && p.avg_score_7d < 5
  );

  if (visualPrompts.length >= 1) {
    const prompt = visualPrompts[0];
    
    recommendations.push({
      kind: 'social',
      title: `Create short-form video content for "${prompt.text.slice(0, 40)}..."`,
      rationale: `Visual query with low visibility (${(prompt.avg_score_7d * 100).toFixed(1)}%). Video format could capture attention.`,
      steps: [
        "Create 60-90 second demo or tutorial video",
        "Post to LinkedIn, Twitter, and YouTube Shorts",
        "Include clear call-to-action to full content",
        "Add captions for accessibility",
        "Embed video in related blog posts"
      ],
      estLift: 0.06,
      sourcePromptIds: [prompt.prompt_id],
      sourceRunIds: [],
      citations: [],
      cooldownDays: 14
    });
  }

  return recommendations;
}

export function analyzePartnershipOpportunities(
  citationFreq: Map<string, {count: number, runs: string[], prompts: Set<string>}>,
  competitorMap: Map<string, CompetitorShare[]>,
  orgInfo?: OrgInfo
): Reco[] {
  const recommendations: Reco[] = [];

  // Find complementary tool opportunities
  const toolCitations = Array.from(citationFreq.entries())
    .filter(([url, data]) => {
      try {
        const hostname = new URL(url).hostname;
        return !hostname.includes('wikipedia') && 
               !hostname.includes('github') &&
               data.count >= 2 && 
               data.prompts.size >= 2;
      } catch {
        return false;
      }
    })
    .slice(0, 2);

  for (const [url, data] of toolCitations) {
    const hostname = new URL(url).hostname;
    
    recommendations.push({
      kind: 'content',
      title: `Create integration guide with ${hostname} (partnership opportunity)`,
      rationale: `${hostname} frequently cited across ${data.prompts.size} prompts. Integration content could capture mutual interest.`,
      steps: [
        `Reach out to ${hostname} for partnership discussion`,
        "Create detailed integration tutorial or case study",
        "Include mutual testimonials or quotes",
        "Cross-promote on both platforms",
        "Track referral traffic and mentions"
      ],
      estLift: 0.08,
      sourcePromptIds: Array.from(data.prompts),
      sourceRunIds: data.runs.slice(0, 4),
      citations: [{type: 'url', value: url}],
      cooldownDays: 45
    });
  }

  return recommendations;
}

export function analyzeEmailOpportunities(
  promptVisibility: PromptVisibility[],
  runsByPrompt: Map<string, RunData[]>,
  orgInfo?: OrgInfo
): Reco[] {
  const recommendations: Reco[] = [];

  // Email sequence based on customer journey prompts
  const journeyPrompts = {
    awareness: promptVisibility.filter((p: PromptVisibility) => /what is|introduction|basics|overview/i.test(p.text)),
    consideration: promptVisibility.filter((p: PromptVisibility) => /compare|vs|alternative|best/i.test(p.text)),
    decision: promptVisibility.filter((p: PromptVisibility) => /pricing|cost|demo|trial/i.test(p.text))
  };

  const totalJourneyPrompts = Object.values(journeyPrompts).flat().length;
  
  if (totalJourneyPrompts >= 3) {
    const samplePrompts = [
      ...journeyPrompts.awareness.slice(0, 1),
      ...journeyPrompts.consideration.slice(0, 1), 
      ...journeyPrompts.decision.slice(0, 1)
    ];

    recommendations.push({
      kind: 'content',
      title: `Design 5-email nurture sequence targeting AI search journey`,
      rationale: `${totalJourneyPrompts} prompts span customer journey stages. Email sequence could nurture prospects through decision process.`,
      steps: [
        "Map email content to awareness → consideration → decision prompts",
        "Include AI-cited content and social proof in each email",
        "Add progressive calls-to-action (guide → demo → trial)",
        "Set up behavioral triggers based on content engagement",
        "Track email → website → conversion flow"
      ],
      estLift: 0.06,
      sourcePromptIds: samplePrompts.map((p: PromptVisibility) => p.prompt_id),
      sourceRunIds: [],
      citations: [],
      cooldownDays: 30
    });
  }

  return recommendations;
}

export function generateFallbackRecommendations(
  promptVisibility: PromptVisibility[],
  count: number,
  orgInfo?: OrgInfo,
  batchId?: string
): Reco[] {
  const recommendations: Reco[] = [];
  const orgName = orgInfo?.name || 'YourBrand';

  const fallbacks = [
    {
      kind: 'content' as const,
      title: `Create "${orgName} Ultimate Guide" comprehensive resource`,
      rationale: `Comprehensive pillar content can capture long-tail queries and establish topical authority.`,
      steps: [
        "Audit existing content and identify the top 10 most-visited, highest-converting pieces",
        "Consolidate into comprehensive 8,000+ word pillar page with clear navigation and section anchors",
        "Add new sections covering identified knowledge gaps and frequently asked questions",
        "Create 5-7 downloadable resources: templates, checklists, worksheets, implementation guides",
        "Build internal linking hub connecting to all related product pages, case studies, and blog posts",
        "Implement advanced schema markup (FAQ, How-To, Article) for better AI visibility",
        "Set up conversion tracking and lead capture forms throughout the guide",
        "Create email nurture sequence for guide downloaders with progressive value delivery"
      ],
      estLift: 0.12,
      timeline: "4-6 weeks development + ongoing optimization",
      resources: "Content strategist, subject matter expert, designer (for downloadables)",
      expectedImpact: "20-30% increase in organic traffic and lead generation from long-tail queries",
      kpis: ["Organic sessions to guide", "Time on page", "Download conversion rate", "Email signup rate"]
    },
    {
      kind: 'site' as const,
      title: `Optimize site speed and Core Web Vitals for better AI crawling`,
      rationale: `Technical performance affects AI crawler ability to process content effectively.`,
      steps: [
        "Run PageSpeed Insights audit on key pages",
        "Optimize images and implement lazy loading", 
        "Reduce JavaScript bundle size",
        "Monitor crawl efficiency improvements"
      ],
      estLift: 0.05
    },
    {
      kind: 'social' as const,
      title: `Start weekly "AI Visibility Tips" social media series`,
      rationale: `Consistent social content can drive awareness and engagement around your expertise.`,
      steps: [
        "Create weekly tips based on your prompt performance data",
        "Include visual elements and actionable insights",
        "Engage with industry conversations",
        "Track social → website traffic flow"
      ],
      estLift: 0.04
    },
    {
      kind: 'content' as const,
      title: `Develop industry-specific case study collection`,
      rationale: `Case studies provide social proof and target specific industry use cases.`,
      steps: [
        "Interview 3-5 customers about specific outcomes",
        "Create detailed implementation stories",
        "Include metrics and ROI data",
        "Optimize for industry + use case queries"
      ],
      estLift: 0.08
    },
    {
      kind: 'site' as const,
      title: `Create comprehensive FAQ page addressing common queries`,
      rationale: `FAQ content often gets featured in AI responses and improves user experience.`,
      steps: [
        "Analyze support tickets and chat logs for common questions",
        "Structure answers for snippet optimization",
        "Add FAQ schema markup",
        "Link from relevant product pages"
      ],
      estLift: 0.06
    }
  ];

  for (let i = 0; i < Math.min(count, fallbacks.length); i++) {
    const fallback = fallbacks[i];
    const topicKey = `fallback_${fallback.kind}_${fallback.title.toLowerCase().replace(/[^\w]/g, '_').substring(0, 30)}`;
    recommendations.push({
      ...fallback,
      sourcePromptIds: promptVisibility.slice(0, 2).map((p: PromptVisibility) => p.prompt_id),
      sourceRunIds: [],
      citations: [],
      cooldownDays: 21,
      topic_key: topicKey,
      batch_id: batchId || `fallback_${Date.now()}`
    });
  }

  return recommendations;
}