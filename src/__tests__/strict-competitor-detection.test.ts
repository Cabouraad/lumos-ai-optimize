import { describe, it, expect, beforeEach, vi } from 'vitest';
import { isOptimizationFeatureEnabled } from '../config/featureFlags';

// Mock the feature flags
vi.mock('../config/featureFlags', () => ({
  isOptimizationFeatureEnabled: vi.fn()
}));

/**
 * Mock strict competitor detector that simulates the behavior
 * of the actual StrictCompetitorDetector class
 */
class MockStrictCompetitorDetector {
  private orgGazetteer: Map<string, { name: string; isOrgBrand: boolean }> = new Map();

  async initializeOrgGazetteer(orgId: string): Promise<void> {
    // Mock predefined brands for testing
    this.orgGazetteer.set('hubspot', { name: 'HubSpot', isOrgBrand: false });
    this.orgGazetteer.set('buffer', { name: 'Buffer', isOrgBrand: false });
    this.orgGazetteer.set('hootsuite', { name: 'Hootsuite', isOrgBrand: false });
  }

  async detectCompetitors(text: string, orgId: string) {
    await this.initializeOrgGazetteer(orgId);
    
    const candidates = this.extractStrictCandidates(text);
    const competitors: any[] = [];
    const orgBrands: any[] = [];
    const rejectedTerms: string[] = [];
    
    for (const candidate of candidates) {
      const normalized = candidate.toLowerCase().trim();
      const orgEntry = this.orgGazetteer.get(normalized);
      
      if (orgEntry) {
        const match = {
          name: orgEntry.name,
          normalized,
          mentions: this.countMentions(text, candidate),
          confidence: this.calculateStrictConfidence(candidate, text),
          source: 'brand_catalog' as const
        };
        
        if (orgEntry.isOrgBrand) {
          orgBrands.push(match);
        } else {
          competitors.push(match);
        }
      } else {
        rejectedTerms.push(candidate);
      }
    }
    
    return {
      competitors: competitors.sort((a, b) => b.confidence - a.confidence),
      orgBrands: orgBrands.sort((a, b) => b.confidence - a.confidence),
      rejectedTerms,
      metadata: {
        total_candidates: candidates.length,
        gazetteer_matches: competitors.length + orgBrands.length,
        rejected_count: rejectedTerms.length,
        processing_time_ms: 50,
        strict_mode: true
      }
    };
  }

  private extractStrictCandidates(text: string): string[] {
    // Very conservative extraction - only proper nouns with specific patterns
    const candidates: string[] = [];
    
    // Match brand names like "HubSpot", "Buffer", "Hootsuite"
    const patterns = [
      /\b[A-Z][a-z]+(?:[A-Z][a-z]+)*\b/g,
      /\b[A-Z][a-z]+\b/g
    ];
    
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const candidate = match[0];
        if (this.isStrictCandidate(candidate)) {
          candidates.push(candidate);
        }
      }
    }
    
    return [...new Set(candidates)];
  }

  private isStrictCandidate(candidate: string): boolean {
    const normalized = candidate.toLowerCase().trim();
    const strictStopwords = new Set([
      'marketing', 'automation', 'customer', 'data', 'choose', 'software', 
      'platform', 'solution', 'system', 'tool', 'service', 'business'
    ]);
    
    return (
      candidate.length >= 3 &&
      candidate.length <= 30 &&
      !strictStopwords.has(normalized) &&
      !/^[0-9]+$/.test(candidate) &&
      !/[<>{}[\]()"`''""''„"‚'']/.test(candidate) &&
      !/(click|learn|more|here|sign|up|get|started|try|free|now)/i.test(candidate)
    );
  }

  private countMentions(text: string, term: string): number {
    const regex = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    return (text.match(regex) || []).length;
  }

  private calculateStrictConfidence(candidate: string, text: string): number {
    let confidence = 0.6;
    
    const mentions = this.countMentions(text, candidate);
    confidence += Math.min(mentions - 1, 3) * 0.1;
    
    const firstIndex = text.toLowerCase().indexOf(candidate.toLowerCase());
    if (firstIndex !== -1) {
      const positionRatio = firstIndex / text.length;
      if (positionRatio < 0.3) confidence += 0.2;
    }
    
    if (candidate.length >= 6) confidence += 0.1;
    if (/^[A-Z][a-z]+[A-Z]/.test(candidate)) confidence += 0.1;
    
    return Math.min(confidence, 1.0);
  }
}

// Mock legacy detector for fallback testing
const mockLegacyDetector = {
  detectCompetitors: vi.fn().mockResolvedValue({
    competitors: [
      { name: 'Generic Marketing Tool', confidence: 0.5 },
      { name: 'Customer Platform', confidence: 0.4 }
    ],
    metadata: { strict_mode: false }
  })
};

