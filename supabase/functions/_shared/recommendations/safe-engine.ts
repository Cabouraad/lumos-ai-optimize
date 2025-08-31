/**
 * Safe Recommendations Engine - Heuristics-first with optional tiny-LLM
 * Idempotent per day, conservative recommendations
 * Enabled via FEATURE_SAFE_RECO flag
 */

import { createEdgeLogger } from '../observability/structured-logger.ts';

export interface SafeRecommendation {
  id: string;
  type: 'content' | 'seo' | 'social' | 'analysis';
  title: string;
  rationale: string;
  priority: 'low' | 'medium' | 'high';
  estimated_lift: number;
  confidence: number;
  source_data: any;
  implementation_steps: string[];
  created_date: string;
}

export interface RecommendationInput {
  orgId: string;
  promptVisibility: Array<{
    prompt_id: string;
    text: string;
    avg_score_7d: number;
    runs_7d: number;
    brand_visible_count: number;
    competitor_count: number;
  }>;
  competitorAnalysis: Array<{
    competitor: string;
    mention_count: number;
    prompt_coverage: number;
    avg_position: number;
  }>;
  citationData: Array<{
    url: string;
    citation_count: number;
    source_type: string;
  }>;
}

export class SafeRecommendationEngine {
  private supabase: any;
  private logger: any;
  private dailyCache = new Map<string, SafeRecommendation[]>();

  constructor(supabase: any, logger?: any) {
    this.supabase = supabase;
    this.logger = logger || createEdgeLogger('safe-reco-engine');
  }

  async generateRecommendations(input: RecommendationInput): Promise<SafeRecommendation[]> {
    const dateKey = new Date().toISOString().split('T')[0];
    const cacheKey = `${input.orgId}-${dateKey}`;

    // Idempotent per day - check cache first
    if (this.dailyCache.has(cacheKey)) {
      this.logger.info('Returning cached daily recommendations', { orgId: input.orgId, date: dateKey });
      return this.dailyCache.get(cacheKey)!;
    }

    // Check database for existing daily recommendations
    const existingRecos = await this.checkExistingDailyRecos(input.orgId, dateKey);
    if (existingRecos.length > 0) {
      this.dailyCache.set(cacheKey, existingRecos);
      return existingRecos;
    }

    this.logger.info('Generating new daily recommendations', { orgId: input.orgId, date: dateKey });

    // Generate recommendations using heuristics
    const recommendations = await this.runHeuristicEngine(input, dateKey);

    // Cache and persist
    this.dailyCache.set(cacheKey, recommendations);
    await this.persistRecommendations(input.orgId, recommendations);

    return recommendations;
  }

  private async checkExistingDailyRecos(orgId: string, date: string): Promise<SafeRecommendation[]> {
    try {
      const { data, error } = await this.supabase
        .from('recommendations')
        .select('*')
        .eq('org_id', orgId)
        .gte('created_at', `${date}T00:00:00.000Z`)
        .lt('created_at', `${date}T23:59:59.999Z`)
        .eq('status', 'open');

      if (error) throw error;

      return (data || []).map(this.mapDbToReco);
    } catch (error) {
      this.logger.warn('Failed to check existing recommendations', { orgId, date, error });
      return [];
    }
  }

  private async runHeuristicEngine(input: RecommendationInput, dateKey: string): Promise<SafeRecommendation[]> {
    const recommendations: SafeRecommendation[] = [];

    // H1: Low visibility prompts with high run frequency
    const lowVisibilityRecos = this.detectLowVisibilityPrompts(input, dateKey);
    recommendations.push(...lowVisibilityRecos);

    // H2: Dominant competitors requiring strategic response
    const competitorRecos = this.detectDominantCompetitors(input, dateKey);
    recommendations.push(...competitorRecos);

    // H3: High-value citation opportunities
    const citationRecos = this.detectCitationOpportunities(input, dateKey);
    recommendations.push(...citationRecos);

    // H4: Brand visibility gaps
    const visibilityRecos = this.detectVisibilityGaps(input, dateKey);
    recommendations.push(...visibilityRecos);

    // Sort by priority and confidence
    return recommendations
      .sort((a, b) => {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
        if (priorityDiff !== 0) return priorityDiff;
        return b.confidence - a.confidence;
      })
      .slice(0, 8); // Conservative limit
  }

  private detectLowVisibilityPrompts(input: RecommendationInput, dateKey: string): SafeRecommendation[] {
    const lowVisibilityPrompts = input.promptVisibility.filter(p => 
      p.avg_score_7d < 4.0 && 
      p.runs_7d >= 5 && 
      p.brand_visible_count < 2
    );

    if (lowVisibilityPrompts.length === 0) return [];

    const topPrompts = lowVisibilityPrompts
      .sort((a, b) => b.runs_7d - a.runs_7d)
      .slice(0, 3);

    return [{
      id: `low-vis-${dateKey}-${input.orgId}`,
      type: 'content',
      title: `Create comparison content for ${topPrompts.length} underperforming prompts`,
      rationale: `${topPrompts.length} high-traffic prompts (avg ${Math.round(topPrompts.reduce((s, p) => s + p.runs_7d, 0) / topPrompts.length)} runs/week) show low brand visibility (avg score ${(topPrompts.reduce((s, p) => s + p.avg_score_7d, 0) / topPrompts.length).toFixed(1)})`,
      priority: 'high',
      estimated_lift: 2.8,
      confidence: 0.85,
      source_data: { prompts: topPrompts },
      implementation_steps: [
        'Analyze competitor messaging for target prompts',
        'Create comparison pages highlighting unique value props',
        'Optimize for specific prompt keywords',
        'Add competitive positioning content'
      ],
      created_date: dateKey
    }];
  }

