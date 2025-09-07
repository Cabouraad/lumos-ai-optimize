/**
 * Integration tests for V2 analyzer backfill functionality
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { analyzeResponseV2 } from '../../lib/brand/analyzer-v2.ts';

describe('V2 Analyzer Backfill Integration', () => {
  const mockCarGurusContext = {
    orgData: {
      name: 'CarGurus',
      domain: 'cargurus.com',
      keywords: ['automotive', 'car marketplace'],
      competitors: [],
      products_services: ['vehicle search', 'dealer inventory']
    },
    brandCatalog: [
      {
        name: 'CarGurus',
        is_org_brand: true,
        variants_json: ['cargurus', 'car gurus', 'cargurus.com']
      },
      {
        name: 'Autotrader',
        is_org_brand: false,
        variants_json: ['autotrader', 'auto trader']
      }
    ],
    orgOverlay: {
      org_id: 'cargurus-test',
      competitor_overrides: [],
      competitor_exclusions: ['Generic Platform'], // Exclude generic terms
      brand_variants: []
    }
  };

  it('should detect CarGurus as org brand, not competitor', async () => {
    const response = `
      CarGurus stands out among automotive marketplaces like Autotrader, 
      Cars.com, and CarMax. Our platform offers unique dealer insights.
    `;

    const result = await analyzeResponseV2(response, mockCarGurusContext);

    expect(result.org_brand_present).toBe(true);
    expect(result.brands_json).toContain('CarGurus');
    expect(result.competitors_json).not.toContain('CarGurus');
    expect(result.competitors_json).toContain('Autotrader');
    expect(result.metadata.ruleset_version).toBe('v2');
  });

  it('should filter out false positive verbs', async () => {
    const response = `
      The platform allows users to search vehicles. It can be integrated 
      with dealer systems and should help customers find cars.
    `;

    const result = await analyzeResponseV2(response, mockCarGurusContext);

    // False positives should not appear as competitors
    expect(result.competitors_json).not.toContain('allows');
    expect(result.competitors_json).not.toContain('can');
    expect(result.competitors_json).not.toContain('should');
    expect(result.competitors_json).not.toContain('help');
  });

  it('should respect org overlay exclusions', async () => {
    const contextWithExclusions = {
      ...mockCarGurusContext,
      orgOverlay: {
        ...mockCarGurusContext.orgOverlay,
        competitor_exclusions: ['Autotrader'] // Exclude Autotrader
      }
    };

    const response = `
      CarGurus competes with Autotrader and Cars.com in the automotive space.
    `;

    const result = await analyzeResponseV2(response, contextWithExclusions);

    expect(result.competitors_json).not.toContain('Autotrader');
    // Other competitors should still be detected
    expect(result.competitors_json.length).toBeGreaterThan(0);
  });

  it('should apply cross-provider consensus boost', async () => {
    const contextWithConsensus = {
      ...mockCarGurusContext,
      crossProviderContext: {
        prompt_id: 'test-prompt',
        recent_competitors: ['CarMax', 'Carvana'] // These appeared in other providers
      }
    };

    const response = `
      CarGurus offers better insights than CarMax and Carvana platforms.
    `;

    const result = await analyzeResponseV2(response, contextWithConsensus);

    expect(result.competitors_json).toContain('CarMax');
    expect(result.competitors_json).toContain('Carvana');
    expect(result.metadata.consensus_boost_applied).toBe(true);
  });

  it('should maintain identical response shape to V1', async () => {
    const response = `CarGurus vs Autotrader comparison.`;
    const result = await analyzeResponseV2(response, mockCarGurusContext);

    // Check required V1 fields
    expect(result).toHaveProperty('org_brand_present');
    expect(result).toHaveProperty('org_brand_prominence');
    expect(result).toHaveProperty('competitors_json');
    expect(result).toHaveProperty('brands_json');
    expect(result).toHaveProperty('score');
    expect(result).toHaveProperty('metadata');

    // Check V1 metadata fields
    expect(result.metadata).toHaveProperty('org_brands_found');
    expect(result.metadata).toHaveProperty('catalog_competitors');
    expect(result.metadata).toHaveProperty('global_competitors');
    expect(result.metadata).toHaveProperty('discovered_competitors');
    expect(result.metadata).toHaveProperty('analysis_method');
    expect(result.metadata).toHaveProperty('confidence_score');

    // Check V2-specific metadata
    expect(result.metadata).toHaveProperty('ruleset_version', 'v2');
    expect(result.metadata).toHaveProperty('pipeline_stages');
    expect(result.metadata.pipeline_stages).toHaveProperty('candidates_extracted');
    expect(result.metadata.pipeline_stages).toHaveProperty('candidates_normalized');
    expect(result.metadata.pipeline_stages).toHaveProperty('candidates_filtered');
    expect(result.metadata.pipeline_stages).toHaveProperty('final_classified');
  });

  it('should process automotive industry competitors correctly', async () => {
    const response = `
      Top automotive marketplaces include CarGurus, Autotrader, Cars.com, 
      CarMax, Carvana, TrueCar, Edmunds, and Kelley Blue Book.
    `;

    const result = await analyzeResponseV2(response, mockCarGurusContext);

    // CarGurus should be detected as org brand
    expect(result.org_brand_present).toBe(true);
    expect(result.brands_json).toContain('CarGurus');

    // Known automotive competitors should be detected
    const expectedCompetitors = ['Autotrader', 'Cars.com', 'CarMax', 'Carvana', 'TrueCar', 'Edmunds', 'Kelley Blue Book'];
    const detectedCompetitors = result.competitors_json;

    expectedCompetitors.forEach(competitor => {
      expect(detectedCompetitors).toContain(competitor);
    });

    // Should have high confidence for industry-known brands
    expect(result.metadata.confidence_score).toBeGreaterThan(0.7);
  });

  it('should handle edge cases gracefully', async () => {
    const edgeCases = [
      '', // Empty response
      '   ', // Whitespace only
      'No brands mentioned here at all.', // No brands
      'CARGURUS AUTOTRADER CARS.COM', // All caps
      'cargurus vs autotrader', // All lowercase
    ];

    for (const testCase of edgeCases) {
      const result = await analyzeResponseV2(testCase, mockCarGurusContext);
      
      // Should not crash and return valid result
      expect(result).toBeDefined();
      expect(result.metadata.ruleset_version).toBe('v2');
      expect(Array.isArray(result.competitors_json)).toBe(true);
      expect(Array.isArray(result.brands_json)).toBe(true);
      expect(typeof result.score).toBe('number');
    }
  });
});

export default {};