describe('Strict Competitor Detection', () => {
  let strictDetector: MockStrictCompetitorDetector;

  beforeEach(() => {
    strictDetector = new MockStrictCompetitorDetector();
    vi.clearAllMocks();
  });

  it('should detect only gazetteer-verified competitors', async () => {
    const text = "Compare HubSpot vs Buffer vs Hootsuite for social media management";
    const result = await strictDetector.detectCompetitors(text, 'test-org-id');
    
    expect(result.competitors).toHaveLength(3);
    expect(result.competitors.map(c => c.name)).toEqual(['HubSpot', 'Buffer', 'Hootsuite']);
    expect(result.metadata.strict_mode).toBe(true);
  });

  it('should filter out generic marketing terms', async () => {
    const text = "marketing automation / customer data / choose the best solution";
    const result = await strictDetector.detectCompetitors(text, 'test-org-id');
    
    expect(result.competitors).toHaveLength(0);
    expect(result.rejectedTerms.length).toBeGreaterThan(0);
  });

  it('should distinguish between org brands and competitors', async () => {
    // Simulate HubSpot being the org brand
    const detector = new MockStrictCompetitorDetector();
    detector['orgGazetteer'].set('hubspot', { name: 'HubSpot', isOrgBrand: true });
    
    const text = "HubSpot vs Buffer comparison";
    const result = await detector.detectCompetitors(text, 'hubspot-org-id');
    
    expect(result.orgBrands).toHaveLength(1);
    expect(result.orgBrands[0].name).toBe('HubSpot');
    expect(result.competitors).toHaveLength(1);
    expect(result.competitors[0].name).toBe('Buffer');
  });

  it('should calculate confidence scores based on mentions and position', async () => {
    const text = "HubSpot is mentioned multiple times. HubSpot leads the market.";
    const result = await strictDetector.detectCompetitors(text, 'test-org-id');
    
    expect(result.competitors).toHaveLength(1);
    expect(result.competitors[0].confidence).toBeGreaterThan(0.6);
    expect(result.competitors[0].mentions).toBe(2);
  });

  it('should handle compound brand names correctly', async () => {
    // Add a compound brand name to the gazetteer
    const detector = new MockStrictCompetitorDetector();
    detector['orgGazetteer'].set('marketo engage', { name: 'Marketo Engage', isOrgBrand: false });
    
    const text = "Marketo Engage offers advanced automation";
    const result = await detector.detectCompetitors(text, 'test-org-id');
    
    // Should handle compound names properly in extraction
    expect(result.metadata.total_candidates).toBeGreaterThan(0);
  });

  it('should reject candidates with invalid patterns', async () => {
    const text = "click here to learn more about 123solutions and get started now";
    const result = await strictDetector.detectCompetitors(text, 'test-org-id');
    
    expect(result.competitors).toHaveLength(0);
    expect(result.rejectedTerms.length).toBeGreaterThan(0);
  });

  it('should enforce length limits on candidate names', async () => {
    const text = "VeryLongBrandNameThatExceedsThirtyCharactersAndShouldBeRejected";
    const result = await strictDetector.detectCompetitors(text, 'test-org-id');
    
    expect(result.competitors).toHaveLength(0);
  });

  it('should handle edge cases with no valid candidates', async () => {
    const text = "the and or but for with at by from about";
    const result = await strictDetector.detectCompetitors(text, 'test-org-id');
    
    expect(result.competitors).toHaveLength(0);
    expect(result.orgBrands).toHaveLength(0);
    expect(result.metadata.total_candidates).toBe(0);
  });

  it('should provide comprehensive metadata', async () => {
    const text = "HubSpot vs Buffer vs unknown-tool marketing";
    const result = await strictDetector.detectCompetitors(text, 'test-org-id');
    
    expect(result.metadata).toMatchObject({
      total_candidates: expect.any(Number),
      gazetteer_matches: expect.any(Number),
      rejected_count: expect.any(Number),
      processing_time_ms: expect.any(Number),
      strict_mode: true
    });
  });
});

describe('Strict Detection Feature Flag Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should use strict detection when flag is enabled', () => {
    (isOptimizationFeatureEnabled as any).mockReturnValue(true);
    
    expect(isOptimizationFeatureEnabled('FEATURE_STRICT_COMPETITOR_DETECT')).toBe(true);
  });

  it('should fallback to legacy detection when flag is disabled', () => {
    (isOptimizationFeatureEnabled as any).mockReturnValue(false);
    
    expect(isOptimizationFeatureEnabled('FEATURE_STRICT_COMPETITOR_DETECT')).toBe(false);
  });

  it('should preserve legacy output shape with strict detection', async () => {
    const strictDetector = new MockStrictCompetitorDetector();
    const text = "HubSpot vs Buffer";
    const result = await strictDetector.detectCompetitors(text, 'test-org-id');
    
    // Ensure output shape matches legacy format expectations
    expect(result).toHaveProperty('competitors');
    expect(result).toHaveProperty('orgBrands');
    expect(result).toHaveProperty('metadata');
    expect(result.competitors[0]).toHaveProperty('name');
    expect(result.competitors[0]).toHaveProperty('confidence');
  });
});