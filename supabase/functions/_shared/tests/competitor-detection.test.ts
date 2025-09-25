/**
 * Unit Tests for Enhanced Competitor Detection
 */

import { EnhancedCompetitorDetector } from '../enhanced-competitor-detector.ts';

// Mock Supabase client for testing
class MockSupabaseClient {
  private mockData: {
    brandCatalog: Array<{ name: string; variants_json: string[]; is_org_brand: boolean }>;
    organization: { name: string; metadata?: any };
    pastCompetitors: Array<{ competitors_json: string[] }>;
  };

  constructor() {
    this.mockData = {
      brandCatalog: [
        { name: 'HubSpot', variants_json: ['hubspot', 'HubSpot Marketing Hub'], is_org_brand: false },
        { name: 'Salesforce', variants_json: ['salesforce', 'Sales Force'], is_org_brand: false },
        { name: 'Zoho CRM', variants_json: ['zoho', 'zoho crm'], is_org_brand: false },
        { name: 'Freshworks', variants_json: ['freshworks', 'fresh works'], is_org_brand: false },
        { name: 'TestCorp', variants_json: ['testcorp', 'test corp'], is_org_brand: true }
      ],
      organization: { 
        name: 'TestCorp',
        metadata: {
          competitorsSeed: ['Microsoft', 'Google Workspace']
        }
      },
      pastCompetitors: [
        { competitors_json: ['HubSpot', 'Salesforce'] },
        { competitors_json: ['Zoho CRM', 'Freshworks'] }
      ]
    };
  }

  from(table: string) {
    return {
      select: (columns: string) => ({
        eq: (column: string, value: any) => ({
          single: () => {
            if (table === 'organizations') {
              return Promise.resolve({ data: this.mockData.organization, error: null });
            }
            return Promise.resolve({ data: null, error: null });
          },
          limit: (n: number) => Promise.resolve({ data: this.mockData.pastCompetitors, error: null }),
          gte: (column: string, date: string) => ({
            limit: (n: number) => Promise.resolve({ data: this.mockData.pastCompetitors, error: null })
          })
        }),
        not: (column: string, operator: string, value: any) => ({
          gte: (column: string, date: string) => ({
            limit: (n: number) => Promise.resolve({ data: this.mockData.pastCompetitors, error: null })
          })
        })
      }),
      insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: {}, error: null }) }) }),
      upsert: () => Promise.resolve({ data: {}, error: null })
    };
  }
}

// Test framework utilities
class TestRunner {
  private tests: Array<{
    name: string;
    fn: () => Promise<void>;
  }> = [];
  
  private passed = 0;
  private failed = 0;

  test(name: string, fn: () => Promise<void>) {
    this.tests.push({ name, fn });
  }

  async run() {
    console.log(`\n🧪 Running ${this.tests.length} competitor detection tests...\n`);

    for (const test of this.tests) {
      try {
        await test.fn();
        console.log(`✅ ${test.name}`);
        this.passed++;
      } catch (error: unknown) {
        console.log(`❌ ${test.name}`);
        console.log(`   Error: ${error instanceof Error ? error.message : String(error)}`);
        this.failed++;
      }
    }

    console.log(`\n📊 Test Results: ${this.passed} passed, ${this.failed} failed\n`);
    
    if (this.failed > 0) {
      throw new Error(`${this.failed} tests failed`);
    }
  }
}

// Assertion utilities
function assertEquals(actual: any, expected: any, message?: string) {
  const actualStr = JSON.stringify(actual);
  const expectedStr = JSON.stringify(expected);
  
  if (actualStr !== expectedStr) {
    throw new Error(
      `${message || 'Assertion failed'}\n` +
      `Expected: ${expectedStr}\n` +
      `Actual: ${actualStr}`
    );
  }
}

function assertArrayEquals(actual: any[], expected: any[], message?: string) {
  if (actual.length !== expected.length) {
    throw new Error(
      `${message || 'Array length mismatch'}\n` +
      `Expected length: ${expected.length}\n` +
      `Actual length: ${actual.length}\n` +
      `Expected: ${JSON.stringify(expected)}\n` +
      `Actual: ${JSON.stringify(actual)}`
    );
  }

  const actualSorted = [...actual].sort();
  const expectedSorted = [...expected].sort();

  for (let i = 0; i < actualSorted.length; i++) {
    if (actualSorted[i] !== expectedSorted[i]) {
      throw new Error(
        `${message || 'Array content mismatch'}\n` +
        `Expected: ${JSON.stringify(expectedSorted)}\n` +
        `Actual: ${JSON.stringify(actualSorted)}`
      );
    }
  }
}

