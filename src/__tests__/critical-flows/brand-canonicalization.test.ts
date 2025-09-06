/**
 * Test brand canonicalization to prevent self-competitor recommendations
 */

import { describe, it, expect } from 'vitest';

// Mock the brand matching utilities
const mockBrandCatalog = [
  {
    id: '1',
    name: 'HubSpot',
    variants_json: ['hubspot', 'hub-spot', 'hubspot.com', 'Marketing Hub'],
    is_org_brand: true
  },
  {
    id: '2', 
    name: 'Salesforce',
    variants_json: ['salesforce', 'salesforce.com', 'SFDC'],
    is_org_brand: false
  },
  {
    id: '3',
    name: 'Microsoft',
    variants_json: ['microsoft', 'msft', 'microsoft.com'],
    is_org_brand: false
  }
];

// Simple implementation for testing
function normalize(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function toCanonical(catalog: any[]): Map<string, any> {
  const canonicalMap = new Map();
  
  for (const brand of catalog) {
    const canonical = brand.name.trim();
    const normalizedCanonical = normalize(canonical);
    const variants = [canonical, ...(brand.variants_json || [])];
    
    const canonicalBrand = {
      canonical,
      isOrgBrand: brand.is_org_brand,
      variants
    };
    
    canonicalMap.set(normalizedCanonical, canonicalBrand);
    
    for (const variant of variants) {
      const normalizedVariant = normalize(variant);
      if (normalizedVariant && normalizedVariant.length >= 3) {
        canonicalMap.set(normalizedVariant, canonicalBrand);
      }
    }
  }
  
  return canonicalMap;
}

function cleanCompetitorList(brands: string[], canonicalMap: Map<string, any>): Array<{ canonical: string; mentions: number }> {
  const competitorCounts = new Map<string, number>();
  const excludeTerms = ['openai', 'claude', 'copilot', 'google', 'chatgpt', 'ai', 'microsoft', 'meta', 'facebook'];
  
  for (const brand of brands) {
    if (typeof brand !== 'string' || brand.length < 3) continue;
    
    const normalized = normalize(brand);
    
    // Skip generic AI terms
    if (excludeTerms.some(term => normalized.includes(term))) continue;
    
    const canonical = canonicalMap.get(normalized);
    
    // Skip org brands
    if (canonical?.isOrgBrand) continue;
    
    const canonicalName = canonical?.canonical || brand.trim();
    competitorCounts.set(canonicalName, (competitorCounts.get(canonicalName) || 0) + 1);
  }
  
  return Array.from(competitorCounts.entries())
    .map(([canonical, mentions]) => ({ canonical, mentions }))
    .sort((a, b) => b.mentions - a.mentions);
}

describe('Brand Canonicalization', () => {
  it('should map variants to canonical forms correctly', () => {
    const canonicalMap = toCanonical(mockBrandCatalog);
    
    // Test HubSpot variants
    expect(canonicalMap.get('hubspot')?.canonical).toBe('HubSpot');
    expect(canonicalMap.get('hub spot')?.canonical).toBe('HubSpot');
    expect(canonicalMap.get('marketing hub')?.canonical).toBe('HubSpot');
    
    // Test Salesforce variants
    expect(canonicalMap.get('salesforce')?.canonical).toBe('Salesforce');
    expect(canonicalMap.get('sfdc')?.canonical).toBe('Salesforce');
  });

  it('should correctly identify org brands', () => {
    const canonicalMap = toCanonical(mockBrandCatalog);
    
    // HubSpot should be marked as org brand
    expect(canonicalMap.get('hubspot')?.isOrgBrand).toBe(true);
    expect(canonicalMap.get('marketing hub')?.isOrgBrand).toBe(true);
    
    // Salesforce should not be org brand
    expect(canonicalMap.get('salesforce')?.isOrgBrand).toBe(false);
  });

  it('should exclude org brands from competitor list', () => {
    const canonicalMap = toCanonical(mockBrandCatalog);
    const testBrands = ['HubSpot', 'hub-spot', 'Marketing Hub', 'Salesforce', 'OpenAI'];
    
    const competitors = cleanCompetitorList(testBrands, canonicalMap);
    
    // Should only include Salesforce, excluding HubSpot variants and OpenAI
    expect(competitors).toHaveLength(1);
    expect(competitors[0].canonical).toBe('Salesforce');
    expect(competitors[0].mentions).toBe(1);
  });

  it('should exclude generic AI terms', () => {
    const canonicalMap = toCanonical(mockBrandCatalog);
    const testBrands = ['OpenAI', 'ChatGPT', 'Claude', 'Microsoft Copilot', 'Salesforce'];
    
    const competitors = cleanCompetitorList(testBrands, canonicalMap);
    
    // Should only include Salesforce
    expect(competitors).toHaveLength(1);
    expect(competitors[0].canonical).toBe('Salesforce');
  });

  it('should aggregate mentions for canonical brands', () => {
    const canonicalMap = toCanonical(mockBrandCatalog);
    const testBrands = ['Salesforce', 'salesforce.com', 'SFDC', 'salesforce'];
    
    const competitors = cleanCompetitorList(testBrands, canonicalMap);
    
    // Should aggregate all Salesforce variants
    expect(competitors).toHaveLength(1);
    expect(competitors[0].canonical).toBe('Salesforce');
    expect(competitors[0].mentions).toBe(4);
  });

  it('should handle unknown brands correctly', () => {
    const canonicalMap = toCanonical(mockBrandCatalog);
    const testBrands = ['Unknown Brand', 'Another Tool', 'Salesforce'];
    
    const competitors = cleanCompetitorList(testBrands, canonicalMap);
    
    // Should include all brands (Unknown Brand, Another Tool mapped to themselves, Salesforce canonical)
    expect(competitors).toHaveLength(3);
    
    const canonicalNames = competitors.map(c => c.canonical);
    expect(canonicalNames).toContain('Salesforce');
    expect(canonicalNames).toContain('Unknown Brand');
    expect(canonicalNames).toContain('Another Tool');
  });

  it('should prevent HubSpot vs HubSpot recommendations', () => {
    const canonicalMap = toCanonical(mockBrandCatalog);
    const testBrands = ['HubSpot', 'Marketing Hub', 'hub-spot', 'Salesforce'];
    
    const competitors = cleanCompetitorList(testBrands, canonicalMap);
    
    // Should NOT include any HubSpot variants as competitors
    const hubspotCompetitor = competitors.find(c => 
      c.canonical.toLowerCase().includes('hubspot') || 
      c.canonical.toLowerCase().includes('marketing hub')
    );
    
    expect(hubspotCompetitor).toBeUndefined();
    expect(competitors).toHaveLength(1);
    expect(competitors[0].canonical).toBe('Salesforce');
  });
});