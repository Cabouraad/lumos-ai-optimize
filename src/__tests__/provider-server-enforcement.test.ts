/**
 * Server-side provider enforcement tests
 */

import { describe, it, expect } from 'vitest';
import { 
  getAllowedProviders, 
  isProviderAllowed, 
  filterAllowedProviders,
  getBlockedProviders
} from '../../supabase/functions/_shared/provider-policy';

describe('Server-side Provider Enforcement', () => {
  describe('Provider filtering', () => {
    it('filters providers correctly for starter tier', () => {
      const requestedProviders = ['openai', 'perplexity', 'gemini'] as const;
      const allowedProviders = filterAllowedProviders([...requestedProviders], 'starter');
      const blockedProviders = getBlockedProviders([...requestedProviders], 'starter');

      expect(allowedProviders).toEqual(['openai', 'perplexity']);
      expect(blockedProviders).toEqual(['gemini']);
    });

    it('allows all providers for growth tier', () => {
      const requestedProviders = ['openai', 'perplexity', 'gemini'] as const;
      const allowedProviders = filterAllowedProviders([...requestedProviders], 'growth');
      const blockedProviders = getBlockedProviders([...requestedProviders], 'growth');

      expect(allowedProviders).toEqual(['openai', 'perplexity', 'gemini']);
      expect(blockedProviders).toEqual([]);
    });

    it('allows all providers for pro tier', () => {
      const requestedProviders = ['openai', 'perplexity', 'gemini'] as const;
      const allowedProviders = filterAllowedProviders([...requestedProviders], 'pro');
      const blockedProviders = getBlockedProviders([...requestedProviders], 'pro');

      expect(allowedProviders).toEqual(['openai', 'perplexity', 'gemini']);
      expect(blockedProviders).toEqual([]);
    });
  });

  describe('Individual provider checks', () => {
    it('blocks gemini for starter users', () => {
      expect(isProviderAllowed('gemini', 'starter')).toBe(false);
    });

    it('allows gemini for growth users', () => {
      expect(isProviderAllowed('gemini', 'growth')).toBe(true);
    });

    it('allows gemini for pro users', () => {
      expect(isProviderAllowed('gemini', 'pro')).toBe(true);
    });

    it('always allows openai and perplexity', () => {
      const tiers = ['starter', 'growth', 'pro'] as const;
      
      tiers.forEach(tier => {
        expect(isProviderAllowed('openai', tier)).toBe(true);
        expect(isProviderAllowed('perplexity', tier)).toBe(true);
      });
    });
  });

  describe('Edge cases', () => {
    it('handles empty provider list', () => {
      const allowed = filterAllowedProviders([], 'starter');
      const blocked = getBlockedProviders([], 'starter');

      expect(allowed).toEqual([]);
      expect(blocked).toEqual([]);
    });

    it('handles unknown tier gracefully', () => {
      const providers = getAllowedProviders('unknown' as any);
      expect(providers).toEqual(['openai']); // Should fall back to free tier
    });

    it('handles duplicate providers in request', () => {
      const duplicateProviders = ['openai', 'openai', 'gemini'] as any;
      const allowed = filterAllowedProviders(duplicateProviders, 'starter');
      
      expect(allowed).toEqual(['openai', 'openai']); // Should maintain duplicates
    });
  });
});