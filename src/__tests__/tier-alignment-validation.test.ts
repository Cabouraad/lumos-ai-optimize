import { describe, it, expect } from 'vitest';
import { getQuotasForTier } from '../../lib/tiers/quotas';
import { getAllowedProviders } from '@/lib/providers/tier-policy';

describe('Tier Alignment Validation', () => {
  describe('Frontend Quota Configuration', () => {
    it('starter should have correct quotas', () => {
      const quotas = getQuotasForTier('starter');
      
      expect(quotas.promptsPerDay).toBe(25);
      expect(quotas.providersPerPrompt).toBe(2);
    });

    it('growth should have correct quotas', () => {
      const quotas = getQuotasForTier('growth');
      
      expect(quotas.promptsPerDay).toBe(100);
      expect(quotas.providersPerPrompt).toBe(4);
    });

    it('pro should have correct quotas', () => {
      const quotas = getQuotasForTier('pro');
      
      expect(quotas.promptsPerDay).toBe(300);
      expect(quotas.providersPerPrompt).toBe(4);
    });

    it('free tier should have correct quotas', () => {
      const quotas = getQuotasForTier('free');
      
      expect(quotas.promptsPerDay).toBe(5);
      expect(quotas.providersPerPrompt).toBe(1);
    });
  });

  describe('Provider Access Alignment with Pricing Page', () => {
    it('starter should have 2 providers (OpenAI + Perplexity)', () => {
      const providers = getAllowedProviders('starter');
      expect(providers).toHaveLength(2);
      expect(providers).toContain('openai');
      expect(providers).toContain('perplexity');
    });

    it('growth should have 4 providers (all)', () => {
      const providers = getAllowedProviders('growth');
      expect(providers).toHaveLength(4);
      expect(providers).toContain('openai');
      expect(providers).toContain('perplexity');
      expect(providers).toContain('gemini');
      expect(providers).toContain('google_ai_overview');
    });

    it('pro should have 4 providers (all)', () => {
      const providers = getAllowedProviders('pro');
      expect(providers).toHaveLength(4);
      expect(providers).toContain('openai');
      expect(providers).toContain('perplexity');
      expect(providers).toContain('gemini');
      expect(providers).toContain('google_ai_overview');
    });

    it('free should have 1 provider (OpenAI only)', () => {
      const providers = getAllowedProviders('free');
      expect(providers).toHaveLength(1);
      expect(providers).toContain('openai');
    });
  });

  describe('Pricing Page Alignment', () => {
    // These values match what's displayed on the pricing page
    const pricingPageLimits = {
      starter: { prompts: 25, providers: 2 },
      growth: { prompts: 100, providers: 4 },
      pro: { prompts: 300, providers: 4 }
    };

    it('starter tier matches pricing page', () => {
      const quotas = getQuotasForTier('starter');
      expect(quotas.promptsPerDay).toBe(pricingPageLimits.starter.prompts);
      expect(quotas.providersPerPrompt).toBe(pricingPageLimits.starter.providers);
    });

    it('growth tier matches pricing page', () => {
      const quotas = getQuotasForTier('growth');
      expect(quotas.promptsPerDay).toBe(pricingPageLimits.growth.prompts);
      expect(quotas.providersPerPrompt).toBe(pricingPageLimits.growth.providers);
    });

    it('pro tier matches pricing page', () => {
      const quotas = getQuotasForTier('pro');
      expect(quotas.promptsPerDay).toBe(pricingPageLimits.pro.prompts);
      expect(quotas.providersPerPrompt).toBe(pricingPageLimits.pro.providers);
    });
  });

  describe('No Scale Tier References', () => {
    it('should not allow scale as a valid tier', () => {
      // @ts-expect-error - Testing that 'scale' is not a valid tier
      const quotas = getQuotasForTier('scale');
      // Should fall back to free tier
      expect(quotas.promptsPerDay).toBe(5);
    });
  });
});
