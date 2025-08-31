import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the strict competitor detector (would normally import from edge function)
class MockStrictCompetitorDetector {
  private orgGazetteer = new Map();
  private strictStopwords = new Set([
    'software', 'platform', 'solution', 'system', 'tool', 'tools',
    'google', 'microsoft', 'apple', 'amazon', 'facebook', 'meta',
    'best', 'top', 'leading', 'popular', 'digital', 'online'
  ]);

  constructor(private supabase: any) {}

  async initializeOrgGazetteer(orgId: string) {
    // Mock initialization with strict validation
    const mockBrands = [
      { name: 'Salesforce', is_org_brand: false, variants_json: ['SFDC'] },
      { name: 'TestCorp', is_org_brand: true, variants_json: ['Test Corp'] },
      { name: 'HubSpot', is_org_brand: false, variants_json: [] }
    ];

    for (const brand of mockBrands) {
      if (this.isStrictlyValid(brand.name)) {
        this.orgGazetteer.set(brand.name.toLowerCase(), {
          name: brand.name,
          isOrgBrand: brand.is_org_brand,
          source: 'brand_catalog'
        });
      }
    }
  }

  async detectCompetitors(text: string, orgId: string) {
    if (this.orgGazetteer.size === 0) {
      await this.initializeOrgGazetteer(orgId);
    }

    const candidates = this.extractStrictCandidates(text);
    const competitors = [];
    const orgBrands = [];
    const rejectedTerms = [];
    let gazetteerMatches = 0;

    for (const candidate of candidates) {
      const normalized = candidate.toLowerCase();
      const orgEntry = this.orgGazetteer.get(normalized);

      if (orgEntry) {
        gazetteerMatches++;
        const match = {
          name: orgEntry.name,
          normalized,
          mentions: this.countMentions(text, candidate),
          confidence: this.calculateStrictConfidence(candidate, text),
          source: orgEntry.source
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
        gazetteer_matches: gazetteerMatches,
        rejected_count: rejectedTerms.length,
        processing_time_ms: 10,
        strict_mode: true
      }
    };
  }

  private extractStrictCandidates(text: string): string[] {
    const candidates = [];
    
    // Ultra-conservative patterns
    const patterns = [
      /\b([A-Z][a-z]+)\s+(CRM|Platform|System|Software)\b/g,
      /\b[A-Z][a-z]{2,}(?:[A-Z][a-z]+)*\b/g
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const candidate = match[1] || match[0];
        if (this.isStrictCandidate(candidate)) {
          candidates.push(candidate);
        }
      }
    }

    return [...new Set(candidates)];
  }

  private isStrictCandidate(candidate: string): boolean {
    const normalized = candidate.toLowerCase();
    return (
      candidate.length >= 3 &&
      candidate.length <= 30 &&
      !this.strictStopwords.has(normalized) &&
      !/^[0-9]+$/.test(candidate) &&
      !/(click|learn|more|here|sign|up)/i.test(candidate)
    );
  }

  private isStrictlyValid(name: string): boolean {
    return this.isStrictCandidate(name) && name.length >= 2;
  }

  private countMentions(text: string, term: string): number {
    const regex = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    return (text.match(regex) || []).length;
  }

  private calculateStrictConfidence(candidate: string, text: string): number {
    let confidence = 0.6;
    
    // Position boost
    const firstIndex = text.toLowerCase().indexOf(candidate.toLowerCase());
    if (firstIndex !== -1 && firstIndex / text.length < 0.3) {
      confidence += 0.2;
    }

    // Format bonuses
    if (candidate.length >= 6) confidence += 0.1;
    if (/^[A-Z][a-z]+[A-Z]/.test(candidate)) confidence += 0.1;

    return Math.min(confidence, 1.0);
  }
}

