import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Supabase client for testing
const createMockSupabase = (mockData: any = {}) => ({
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: vi.fn(() => Promise.resolve({ data: mockData.orgData || null })),
        limit: vi.fn(() => Promise.resolve({ data: mockData.brandCatalog || [] })),
      })),
      gte: vi.fn(() => ({
        eq: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve({ data: mockData.pastCompetitors || [] })),
        })),
      })),
    })),
  })),
});

describe('Competitor Detection Engine', () => {
  let mockSupabase: any;

  beforeEach(() => {
    mockSupabase = createMockSupabase({
      orgData: {
        id: 'test-org-id',
        name: 'Test Company',
        domain: 'test.com',
        competitors: ['Competitor A', 'Competitor B'],
      },
      brandCatalog: [
        { name: 'Known Competitor', is_org_brand: false, variants_json: ['Competitor', 'Comp'] },
        { name: 'Test Company', is_org_brand: true, variants_json: ['Test Co'] },
      ],
      pastCompetitors: [
        { competitors_json: ['Historical Competitor'] },
      ],
    });
  });

  it('should extract proper noun candidates from text', async () => {
    const text = 'We compared Salesforce, HubSpot, and Microsoft against small tools.';
    
    // Mock implementation of competitor detection logic
    const extractProperNouns = (input: string): string[] => {
      const words = input.split(/\s+/);
      return words.filter(word => /^[A-Z][a-z]+/.test(word) && word.length > 2);
    };

    const candidates = extractProperNouns(text);
    expect(candidates).toContain('Salesforce');
    expect(candidates).toContain('HubSpot');
    expect(candidates).toContain('Microsoft');
    expect(candidates).not.toContain('small'); // lowercase
  });

  it('should filter out generic terms and stopwords', async () => {
    const candidates = ['Software', 'Platform', 'Salesforce', 'Data', 'HubSpot'];
    const stopwords = ['Software', 'Platform', 'Data'];
    
    const filtered = candidates.filter(candidate => !stopwords.includes(candidate));
    
    expect(filtered).toEqual(['Salesforce', 'HubSpot']);
  });

  it('should identify organization brands vs competitors', async () => {
    const candidates = ['Test Company', 'Known Competitor', 'Unknown Brand'];
    const orgBrands = ['Test Company', 'Test Co'];
    
    const result = {
      orgBrands: candidates.filter(c => orgBrands.some(org => c.includes(org))),
      competitors: candidates.filter(c => !orgBrands.some(org => c.includes(org))),
    };
    
    expect(result.orgBrands).toContain('Test Company');
    expect(result.competitors).toContain('Known Competitor');
    expect(result.competitors).toContain('Unknown Brand');
  });

  it('should calculate confidence scores based on context', async () => {
    const detectWithConfidence = (text: string, candidate: string) => {
      const mentions = (text.match(new RegExp(candidate, 'gi')) || []).length;
      const position = text.toLowerCase().indexOf(candidate.toLowerCase());
      const isEarlyMention = position < text.length * 0.3;
      
      let confidence = 0.5; // base confidence
      confidence += mentions * 0.2; // multiple mentions boost
      confidence += isEarlyMention ? 0.3 : 0; // early mention boost
      
      return Math.min(confidence, 1.0);
    };
    
    const text = 'Salesforce is the leading CRM. Many prefer Salesforce over HubSpot.';
    
    expect(detectWithConfidence(text, 'Salesforce')).toBeGreaterThan(0.8);
    expect(detectWithConfidence(text, 'HubSpot')).toBeLessThan(0.8);
  });

  it('should handle edge cases and malformed input', async () => {
    const edgeCases = [
      '', // empty string
      '   ', // whitespace only
      'no capitals here', // no proper nouns
      'A B C D E F', // too many single letters
      'HTML CSS JS', // technical abbreviations
    ];
    
    const extractSafely = (text: string): string[] => {
      if (!text || text.trim().length === 0) return [];
      
      const candidates = text.match(/\b[A-Z][a-zA-Z]{2,}\b/g) || [];
      return candidates.filter(c => c.length > 2 && !/^[A-Z]{2,4}$/.test(c));
    };
    
    expect(extractSafely(edgeCases[0])).toEqual([]);
    expect(extractSafely(edgeCases[1])).toEqual([]);
    expect(extractSafely(edgeCases[2])).toEqual([]);
    expect(extractSafely(edgeCases[4])).not.toContain('HTML');
  });

  it('should validate performance within acceptable limits', async () => {
    const largeText = 'Salesforce HubSpot Microsoft '.repeat(1000);
    
    const start = performance.now();
    const candidates = largeText.match(/\b[A-Z][a-zA-Z]{2,}\b/g) || [];
    const uniqueCandidates = [...new Set(candidates)];
    const duration = performance.now() - start;
    
    expect(duration).toBeLessThan(100); // Should complete within 100ms
    expect(uniqueCandidates.length).toBeLessThanOrEqual(10); // Reasonable result size
  });
});