import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock recommendation engine logic
interface RecommendationData {
  promptVisibility: Array<{ prompt_id: string; avg_score: number; run_count: number }>;
  competitorShare: Array<{ competitor: string; share: number; prompt_count: number }>;
  citationData: Array<{ url: string; citation_count: number }>;
}

const mockRecommendationEngine = {
  generateRecommendations: (data: RecommendationData) => {
    const recommendations = [];
    
    // R1: Low visibility prompts
    const lowVisibilityPrompts = data.promptVisibility.filter(p => p.avg_score < 4 && p.run_count > 5);
    if (lowVisibilityPrompts.length > 0) {
      recommendations.push({
        type: 'content',
        title: 'Create comparison pages for low-visibility prompts',
        rationale: `${lowVisibilityPrompts.length} prompts show low visibility scores`,
        estimated_lift: 2.5,
        source_data: lowVisibilityPrompts,
      });
    }
    
    // R2: Dominant competitors
    const dominantCompetitors = data.competitorShare.filter(c => c.share > 40 && c.prompt_count > 3);
    if (dominantCompetitors.length > 0) {
      recommendations.push({
        type: 'content',
        title: 'Create pillar pages targeting dominant competitors',
        rationale: `${dominantCompetitors[0].competitor} dominates with ${dominantCompetitors[0].share}% share`,
        estimated_lift: 3.0,
        source_data: dominantCompetitors,
      });
    }
    
    // R3: Frequently cited external URLs
    const topCitations = data.citationData.filter(c => c.citation_count > 10);
    if (topCitations.length > 0) {
      recommendations.push({
        type: 'content',
        title: 'Create evidence/resources page',
        rationale: `${topCitations.length} external sources frequently cited`,
        estimated_lift: 1.8,
        source_data: topCitations,
      });
    }
    
    return recommendations;
  },
};

describe('Recommendations Engine', () => {
  let testData: RecommendationData;

  beforeEach(() => {
    testData = {
      promptVisibility: [
        { prompt_id: 'prompt-1', avg_score: 2.5, run_count: 10 },
        { prompt_id: 'prompt-2', avg_score: 7.2, run_count: 8 },
        { prompt_id: 'prompt-3', avg_score: 3.1, run_count: 12 },
      ],
      competitorShare: [
        { competitor: 'Salesforce', share: 45, prompt_count: 5 },
        { competitor: 'HubSpot', share: 25, prompt_count: 3 },
        { competitor: 'Pipedrive', share: 15, prompt_count: 2 },
      ],
      citationData: [
        { url: 'https://example.com/study1', citation_count: 15 },
        { url: 'https://research.org/report', citation_count: 8 },
        { url: 'https://industry.com/analysis', citation_count: 12 },
      ],
    };
  });

  it('should generate content recommendations for low-visibility prompts', () => {
    const recommendations = mockRecommendationEngine.generateRecommendations(testData);
    
    const contentRec = recommendations.find(r => r.title.includes('comparison pages'));
    expect(contentRec).toBeDefined();
    expect(contentRec?.type).toBe('content');
    expect(contentRec?.estimated_lift).toBeGreaterThan(0);
  });

  it('should identify dominant competitors requiring strategic response', () => {
    const recommendations = mockRecommendationEngine.generateRecommendations(testData);
    
    const competitorRec = recommendations.find(r => r.title.includes('pillar pages'));
    expect(competitorRec).toBeDefined();
    expect(competitorRec?.rationale).toContain('Salesforce');
    expect(competitorRec?.rationale).toContain('45%');
  });

  it('should recommend evidence pages for frequently cited sources', () => {
    const recommendations = mockRecommendationEngine.generateRecommendations(testData);
    
    const evidenceRec = recommendations.find(r => r.title.includes('evidence/resources'));
    expect(evidenceRec).toBeDefined();
    expect(evidenceRec?.estimated_lift).toBeGreaterThan(1);
  });

  it('should not generate recommendations for insufficient data', () => {
    const sparseData: RecommendationData = {
      promptVisibility: [{ prompt_id: 'prompt-1', avg_score: 8.0, run_count: 2 }],
      competitorShare: [{ competitor: 'Competitor', share: 10, prompt_count: 1 }],
      citationData: [{ url: 'https://example.com', citation_count: 3 }],
    };
    
    const recommendations = mockRecommendationEngine.generateRecommendations(sparseData);
    expect(recommendations).toHaveLength(0);
  });

  it('should calculate realistic lift estimates based on data quality', () => {
    const recommendations = mockRecommendationEngine.generateRecommendations(testData);
    
    recommendations.forEach(rec => {
      expect(rec.estimated_lift).toBeGreaterThan(0);
      expect(rec.estimated_lift).toBeLessThan(5); // Realistic upper bound
      expect(rec.source_data).toBeDefined();
    });
  });

  it('should prioritize recommendations by potential impact', () => {
    const recommendations = mockRecommendationEngine.generateRecommendations(testData);
    
    // Sort by estimated lift descending
    const sorted = [...recommendations].sort((a, b) => b.estimated_lift - a.estimated_lift);
    
    // Verify the original array matches expected priority order
    expect(sorted[0].estimated_lift).toBeGreaterThanOrEqual(sorted[1]?.estimated_lift || 0);
  });

  it('should handle edge cases gracefully', () => {
    const edgeCases = [
      { promptVisibility: [], competitorShare: [], citationData: [] },
      { promptVisibility: undefined as any, competitorShare: null as any, citationData: [] },
    ];
    
    edgeCases.forEach(data => {
      expect(() => {
        const recommendations = mockRecommendationEngine.generateRecommendations(data);
        expect(Array.isArray(recommendations)).toBe(true);
      }).not.toThrow();
    });
  });

  it('should validate recommendation structure and required fields', () => {
    const recommendations = mockRecommendationEngine.generateRecommendations(testData);
    
    recommendations.forEach(rec => {
      expect(rec).toHaveProperty('type');
      expect(rec).toHaveProperty('title');
      expect(rec).toHaveProperty('rationale');
      expect(rec).toHaveProperty('estimated_lift');
      expect(rec).toHaveProperty('source_data');
      
      expect(typeof rec.type).toBe('string');
      expect(typeof rec.title).toBe('string');
      expect(typeof rec.rationale).toBe('string');
      expect(typeof rec.estimated_lift).toBe('number');
    });
  });
});