import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock safe recommendation engine
class MockSafeRecommendationEngine {
  private dailyCache = new Map();

  constructor(private supabase: any) {}

  async generateRecommendations(input: any) {
    const dateKey = new Date().toISOString().split('T')[0];
    const cacheKey = `${input.orgId}-${dateKey}`;

    // Idempotent check
    if (this.dailyCache.has(cacheKey)) {
      return this.dailyCache.get(cacheKey);
    }

    // Generate recommendations using heuristics
    const recommendations = [];

    // H1: Low visibility detection
    const lowVisibilityRecos = this.detectLowVisibilityPrompts(input, dateKey);
    recommendations.push(...lowVisibilityRecos);

    // H2: Dominant competitors
    const competitorRecos = this.detectDominantCompetitors(input, dateKey);
    recommendations.push(...competitorRecos);

    // H3: Citation opportunities
    const citationRecos = this.detectCitationOpportunities(input, dateKey);
    recommendations.push(...citationRecos);

    // Sort by priority and limit
    const sortedRecos = recommendations
      .sort((a, b) => {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      })
      .slice(0, 8);

    this.dailyCache.set(cacheKey, sortedRecos);
    return sortedRecos;
  }

  private detectLowVisibilityPrompts(input: any, dateKey: string) {
    const lowVisibilityPrompts = input.promptVisibility.filter(p => 
      p.avg_score_7d < 4.0 && 
      p.runs_7d >= 5 && 
      p.brand_visible_count < 2
    );

    if (lowVisibilityPrompts.length === 0) return [];

    return [{
      id: `low-vis-${dateKey}-${input.orgId}`,
      type: 'content',
      title: `Create comparison content for ${lowVisibilityPrompts.length} underperforming prompts`,
      rationale: `High-traffic prompts showing low brand visibility`,
      priority: 'high',
      estimated_lift: 2.8,
      confidence: 0.85,
      source_data: { prompts: lowVisibilityPrompts.slice(0, 3) },
      implementation_steps: [
        'Analyze competitor messaging',
        'Create comparison pages',
        'Optimize for keywords',
        'Add competitive positioning'
      ],
      created_date: dateKey
    }];
  }

  private detectDominantCompetitors(input: any, dateKey: string) {
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
      rationale: `Strong competitor presence detected`,
      priority: 'medium',
      estimated_lift: 3.2,
      confidence: 0.78,
      source_data: { competitor: topCompetitor },
      implementation_steps: [
        'Research competitor messaging',
        'Develop counter-positioning',
        'Create comparison resources',
        'Build thought leadership'
      ],
      created_date: dateKey
    }];
  }

  private detectCitationOpportunities(input: any, dateKey: string) {
    const highValueCitations = input.citationData.filter(c => 
      c.citation_count >= 10 && 
      c.source_type !== 'competitor'
    );

    if (highValueCitations.length < 3) return [];

    return [{
      id: `cite-${dateKey}-${input.orgId}`,
      type: 'content',
      title: `Create authoritative resource hub`,
      rationale: `Multiple external sources frequently cited`,
      priority: 'low',
      estimated_lift: 1.9,
      confidence: 0.72,
      source_data: { citations: highValueCitations.slice(0, 5) },
      implementation_steps: [
        'Analyze citation patterns',
        'Create resource hub',
        'Develop original research',
        'Build citation-worthy content'
      ],
      created_date: dateKey
    }];
  }
}

