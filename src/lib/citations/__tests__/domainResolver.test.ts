import { describe, it, expect } from 'vitest';
import { resolveDomainToBrand, checkCompetitorMatch, enrichCitation } from '../domainResolver';

describe('Domain Resolver', () => {
  describe('resolveDomainToBrand', () => {
    it('should resolve known domains correctly', () => {
      const result = resolveDomainToBrand('cars.com');
      expect(result.brand).toBe('Cars.com');
      expect(result.canonicalDomain).toBe('cars.com');
      expect(result.type).toBe('known');
    });

    it('should handle www prefix', () => {
      const result = resolveDomainToBrand('www.cargurus.com');
      expect(result.brand).toBe('CarGurus');
      expect(result.canonicalDomain).toBe('cargurus.com');
      expect(result.type).toBe('known');
    });

    it('should handle URLs with protocols', () => {
      const result = resolveDomainToBrand('https://autotrader.com/listings');
      expect(result.brand).toBe('Autotrader');
      expect(result.canonicalDomain).toBe('autotrader.com');
      expect(result.type).toBe('known');
    });

    it('should apply heuristic mapping for unknown domains', () => {
      const result = resolveDomainToBrand('example-startup.com');
      expect(result.brand).toBe('Example Startup');
      expect(result.canonicalDomain).toBe('example-startup.com');
      expect(result.type).toBe('heuristic');
    });

    it('should handle domains with hyphens', () => {
      const result = resolveDomainToBrand('tech-blog.org');
      expect(result.brand).toBe('Tech Blog');
      expect(result.canonicalDomain).toBe('tech-blog.org');
      expect(result.type).toBe('heuristic');
    });

    it('should return unknown for invalid inputs', () => {
      const result = resolveDomainToBrand('invalid');
      expect(result.type).toBe('unknown');
    });

    it('should handle empty input', () => {
      const result = resolveDomainToBrand('');
      expect(result.brand).toBe('Unknown');
      expect(result.type).toBe('unknown');
    });
  });

  describe('checkCompetitorMatch', () => {
    const mockCompetitors = [
      { name: 'CarGurus', variants_json: ['cargurus', 'car-gurus'] },
      { name: 'Cars.com', variants_json: ['cars', 'cars.com'] },
      { name: 'Autotrader', variants_json: null }
    ];

    it('should match exact brand name', () => {
      const resolvedBrand = { brand: 'CarGurus', canonicalDomain: 'cargurus.com', type: 'known' as const };
      const isMatch = checkCompetitorMatch(resolvedBrand, mockCompetitors);
      expect(isMatch).toBe(true);
    });

    it('should match brand variants', () => {
      const resolvedBrand = { brand: 'Cars', canonicalDomain: 'cars.com', type: 'heuristic' as const };
      const isMatch = checkCompetitorMatch(resolvedBrand, mockCompetitors);
      expect(isMatch).toBe(true);
    });

    it('should not match non-competitors', () => {
      const resolvedBrand = { brand: 'Google', canonicalDomain: 'google.com', type: 'known' as const };
      const isMatch = checkCompetitorMatch(resolvedBrand, mockCompetitors);
      expect(isMatch).toBe(false);
    });

    it('should handle empty competitor catalog', () => {
      const resolvedBrand = { brand: 'CarGurus', canonicalDomain: 'cargurus.com', type: 'known' as const };
      const isMatch = checkCompetitorMatch(resolvedBrand, []);
      expect(isMatch).toBe(false);
    });
  });

  describe('enrichCitation', () => {
    const mockCompetitors = [
      { name: 'CarGurus', variants_json: ['cargurus'] }
    ];

    it('should enrich citation with resolved brand', () => {
      const citation = {
        url: 'https://cargurus.com/article',
        domain: 'cargurus.com',
        brand_mention: 'unknown'
      };

      const enriched = enrichCitation(citation, mockCompetitors);

      expect(enriched.resolved_brand).toBeDefined();
      expect(enriched.resolved_brand.brand).toBe('CarGurus');
      expect(enriched.is_competitor).toBe(true);
    });

    it('should handle citation without domain', () => {
      const citation = { url: 'invalid', brand_mention: 'unknown' };
      const enriched = enrichCitation(citation, mockCompetitors);
      expect(enriched).toEqual(citation);
    });

    it('should mark non-competitor sources correctly', () => {
      const citation = {
        url: 'https://google.com/search',
        domain: 'google.com',
        brand_mention: 'no'
      };

      const enriched = enrichCitation(citation, mockCompetitors);
      expect(enriched.is_competitor).toBe(false);
      expect(enriched.resolved_brand.brand).toBe('Google');
    });
  });
});