// Main test suite
export async function runCompetitorDetectionTests() {
  const runner = new TestRunner();
  const mockSupabase = new MockSupabaseClient();

  runner.test('Test Case 1: Known competitors in sentence', async () => {
    const detector = new EnhancedCompetitorDetector(mockSupabase);
    const text = "HubSpot and Salesforce are top alternatives.";
    
    const result = await detector.detectCompetitors(text, 'test-org-id', {
      useNERFallback: false, // Disable NER for predictable testing
      maxCandidates: 10,
      confidenceThreshold: 0.5
    });

    const competitorNames = result.competitors.map(c => c.name);
    assertArrayEquals(
      competitorNames, 
      ['HubSpot', 'Salesforce'], 
      'Should detect HubSpot and Salesforce as competitors'
    );
  });

  runner.test('Test Case 2: Generic words should not be competitors', async () => {
    const detector = new EnhancedCompetitorDetector(mockSupabase);
    const text = "Using an all-in-one customer platform improves experience.";
    
    const result = await detector.detectCompetitors(text, 'test-org-id', {
      useNERFallback: false,
      maxCandidates: 10,
      confidenceThreshold: 0.5
    });

    const competitorNames = result.competitors.map(c => c.name);
    assertArrayEquals(
      competitorNames, 
      [], 
      'Should not detect any competitors from generic words'
    );
  });

  runner.test('Test Case 3: Compound brand names', async () => {
    const detector = new EnhancedCompetitorDetector(mockSupabase);
    const text = "Zoho CRM and Freshworks are gaining traction.";
    
    const result = await detector.detectCompetitors(text, 'test-org-id', {
      useNERFallback: false,
      maxCandidates: 10,
      confidenceThreshold: 0.5
    });

    const competitorNames = result.competitors.map(c => c.name);
    assertArrayEquals(
      competitorNames, 
      ['Zoho CRM', 'Freshworks'], 
      'Should detect compound brand names correctly'
    );
  });

  runner.test('Test Case 4: Stopwords only', async () => {
    const detector = new EnhancedCompetitorDetector(mockSupabase);
    const text = "While making decisions, user experience is important.";
    
    const result = await detector.detectCompetitors(text, 'test-org-id', {
      useNERFallback: false,
      maxCandidates: 10,
      confidenceThreshold: 0.5
    });

    const competitorNames = result.competitors.map(c => c.name);
    assertArrayEquals(
      competitorNames, 
      [], 
      'Should not detect stopwords as competitors'
    );
  });

  runner.test('Test Case 5: Mixed content with org brand', async () => {
    const detector = new EnhancedCompetitorDetector(mockSupabase);
    const text = "TestCorp competes with HubSpot and Salesforce while providing better experience.";
    
    const result = await detector.detectCompetitors(text, 'test-org-id', {
      useNERFallback: false,
      maxCandidates: 10,
      confidenceThreshold: 0.5
    });

    const competitorNames = result.competitors.map(c => c.name);
    const orgBrandNames = result.orgBrands.map(b => b.name);
    
    assertArrayEquals(
      competitorNames, 
      ['HubSpot', 'Salesforce'], 
      'Should detect competitors but not org brand'
    );
    
    assertArrayEquals(
      orgBrandNames, 
      ['TestCorp'], 
      'Should detect org brand separately'
    );
  });

  runner.test('Test Case 6: Case sensitivity and variants', async () => {
    const detector = new EnhancedCompetitorDetector(mockSupabase);
    const text = "hubspot and sales force are alternatives to our platform.";
    
    const result = await detector.detectCompetitors(text, 'test-org-id', {
      useNERFallback: false,
      maxCandidates: 10,
      confidenceThreshold: 0.5
    });

    const competitorNames = result.competitors.map(c => c.name);
    // Should match variants and normalize to proper names
    assertEquals(
      competitorNames.length >= 1, 
      true, 
      'Should detect at least one competitor from variants'
    );
  });

  runner.test('Test Case 7: Multiple mentions and position tracking', async () => {
    const detector = new EnhancedCompetitorDetector(mockSupabase);
    const text = "HubSpot is great. Many users prefer HubSpot over Salesforce. HubSpot has good features.";
    
    const result = await detector.detectCompetitors(text, 'test-org-id', {
      useNERFallback: false,
      maxCandidates: 10,
      confidenceThreshold: 0.5
    });

    const hubspotCompetitor = result.competitors.find(c => c.name === 'HubSpot');
    
    if (hubspotCompetitor) {
      assertEquals(
        hubspotCompetitor.mentions >= 2, 
        true, 
        'Should track multiple mentions correctly'
      );
      
      assertEquals(
        typeof hubspotCompetitor.first_pos_ratio === 'number', 
        true, 
        'Should track first position ratio'
      );
      
      assertEquals(
        hubspotCompetitor.first_pos_ratio >= 0 && hubspotCompetitor.first_pos_ratio <= 1, 
        true, 
        'First position ratio should be between 0 and 1'
      );
    }
  });

  runner.test('Test Case 8: Confidence and source tracking', async () => {
    const detector = new EnhancedCompetitorDetector(mockSupabase);
    const text = "HubSpot and Salesforce are top alternatives.";
    
    const result = await detector.detectCompetitors(text, 'test-org-id', {
      useNERFallback: false,
      maxCandidates: 10,
      confidenceThreshold: 0.5
    });

    for (const competitor of result.competitors) {
      assertEquals(
        typeof competitor.confidence === 'number', 
        true, 
        'Confidence should be a number'
      );
      
      assertEquals(
        competitor.confidence >= 0 && competitor.confidence <= 1, 
        true, 
        'Confidence should be between 0 and 1'
      );
      
      assertEquals(
        typeof competitor.source === 'string', 
        true, 
        'Source should be specified'
      );
      
      assertEquals(
        ['gazetteer', 'ner', 'catalog'].includes(competitor.source), 
        true, 
        'Source should be valid type'
      );
    }
  });

  runner.test('Test Case 9: Metadata validation', async () => {
    const detector = new EnhancedCompetitorDetector(mockSupabase);
    const text = "HubSpot and Salesforce are alternatives.";
    
    const result = await detector.detectCompetitors(text, 'test-org-id', {
      useNERFallback: false,
      maxCandidates: 10,
      confidenceThreshold: 0.5
    });

    assertEquals(
      typeof result.metadata.gazetteer_matches === 'number', 
      true, 
      'Should track gazetteer matches'
    );
    
    assertEquals(
      typeof result.metadata.ner_matches === 'number', 
      true, 
      'Should track NER matches'
    );
    
    assertEquals(
      typeof result.metadata.total_candidates === 'number', 
      true, 
      'Should track total candidates'
    );
    
    assertEquals(
      typeof result.metadata.processing_time_ms === 'number', 
      true, 
      'Should track processing time'
    );
    
    assertEquals(
      result.metadata.processing_time_ms >= 0, 
      true, 
      'Processing time should be non-negative'
    );
  });

  runner.test('Test Case 10: Rejected terms tracking', async () => {
    const detector = new EnhancedCompetitorDetector(mockSupabase);
    const text = "Using HubSpot while making decisions improves experience with customers.";
    
    const result = await detector.detectCompetitors(text, 'test-org-id', {
      useNERFallback: false,
      maxCandidates: 10,
      confidenceThreshold: 0.5
    });

    assertEquals(
      Array.isArray(result.rejectedTerms), 
      true, 
      'Should return rejected terms array'
    );
    
    // Should reject stopwords but accept HubSpot
    const competitorNames = result.competitors.map(c => c.name);
    assertEquals(
      competitorNames.includes('HubSpot'), 
      true, 
      'Should detect valid competitor'
    );
    
    // Check that stopwords are in rejected terms
    const hasStopwords = result.rejectedTerms.some(term => 
      ['Using', 'While', 'making', 'experience'].includes(term)
    );
    
    assertEquals(
      hasStopwords, 
      true, 
      'Should reject stopwords'
    );
  });

  await runner.run();
  return { passed: runner.passed, failed: runner.failed };
}

// Export for use in test runner
export { TestRunner, MockSupabaseClient };