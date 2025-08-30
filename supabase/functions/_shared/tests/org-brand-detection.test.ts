/**
 * Unit tests for org brand detection (specifically "Brand + CRM" scenarios)
 */

import { EnhancedCompetitorDetector } from '../enhanced-competitor-detector.ts';

// Mock Supabase client for testing
class MockSupabaseClient {
  private orgData: any;
  private brandCatalog: any[];

  constructor(orgData: any, brandCatalog: any[]) {
    this.orgData = orgData;
    this.brandCatalog = brandCatalog;
  }

  from(table: string) {
    if (table === 'organizations') {
      return {
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve({ data: this.orgData })
          })
        })
      };
    }
    
    if (table === 'brand_catalog') {
      return {
        select: () => ({
          eq: () => Promise.resolve({ data: this.brandCatalog })
        })
      };
    }
    
    if (table === 'prompt_provider_responses') {
      return {
        select: () => ({
          eq: () => ({
            gte: () => ({
              eq: () => ({
                limit: () => Promise.resolve({ data: [] })
              })
            })
          })
        })
      };
    }
    
    return {
      select: () => Promise.resolve({ data: [] })
    };
  }
}

interface TestCase {
  name: string;
  orgData: any;
  brandCatalog: any[];
  text: string;
  expectedOrgBrands: string[];
  expectedCompetitors: string[];
}

const TEST_CASES: TestCase[] = [
  {
    name: 'HubSpot CRM should be recognized as org brand',
    orgData: {
      name: 'HubSpot',
      domain: 'hubspot.com',
      metadata: {}
    },
    brandCatalog: [
      { name: 'HubSpot', variants_json: [], is_org_brand: true }
    ],
    text: 'Our HubSpot CRM platform helps you manage customer relationships effectively.',
    expectedOrgBrands: ['HubSpot CRM'],
    expectedCompetitors: []
  },
  {
    name: 'Salesforce CRM vs HubSpot should identify both correctly',
    orgData: {
      name: 'HubSpot',
      domain: 'hubspot.com',
      metadata: {}
    },
    brandCatalog: [
      { name: 'HubSpot', variants_json: [], is_org_brand: true }
    ],
    text: 'While Salesforce CRM is popular, our HubSpot Marketing Hub offers better value.',
    expectedOrgBrands: ['HubSpot Marketing Hub'],
    expectedCompetitors: ['Salesforce CRM']
  },
  {
    name: 'Multiple org brand aliases should be recognized',
    orgData: {
      name: 'Acme Corp',
      domain: 'acme.com',
      metadata: {}
    },
    brandCatalog: [
      { name: 'Acme Corp', variants_json: ['Acme', 'ACME'], is_org_brand: true }
    ],
    text: 'Try Acme CRM, Acme Platform, and Acme Software for all your needs.',
    expectedOrgBrands: ['Acme CRM', 'Acme Platform', 'Acme Software'],
    expectedCompetitors: []
  },
  {
    name: 'Domain-based brand detection',
    orgData: {
      name: 'TechStartup Inc',
      domain: 'techstartup.io',
      metadata: {}
    },
    brandCatalog: [],
    text: 'TechStartup CRM is the best choice for small businesses.',
    expectedOrgBrands: ['TechStartup CRM'],
    expectedCompetitors: []
  },
  {
    name: 'Complex scenario with multiple brands and competitors',
    orgData: {
      name: 'ZoomInfo',
      domain: 'zoominfo.com',
      metadata: {}
    },
    brandCatalog: [
      { name: 'ZoomInfo', variants_json: [], is_org_brand: true }
    ],
    text: 'ZoomInfo Platform beats Salesforce, HubSpot, and Pipedrive in lead generation.',
    expectedOrgBrands: ['ZoomInfo Platform'],
    expectedCompetitors: ['Salesforce', 'HubSpot', 'Pipedrive']
  }
];

async function runOrgBrandDetectionTests(): Promise<{ passed: number; failed: number }> {
  let passed = 0;
  let failed = 0;

  console.log('🧪 Running Org Brand Detection Tests');
  console.log('=====================================');

  for (let i = 0; i < TEST_CASES.length; i++) {
    const testCase = TEST_CASES[i];
    console.log(`\n📋 Test ${i + 1}: ${testCase.name}`);
    
    try {
      // Create mock Supabase client
      const mockSupabase = new MockSupabaseClient(testCase.orgData, testCase.brandCatalog);
      
      // Create detector and run detection
      const detector = new EnhancedCompetitorDetector(mockSupabase as any);
      const result = await detector.detectCompetitors(testCase.text, 'test-org-id', {
        useNERFallback: false, // Disable NER for consistent testing
        maxCandidates: 20
      });
      
      console.log(`📄 Text: "${testCase.text}"`);
      console.log(`🏷️  Found org brands: [${result.orgBrands.map(b => b.name).join(', ')}]`);
      console.log(`🎯 Found competitors: [${result.competitors.map(c => c.name).join(', ')}]`);
      
      // Check org brands
      const foundOrgBrands = result.orgBrands.map(b => b.name);
      const orgBrandsMatch = testCase.expectedOrgBrands.every(expected => 
        foundOrgBrands.some(found => found === expected)
      ) && foundOrgBrands.every(found =>
        testCase.expectedOrgBrands.some(expected => expected === found)
      );
      
      // Check competitors
      const foundCompetitors = result.competitors.map(c => c.name);
      const competitorsMatch = testCase.expectedCompetitors.every(expected =>
        foundCompetitors.some(found => found === expected)
      );
      
      if (orgBrandsMatch && competitorsMatch) {
        console.log('✅ PASS');
        passed++;
      } else {
        console.log('❌ FAIL');
        console.log(`   Expected org brands: [${testCase.expectedOrgBrands.join(', ')}]`);
        console.log(`   Expected competitors: [${testCase.expectedCompetitors.join(', ')}]`);
        failed++;
      }
      
    } catch (error) {
      console.log('❌ FAIL - Error:', error.message);
      failed++;
    }
  }

  return { passed, failed };
}

// Export for use in test runner
export { runOrgBrandDetectionTests };

// Run tests if this file is executed directly
if (import.meta.main) {
  const results = await runOrgBrandDetectionTests();
  console.log('\n=====================================');
  console.log(`📊 Final Results: ${results.passed} passed, ${results.failed} failed`);
  
  if (results.failed === 0) {
    console.log('🎉 All org brand detection tests passed!');
    Deno.exit(0);
  } else {
    console.log('💥 Some tests failed.');
    Deno.exit(1);
  }
}