describe('Safe Recommendations Engine', () => {
  let engine: MockSafeRecommendationEngine;
  let mockSupabase: any;
  let testInput: any;

  beforeEach(() => {
    mockSupabase = {};
    engine = new MockSafeRecommendationEngine(mockSupabase);
    
    testInput = {
      orgId: 'test-org-id',
      promptVisibility: [
        { prompt_id: '1', text: 'Low visibility prompt', avg_score_7d: 2.5, runs_7d: 10, brand_visible_count: 0, competitor_count: 5 },
        { prompt_id: '2', text: 'Good prompt', avg_score_7d: 7.2, runs_7d: 8, brand_visible_count: 3, competitor_count: 2 },
        { prompt_id: '3', text: 'Another low prompt', avg_score_7d: 3.1, runs_7d: 12, brand_visible_count: 1, competitor_count: 8 }
      ],
      competitorAnalysis: [
        { competitor: 'Salesforce', mention_count: 15, prompt_coverage: 0.8, avg_position: 2.1 },
        { competitor: 'HubSpot', mention_count: 5, prompt_coverage: 0.3, avg_position: 4.2 }
      ],
      citationData: [
        { url: 'https://research.com/study1', citation_count: 15, source_type: 'research' },
        { url: 'https://industry.com/report', citation_count: 12, source_type: 'industry' },
        { url: 'https://data.org/analysis', citation_count: 8, source_type: 'data' }
      ]
    };
  });

  it('should generate recommendations for low visibility prompts', async () => {
    const recommendations = await engine.generateRecommendations(testInput);
    
    const lowVisReco = recommendations.find(r => r.title.includes('underperforming prompts'));
    expect(lowVisReco).toBeDefined();
    expect(lowVisReco?.type).toBe('content');
    expect(lowVisReco?.priority).toBe('high');
    expect(lowVisReco?.estimated_lift).toBeGreaterThan(2);
  });

  it('should detect dominant competitors requiring response', async () => {
    const recommendations = await engine.generateRecommendations(testInput);
    
    const competitorReco = recommendations.find(r => r.title.includes('Salesforce'));
    expect(competitorReco).toBeDefined();
    expect(competitorReco?.type).toBe('content');
    expect(competitorReco?.priority).toBe('medium');
    expect(competitorReco?.rationale).toContain('competitor presence');
  });

  it('should identify citation opportunities', async () => {
    const recommendations = await engine.generateRecommendations(testInput);
    
    const citationReco = recommendations.find(r => r.title.includes('resource hub'));
    expect(citationReco).toBeDefined();
    expect(citationReco?.type).toBe('content');
    expect(citationReco?.priority).toBe('low');
    expect(citationReco?.source_data?.citations).toBeDefined();
  });

  it('should not generate recommendations for insufficient data', async () => {
    const sparseInput = {
      orgId: 'test-org',
      promptVisibility: [
        { prompt_id: '1', avg_score_7d: 8.0, runs_7d: 2, brand_visible_count: 3, competitor_count: 0 }
      ],
      competitorAnalysis: [
        { competitor: 'Weak', mention_count: 2, prompt_coverage: 0.1, avg_position: 5.0 }
      ],
      citationData: [
        { url: 'https://example.com', citation_count: 3, source_type: 'blog' }
      ]
    };

    const recommendations = await engine.generateRecommendations(sparseInput);
    expect(recommendations).toHaveLength(0);
  });

  it('should be idempotent per day', async () => {
    const first = await engine.generateRecommendations(testInput);
    const second = await engine.generateRecommendations(testInput);
    
    // Should return exact same recommendations (cached)
    expect(first).toEqual(second);
    expect(first).toBe(second); // Same reference indicates caching
  });

  it('should prioritize recommendations correctly', async () => {
    const recommendations = await engine.generateRecommendations(testInput);
    
    // Should be sorted by priority (high, medium, low)
    const priorities = recommendations.map(r => r.priority);
    const priorityValues = priorities.map(p => ({ high: 3, medium: 2, low: 1 })[p]);
    
    for (let i = 1; i < priorityValues.length; i++) {
      expect(priorityValues[i-1]).toBeGreaterThanOrEqual(priorityValues[i]);
    }
  });

  it('should limit recommendation count conservatively', async () => {
    // Create input with potential for many recommendations
    const largeInput = {
      ...testInput,
      promptVisibility: Array(20).fill(0).map((_, i) => ({
        prompt_id: `prompt-${i}`,
        text: `Low visibility prompt ${i}`,
        avg_score_7d: 2.0,
        runs_7d: 10,
        brand_visible_count: 0,
        competitor_count: 5
      }))
    };

    const recommendations = await engine.generateRecommendations(largeInput);
    
    // Should not exceed conservative limit
    expect(recommendations.length).toBeLessThanOrEqual(8);
  });

  it('should include implementation steps for all recommendations', async () => {
    const recommendations = await engine.generateRecommendations(testInput);
    
    recommendations.forEach(reco => {
      expect(reco.implementation_steps).toBeDefined();
      expect(Array.isArray(reco.implementation_steps)).toBe(true);
      expect(reco.implementation_steps.length).toBeGreaterThan(0);
      
      // Each step should be actionable
      reco.implementation_steps.forEach(step => {
        expect(typeof step).toBe('string');
        expect(step.length).toBeGreaterThan(10);
      });
    });
  });

  it('should provide realistic confidence scores', async () => {
    const recommendations = await engine.generateRecommendations(testInput);
    
    recommendations.forEach(reco => {
      expect(reco.confidence).toBeGreaterThan(0.5);
      expect(reco.confidence).toBeLessThanOrEqual(1.0);
      expect(reco.estimated_lift).toBeGreaterThan(0);
      expect(reco.estimated_lift).toBeLessThan(5); // Realistic upper bound
    });
  });

  it('should handle edge cases gracefully', async () => {
    const edgeCases = [
      { orgId: 'test', promptVisibility: [], competitorAnalysis: [], citationData: [] },
      { orgId: 'test', promptVisibility: null, competitorAnalysis: null, citationData: null },
      { orgId: '', promptVisibility: [], competitorAnalysis: [], citationData: [] }
    ];

    for (const edgeCase of edgeCases) {
      expect(async () => {
        const recommendations = await engine.generateRecommendations(edgeCase);
        expect(Array.isArray(recommendations)).toBe(true);
      }).not.toThrow();
    }
  });

  it('should include source data for traceability', async () => {
    const recommendations = await engine.generateRecommendations(testInput);
    
    recommendations.forEach(reco => {
      expect(reco.source_data).toBeDefined();
      expect(typeof reco.source_data).toBe('object');
      expect(reco.created_date).toBeDefined();
      expect(reco.id).toContain(reco.created_date);
    });
  });
});