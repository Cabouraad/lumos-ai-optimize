import { describe, it, expect } from 'vitest';
import { detectBrandsV2, type DetectionInputs, type AccountBrand } from '../lib/detect/v2.ts';

/**
 * V2 Brand/Competitor Detection Tests
 * Pure function tests with no database dependencies
 */

describe('V2 Brand Detection', () => {
  // Helper to create test inputs
  const createTestInputs = (
    rawText: string, 
    accountBrand: Partial<AccountBrand> = {},
    competitorsSeed: string[] = []
  ): DetectionInputs => ({
    rawText,
    provider: 'test-provider',
    accountBrand: {
      canonical: 'Test Company',
      aliases: ['Test Co', 'TestCorp'],
      domain: 'test.com',
      ...accountBrand
    },
    competitorsSeed: [
      'HubSpot', 'Salesforce', 'Zoho', 'Mailchimp', 'Buffer', 'Hootsuite',
      'SEMrush', 'Ahrefs', 'BuzzSumo', 'Hotjar', 'Pipedrive',
      ...competitorsSeed
    ]
  });

  describe('True Competitors Detection', () => {
    it('should detect multiple competitors from text', () => {
      const inputs = createTestInputs(
        "HubSpot, Buffer, and Hootsuite are top tools for marketing automation."
      );
      
      const result = detectBrandsV2(inputs);
      
      expect(result.detectedCompetitors).toContain('HubSpot');
      expect(result.detectedCompetitors).toContain('Buffer');
      expect(result.detectedCompetitors).toContain('Hootsuite');
      expect(result.detectedCompetitors).toHaveLength(3);
    });

    it('should detect SEO-focused competitors', () => {
      const inputs = createTestInputs(
        "SEMrush and Ahrefs excel at SEO analysis and keyword research."
      );
      
      const result = detectBrandsV2(inputs);
      
      expect(result.detectedCompetitors).toContain('SEMrush');
      expect(result.detectedCompetitors).toContain('Ahrefs');
      expect(result.detectedCompetitors).toHaveLength(2);
    });

    it('should detect mixed case competitors correctly', () => {
      const inputs = createTestInputs(
        "mailchimp and HUBSPOT are popular with small businesses."
      );
      
      const result = detectBrandsV2(inputs);
      
      // Should normalize and detect these as proper brands
      expect(result.detectedCompetitors).toContain('Mailchimp');
      expect(result.detectedCompetitors).toContain('HubSpot');
    });
  });

  describe('False Positives Elimination', () => {
    it('should not detect generic marketing terms', () => {
      const inputs = createTestInputs(
        "Marketing automation and customer data are important for business growth."
      );
      
      const result = detectBrandsV2(inputs);
      
      expect(result.detectedCompetitors).toHaveLength(0);
      expect(result.detectedBrands).toHaveLength(0);
    });

    it('should not detect generic business phrases', () => {
      const inputs = createTestInputs(
        "Using an all-in-one platform can help you choose the right software solution."
      );
      
      const result = detectBrandsV2(inputs);
      
      expect(result.detectedCompetitors).toHaveLength(0);
      expect(result.detectedBrands).toHaveLength(0);
    });

    it('should filter out common stopwords', () => {
      const inputs = createTestInputs(
        "The best tools for analytics and data management include software platforms."
      );
      
      const result = detectBrandsV2(inputs);
      
      expect(result.detectedCompetitors).toHaveLength(0);
      expect(result.detectedBrands).toHaveLength(0);
    });

    it('should not detect purely numeric or special character strings', () => {
      const inputs = createTestInputs(
        "Version 2.0 includes features like [1], (2), and 123-456-789."
      );
      
      const result = detectBrandsV2(inputs);
      
      expect(result.detectedCompetitors).toHaveLength(0);
      expect(result.detectedBrands).toHaveLength(0);
    });
  });

  describe('Perplexity Style Text Processing', () => {
    it('should extract competitors from markdown bold text with citations', () => {
      const inputs = createTestInputs(
        "[1] **Mailchimp** and **Zapier** integrate well for automated workflows."
      );
      
      const result = detectBrandsV2(inputs);
      
      expect(result.detectedCompetitors).toContain('Mailchimp');
      expect(result.detectedCompetitors).toContain('Zapier');
      expect(result.detectedCompetitors).toHaveLength(2);
    });

    it('should extract competitors from markdown links', () => {
      const inputs = createTestInputs(
        "See [Google Analytics](https://analytics.google.com) and [BuzzSumo](https://buzzsumo.com) for insights."
      );
      
      const result = detectBrandsV2(inputs);
      
      expect(result.detectedCompetitors).toContain('Google Analytics');
      expect(result.detectedCompetitors).toContain('BuzzSumo');
      expect(result.detectedCompetitors).toHaveLength(2);
    });

    it('should extract brands from domain-only references', () => {
      const inputs = createTestInputs(
        "Sources: hubspot.com, hotjar.com, and salesforce.com provide comprehensive solutions."
      );
      
      const result = detectBrandsV2(inputs);
      
      expect(result.detectedCompetitors).toContain('HubSpot');
      expect(result.detectedCompetitors).toContain('Hotjar');
      expect(result.detectedCompetitors).toContain('Salesforce');
      expect(result.detectedCompetitors).toHaveLength(3);
    });

    it('should handle complex citation patterns', () => {
      const inputs = createTestInputs(
        "Research shows [1] that HubSpot (2023) and [^2] Mailchimp excel in email marketing."
      );
      
      const result = detectBrandsV2(inputs);
      
      expect(result.detectedCompetitors).toContain('HubSpot');
      expect(result.detectedCompetitors).toContain('Mailchimp');
      expect(result.detectedCompetitors).toHaveLength(2);
    });

    it('should preserve anchor text from complex markdown', () => {
      const inputs = createTestInputs(
        "Try [HubSpot Marketing Hub](https://hubspot.com/marketing) or [Active Campaign](https://activecampaign.com)."
      );
      
      const result = detectBrandsV2(inputs);
      
      expect(result.detectedCompetitors).toContain('HubSpot Marketing Hub');
      expect(result.detectedCompetitors).toContain('Active Campaign');
    });
  });

  describe('Brand Recognition (User Brand Detection)', () => {
    it('should detect user brand by exact canonical name', () => {
      const inputs = createTestInputs(
        "Acme CRM is compared with Zoho and Pipedrive for small businesses.",
        {
          canonical: 'Acme CRM',
          aliases: ['Acme', 'AcmeCRM'],
          domain: 'acmecrm.com'
        }
      );
      
      const result = detectBrandsV2(inputs);
      
      expect(result.detectedBrands).toContain('Acme CRM');
      expect(result.detectedCompetitors).toContain('Zoho');
      expect(result.detectedCompetitors).toContain('Pipedrive');
      expect(result.detectedCompetitors).not.toContain('Acme CRM');
    });

    it('should detect user brand by alias', () => {
      const inputs = createTestInputs(
        "AcmeCRM and Salesforce compete in the enterprise market.",
        {
          canonical: 'Acme CRM',
          aliases: ['Acme', 'AcmeCRM'],
          domain: 'acmecrm.com'
        }
      );
      
      const result = detectBrandsV2(inputs);
      
      expect(result.detectedBrands).toContain('AcmeCRM');
      expect(result.detectedCompetitors).toContain('Salesforce');
      expect(result.detectedCompetitors).not.toContain('AcmeCRM');
    });

    it('should detect user brand from domain reference', () => {
      const inputs = createTestInputs(
        "Visit acmecrm.com to see how it compares with HubSpot and Zoho.",
        {
          canonical: 'Acme CRM', 
          aliases: ['Acme'],
          domain: 'acmecrm.com'
        }
      );
      
      const result = detectBrandsV2(inputs);
      
      // Should detect AcmeCRM from domain conversion
      expect(result.detectedBrands.some(brand => 
        brand.toLowerCase().includes('acme')
      )).toBe(true);
      expect(result.detectedCompetitors).toContain('HubSpot');
      expect(result.detectedCompetitors).toContain('Zoho');
    });

    it('should handle possessive and plural variations', () => {
      const inputs = createTestInputs(
        "Acme's features and Acme CRMs capabilities exceed those of Pipedrive.",
        {
          canonical: 'Acme CRM',
          aliases: ['Acme'],
          domain: 'acmecrm.com'
        }
      );
      
      const result = detectBrandsV2(inputs);
      
      expect(result.detectedBrands.length).toBeGreaterThan(0);
      expect(result.detectedCompetitors).toContain('Pipedrive');
    });

    it('should use fuzzy matching for minor variations', () => {
      const inputs = createTestInputs(
        "Acme-CRM and Acme CRM platform outperform Zoho in usability.",
        {
          canonical: 'Acme CRM',
          aliases: ['Acme'],
          domain: 'acmecrm.com'
        }
      );
      
      const result = detectBrandsV2(inputs);
      
      expect(result.detectedBrands.length).toBeGreaterThan(0);
      expect(result.detectedCompetitors).toContain('Zoho');
    });
  });

  describe('Edge Cases and Robustness', () => {
    it('should handle empty input text', () => {
      const inputs = createTestInputs('');
      
      const result = detectBrandsV2(inputs);
      
      expect(result.detectedBrands).toHaveLength(0);
      expect(result.detectedCompetitors).toHaveLength(0);
      expect(result.metadata.candidatesGenerated).toBe(0);
    });

    it('should handle text with only whitespace and punctuation', () => {
      const inputs = createTestInputs('   !!!   ??? ,,, ... ');
      
      const result = detectBrandsV2(inputs);
      
      expect(result.detectedBrands).toHaveLength(0);
      expect(result.detectedCompetitors).toHaveLength(0);
    });

    it('should deduplicate similar brand mentions', () => {
      const inputs = createTestInputs(
        "HubSpot and Hubspot and HubSpot Marketing Hub are mentioned multiple times."
      );
      
      const result = detectBrandsV2(inputs);
      
      // Should deduplicate similar mentions
      const hubspotMentions = result.detectedCompetitors.filter(c => 
        c.toLowerCase().includes('hubspot')
      );
      expect(hubspotMentions.length).toBeLessThanOrEqual(2); // Allow for variant forms
    });

    it('should handle very long text efficiently', () => {
      const longText = 'HubSpot is great. '.repeat(1000) + 'Mailchimp too.';
      const inputs = createTestInputs(longText);
      
      const result = detectBrandsV2(inputs);
      
      expect(result.detectedCompetitors).toContain('HubSpot');
      expect(result.detectedCompetitors).toContain('Mailchimp');
      expect(result.metadata.processingTimeMs).toBeLessThan(1000); // Should be fast
    });

    it('should respect length limits for candidates', () => {
      const inputs = createTestInputs(
        "VeryLongBrandNameThatExceedsThirtyCharacters and AB and HubSpot compete."
      );
      
      const result = detectBrandsV2(inputs);
      
      expect(result.detectedCompetitors).toContain('HubSpot');
      expect(result.detectedCompetitors).not.toContain('VeryLongBrandNameThatExceedsThirtyCharacters');
      expect(result.detectedCompetitors).not.toContain('AB'); // Too short
    });
  });

  describe('Metadata and Performance', () => {
    it('should provide comprehensive metadata', () => {
      const inputs = createTestInputs(
        "HubSpot and [Mailchimp](https://mailchimp.com) are popular choices."
      );
      
      const result = detectBrandsV2(inputs);
      
      expect(result.metadata).toMatchObject({
        candidatesGenerated: expect.any(Number),
        candidatesFiltered: expect.any(Number),
        gazetteerSize: expect.any(Number),
        processingTimeMs: expect.any(Number),
        preprocessing: {
          originalLength: expect.any(Number),
          processedLength: expect.any(Number),
          anchorsExtracted: expect.any(Number),
          domainsExtracted: expect.any(Number)
        }
      });
      
      expect(result.metadata.candidatesGenerated).toBeGreaterThanOrEqual(
        result.metadata.candidatesFiltered
      );
    });

    it('should track preprocessing effects', () => {
      const inputs = createTestInputs(
        "[1] **HubSpot** and [Mailchimp](https://mailchimp.com) with lots of markdown **formatting**."
      );
      
      const result = detectBrandsV2(inputs);
      
      expect(result.metadata.preprocessing.anchorsExtracted).toBeGreaterThan(0);
      expect(result.metadata.preprocessing.domainsExtracted).toBeGreaterThan(0);
      expect(result.metadata.preprocessing.processedLength).toBeLessThan(
        result.metadata.preprocessing.originalLength
      );
    });

    it('should be reasonably fast for typical inputs', () => {
      const inputs = createTestInputs(
        "HubSpot, Mailchimp, Salesforce, Zoho, and Pipedrive are leading CRM solutions."
      );
      
      const result = detectBrandsV2(inputs);
      
      expect(result.metadata.processingTimeMs).toBeLessThan(100); // Should be very fast
      expect(result.detectedCompetitors.length).toBeGreaterThan(0);
    });
  });
});