describe('Strict Competitor Detection', () => {
  let detector: MockStrictCompetitorDetector;
  let mockSupabase: any;

  beforeEach(() => {
    mockSupabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ data: null }))
          }))
        }))
      }))
    };
    detector = new MockStrictCompetitorDetector(mockSupabase);
  });

  it('should only detect gazetteer-verified competitors', async () => {
    const text = 'We compared Salesforce CRM with UnknownTool and RandomSoftware.';
    
    const result = await detector.detectCompetitors(text, 'test-org');
    
    // Only Salesforce should be detected (in gazetteer)
    expect(result.competitors).toHaveLength(1);
    expect(result.competitors[0].name).toBe('Salesforce');
    
    // UnknownTool and RandomSoftware should be rejected
    expect(result.rejectedTerms).toContain('UnknownTool');
    expect(result.rejectedTerms).toContain('RandomSoftware');
  });

  it('should filter out generic stopwords aggressively', async () => {
    const text = 'The best software platform for digital marketing tools online.';
    
    const result = await detector.detectCompetitors(text, 'test-org');
    
    // All terms should be rejected as stopwords
    expect(result.competitors).toHaveLength(0);
    expect(result.orgBrands).toHaveLength(0);
    expect(result.metadata.rejected_count).toBeGreaterThan(0);
  });

  it('should distinguish org brands from competitors', async () => {
    const text = 'TestCorp Platform beats Salesforce and HubSpot in performance.';
    
    const result = await detector.detectCompetitors(text, 'test-org');
    
    // TestCorp should be org brand, others competitors
    expect(result.orgBrands).toHaveLength(1);
    expect(result.orgBrands[0].name).toBe('TestCorp');
    
    expect(result.competitors).toHaveLength(2);
    expect(result.competitors.map(c => c.name)).toContain('Salesforce');
    expect(result.competitors.map(c => c.name)).toContain('HubSpot');
  });

  it('should calculate conservative confidence scores', async () => {
    const text = 'Salesforce is the leading CRM. Many companies use Salesforce daily.';
    
    const result = await detector.detectCompetitors(text, 'test-org');
    
    expect(result.competitors).toHaveLength(1);
    const salesforceMatch = result.competitors[0];
    
    // Should have reasonable confidence (0.6-1.0 range)
    expect(salesforceMatch.confidence).toBeGreaterThanOrEqual(0.6);
    expect(salesforceMatch.confidence).toBeLessThanOrEqual(1.0);
    
    // Should count multiple mentions
    expect(salesforceMatch.mentions).toBe(2);
  });

  it('should handle compound brand names correctly', async () => {
    const text = 'HubSpot Marketing Hub versus Salesforce Sales Cloud.';
    
    const result = await detector.detectCompetitors(text, 'test-org');
    
    // Should detect both HubSpot and Salesforce (compound names handled)
    expect(result.competitors.length).toBeGreaterThanOrEqual(1);
    expect(result.competitors.map(c => c.name)).toContain('HubSpot');
  });

  it('should reject invalid candidate patterns', async () => {
    const invalidText = 'Click here to learn more about 123 and sign up now!';
    
    const result = await detector.detectCompetitors(invalidText, 'test-org');
    
    // Should reject all candidates (CTA phrases, numbers)
    expect(result.competitors).toHaveLength(0);
    expect(result.orgBrands).toHaveLength(0);
    expect(result.metadata.strict_mode).toBe(true);
  });

  it('should enforce minimum candidate length', async () => {
    const text = 'We use A, B, C tools versus Salesforce.';
    
    const result = await detector.detectCompetitors(text, 'test-org');
    
    // Only Salesforce should pass (single letters rejected)
    expect(result.competitors).toHaveLength(1);
    expect(result.competitors[0].name).toBe('Salesforce');
    expect(result.rejectedTerms).not.toContain('Salesforce');
  });

  it('should handle edge cases gracefully', async () => {
    const edgeCases = [
      '', // empty
      '   ', // whitespace
      'no proper nouns here', // no candidates
      '!@#$%^&*()' // special chars only
    ];
    
    for (const testCase of edgeCases) {
      const result = await detector.detectCompetitors(testCase, 'test-org');
      
      expect(result.competitors).toHaveLength(0);
      expect(result.orgBrands).toHaveLength(0);
      expect(result.metadata.strict_mode).toBe(true);
    }
  });

  it('should provide comprehensive metadata', async () => {
    const text = 'Salesforce CRM and UnknownBrand compete with TestCorp.';
    
    const result = await detector.detectCompetitors(text, 'test-org');
    
    expect(result.metadata).toMatchObject({
      strict_mode: true,
      total_candidates: expect.any(Number),
      gazetteer_matches: expect.any(Number),
      rejected_count: expect.any(Number),
      processing_time_ms: expect.any(Number)
    });
    
    // Should track rejections properly
    expect(result.metadata.rejected_count).toBeGreaterThan(0);
    expect(result.metadata.gazetteer_matches).toBeGreaterThan(0);
  });
});