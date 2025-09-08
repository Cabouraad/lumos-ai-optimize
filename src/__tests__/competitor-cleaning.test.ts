import { describe, it, expect } from 'vitest';
import { cleanCompetitors } from '../lib/brand/competitor-cleaning';

describe('cleanCompetitors', () => {
  const orgBrandVariants = ['cargurus', 'car gurus', 'cargurus.com'];

  describe('basic filtering', () => {
    it('should remove org brand from competitors', () => {
      const input = ['HubSpot', 'CarGurus', 'Salesforce', 'Car Gurus'];
      const result = cleanCompetitors(input, orgBrandVariants);
      
      expect(result).not.toContain('CarGurus');
      expect(result).not.toContain('Car Gurus');
      expect(result).toContain('HubSpot');
      expect(result).toContain('Salesforce');
    });

    it('should remove generic business terms', () => {
      const input = ['HubSpot', 'Company', 'Platform', 'Software', 'Salesforce', 'Tool'];
      const result = cleanCompetitors(input, orgBrandVariants);
      
      expect(result).toContain('HubSpot');
      expect(result).toContain('Salesforce');
      expect(result).not.toContain('Company');
      expect(result).not.toContain('Platform');
      expect(result).not.toContain('Software');
      expect(result).not.toContain('Tool');
    });

    it('should remove very short tokens', () => {
      const input = ['HubSpot', 'A', 'An', 'I', 'It', 'Salesforce'];
      const result = cleanCompetitors(input, orgBrandVariants);
      
      expect(result).toContain('HubSpot');
      expect(result).toContain('Salesforce');
      expect(result).not.toContain('A');
      expect(result).not.toContain('An');
      expect(result).not.toContain('I');
      expect(result).not.toContain('It');
    });

    it('should remove purely numeric tokens', () => {
      const input = ['HubSpot', '123', '456', 'Salesforce', '7'];
      const result = cleanCompetitors(input, orgBrandVariants);
      
      expect(result).toContain('HubSpot');
      expect(result).toContain('Salesforce');
      expect(result).not.toContain('123');
      expect(result).not.toContain('456');
      expect(result).not.toContain('7');
    });
  });

  describe('deduplication', () => {
    it('should deduplicate case-insensitively', () => {
      const input = ['HubSpot', 'hubspot', 'HUBSPOT', 'HubSpot'];
      const result = cleanCompetitors(input, orgBrandVariants);
      
      expect(result).toHaveLength(1);
      expect(result[0]).toBe('HubSpot'); // Should keep the first/best version
    });

    it('should prefer longer versions when deduplicating', () => {
      const input = ['Slack', 'Slack Technologies'];
      const result = cleanCompetitors(input, orgBrandVariants);
      
      expect(result).toHaveLength(1);
      expect(result[0]).toBe('Slack Technologies');
    });
  });

  describe('problematic content filtering', () => {
    it('should remove tokens with problematic characters', () => {
      const input = ['HubSpot', '<script>', '{config}', '[data]', 'Salesforce'];
      const result = cleanCompetitors(input, orgBrandVariants);
      
      expect(result).toContain('HubSpot');
      expect(result).toContain('Salesforce');
      expect(result).not.toContain('<script>');
      expect(result).not.toContain('{config}');
      expect(result).not.toContain('[data]');
    });

    it('should remove spam patterns', () => {
      const input = ['HubSpot', 'Click Here', 'Learn More', 'Sign Up', 'Salesforce'];
      const result = cleanCompetitors(input, orgBrandVariants);
      
      expect(result).toContain('HubSpot');
      expect(result).toContain('Salesforce');
      expect(result).not.toContain('Click Here');
      expect(result).not.toContain('Learn More');
      expect(result).not.toContain('Sign Up');
    });

    it('should remove overly long tokens', () => {
      const longText = 'This is a very long competitor name that is probably a sentence fragment and should be filtered out';
      const input = ['HubSpot', longText, 'Salesforce'];
      const result = cleanCompetitors(input, orgBrandVariants);
      
      expect(result).toContain('HubSpot');
      expect(result).toContain('Salesforce');
      expect(result).not.toContain(longText);
    });
  });

  describe('catalog filter integration', () => {
    it('should apply catalog filter when provided', () => {
      const input = ['HubSpot', 'Salesforce', 'UnknownBrand', 'Pipedrive'];
      const catalogFilter = (names: string[]) => names.filter(name => 
        ['HubSpot', 'Salesforce', 'Pipedrive'].includes(name)
      );
      
      const result = cleanCompetitors(input, orgBrandVariants, { catalogFilter });
      
      expect(result).toContain('HubSpot');
      expect(result).toContain('Salesforce');
      expect(result).toContain('Pipedrive');
      expect(result).not.toContain('UnknownBrand');
    });

    it('should fallback to heuristic results if catalog filter fails', () => {
      const input = ['HubSpot', 'Salesforce'];
      const catalogFilter = () => { throw new Error('Catalog unavailable'); };
      
      const result = cleanCompetitors(input, orgBrandVariants, { catalogFilter });
      
      expect(result).toContain('HubSpot');
      expect(result).toContain('Salesforce');
    });

    it('should fallback to heuristic results if catalog filter returns empty', () => {
      const input = ['HubSpot', 'Salesforce'];
      const catalogFilter = () => [];
      
      const result = cleanCompetitors(input, orgBrandVariants, { catalogFilter });
      
      expect(result).toContain('HubSpot');
      expect(result).toContain('Salesforce');
    });
  });

  describe('edge cases', () => {
    it('should handle empty input', () => {
      const result = cleanCompetitors([], orgBrandVariants);
      expect(result).toEqual([]);
    });

    it('should handle null/undefined input', () => {
      const result1 = cleanCompetitors(null as any, orgBrandVariants);
      const result2 = cleanCompetitors(undefined as any, orgBrandVariants);
      
      expect(result1).toEqual([]);
      expect(result2).toEqual([]);
    });

    it('should handle empty org brand variants', () => {
      const input = ['HubSpot', 'Salesforce'];
      const result = cleanCompetitors(input, []);
      
      expect(result).toContain('HubSpot');
      expect(result).toContain('Salesforce');
    });

    it('should handle mixed valid and invalid entries', () => {
      const input = ['HubSpot', '', null, undefined, 'Salesforce', '   '];
      const result = cleanCompetitors(input as any, orgBrandVariants);
      
      expect(result).toContain('HubSpot');
      expect(result).toContain('Salesforce');
      expect(result).toHaveLength(2);
    });
  });

  describe('sorting and limiting', () => {
    it('should sort results by length and alphabetically', () => {
      const input = ['Zendesk', 'Salesforce CRM', 'HubSpot', 'Pipedrive', 'Salesforce'];
      const result = cleanCompetitors(input, orgBrandVariants);
      
      // Should prefer shorter names first
      const firstFew = result.slice(0, 3);
      expect(firstFew).toContain('HubSpot');
      expect(firstFew).toContain('Zendesk');
    });

    it('should limit results to reasonable number', () => {
      const manyCompetitors = Array.from({ length: 30 }, (_, i) => `Competitor${i}`);
      const result = cleanCompetitors(manyCompetitors, orgBrandVariants);
      
      expect(result.length).toBeLessThanOrEqual(20);
    });
  });
});