  private detectDominantCompetitors(input: RecommendationInput, dateKey: string): SafeRecommendation[] {
    const dominantCompetitors = input.competitorAnalysis.filter(c => 
      c.mention_count > 8 && 
      c.prompt_coverage > 0.6 &&
      c.avg_position < 3
    );

    if (dominantCompetitors.length === 0) return [];

    const topCompetitor = dominantCompetitors[0];

    return [{
      id: `comp-${dateKey}-${input.orgId}`,
      type: 'content',
      title: `Counter ${topCompetitor.competitor}'s market dominance`,
      rationale: `${topCompetitor.competitor} appears in ${topCompetitor.mention_count} responses with ${Math.round(topCompetitor.prompt_coverage * 100)}% prompt coverage and strong positioning (avg position ${topCompetitor.avg_position.toFixed(1)})`,
      priority: 'medium',
      estimated_lift: 3.2,
      confidence: 0.78,
      source_data: { competitor: topCompetitor },
      implementation_steps: [
        `Research ${topCompetitor.competitor}'s key messaging themes`,
        'Develop counter-positioning content strategy',
        'Create head-to-head comparison resources',
        'Build thought leadership content in competing areas'
      ],
      created_date: dateKey
    }];
  }

  private detectCitationOpportunities(input: RecommendationInput, dateKey: string): SafeRecommendation[] {
    const highValueCitations = input.citationData.filter(c => 
      c.citation_count >= 10 && 
      c.source_type !== 'competitor'
    );

    if (highValueCitations.length < 3) return [];

    return [{
      id: `cite-${dateKey}-${input.orgId}`,
      type: 'content',
      title: `Create authoritative resource hub`,
      rationale: `${highValueCitations.length} external sources are frequently cited (${highValueCitations.reduce((s, c) => s + c.citation_count, 0)} total citations). Creating owned resources could capture this traffic.`,
      priority: 'low',
      estimated_lift: 1.9,
      confidence: 0.72,
      source_data: { citations: highValueCitations.slice(0, 5) },
      implementation_steps: [
        'Analyze citation patterns and topics',
        'Create comprehensive resource hub',
        'Develop original research and data',
        'Build citation-worthy content assets'
      ],
      created_date: dateKey
    }];
  }

  private detectVisibilityGaps(input: RecommendationInput, dateKey: string): SafeRecommendation[] {
    const totalPrompts = input.promptVisibility.length;
    const lowBrandVisibility = input.promptVisibility.filter(p => p.brand_visible_count === 0).length;
    const visibilityRate = (totalPrompts - lowBrandVisibility) / totalPrompts;

    if (visibilityRate > 0.7) return []; // Good visibility already

    return [{
      id: `vis-${dateKey}-${input.orgId}`,
      type: 'seo',
      title: `Improve brand mention optimization`,
      rationale: `Brand visibility rate is ${Math.round(visibilityRate * 100)}% (${lowBrandVisibility}/${totalPrompts} prompts show no brand presence). SEO and content improvements needed.`,
      priority: 'medium',
      estimated_lift: 2.1,
      confidence: 0.68,
      source_data: { 
        total_prompts: totalPrompts, 
        invisible_prompts: lowBrandVisibility,
        visibility_rate: visibilityRate 
      },
      implementation_steps: [
        'Audit existing content for brand mention opportunities',
        'Optimize page titles and descriptions',
        'Improve internal linking to branded content',
        'Create brand-focused landing pages'
      ],
      created_date: dateKey
    }];
  }

  private async persistRecommendations(orgId: string, recommendations: SafeRecommendation[]): Promise<void> {
    try {
      const dbRecos = recommendations.map(reco => ({
        org_id: orgId,
        type: reco.type,
        title: reco.title,
        rationale: reco.rationale,
        status: 'open',
        metadata: {
          priority: reco.priority,
          estimated_lift: reco.estimated_lift,
          confidence: reco.confidence,
          source_data: reco.source_data,
          implementation_steps: reco.implementation_steps,
          safe_engine: true,
          created_date: reco.created_date
        }
      }));

      const { error } = await this.supabase
        .from('recommendations')
        .insert(dbRecos);

      if (error) throw error;

      this.logger.info('Persisted daily recommendations', { 
        orgId, 
        count: recommendations.length 
      });

    } catch (error) {
      this.logger.error('Failed to persist recommendations', error as Error, { orgId });
    }
  }

  private mapDbToReco(dbReco: any): SafeRecommendation {
    return {
      id: dbReco.id,
      type: dbReco.type,
      title: dbReco.title,
      rationale: dbReco.rationale,
      priority: dbReco.metadata?.priority || 'medium',
      estimated_lift: dbReco.metadata?.estimated_lift || 2.0,
      confidence: dbReco.metadata?.confidence || 0.7,
      source_data: dbReco.metadata?.source_data || {},
      implementation_steps: dbReco.metadata?.implementation_steps || [],
      created_date: dbReco.metadata?.created_date || dbReco.created_at?.split('T')[0]
    };
  }
}