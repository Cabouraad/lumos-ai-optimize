/**
 * Tests for provider access enforcement by subscription tier
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { getAllowedProviders, isProviderAllowed, filterAllowedProviders } from '@/lib/providers/tier-policy';
import { ProviderSelector } from '@/components/ProviderSelector';
import * as subscriptionHook from '@/hooks/useSubscriptionGate';

// Mock the subscription gate hook
vi.mock('@/hooks/useSubscriptionGate');

describe('Provider Tier Policy', () => {
  describe('getAllowedProviders', () => {
    it('returns correct providers for starter tier', () => {
      const providers = getAllowedProviders('starter');
      expect(providers).toEqual(['openai', 'perplexity']);
      expect(providers).not.toContain('gemini');
    });

    it('returns correct providers for growth tier', () => {
      const providers = getAllowedProviders('growth');
      expect(providers).toEqual(['openai', 'perplexity', 'gemini']);
    });

    it('returns correct providers for pro tier', () => {
      const providers = getAllowedProviders('pro');
      expect(providers).toEqual(['openai', 'perplexity', 'gemini']);
    });

    it('returns fallback providers for unknown tier', () => {
      const providers = getAllowedProviders('unknown' as any);
      expect(providers).toEqual(['openai']); // Free tier fallback
    });
  });

  describe('isProviderAllowed', () => {
    it('allows openai and perplexity for starter tier', () => {
      expect(isProviderAllowed('openai', 'starter')).toBe(true);
      expect(isProviderAllowed('perplexity', 'starter')).toBe(true);
      expect(isProviderAllowed('gemini', 'starter')).toBe(false);
    });

    it('allows all providers for growth tier', () => {
      expect(isProviderAllowed('openai', 'growth')).toBe(true);
      expect(isProviderAllowed('perplexity', 'growth')).toBe(true);
      expect(isProviderAllowed('gemini', 'growth')).toBe(true);
    });

    it('allows all providers for pro tier', () => {
      expect(isProviderAllowed('openai', 'pro')).toBe(true);
      expect(isProviderAllowed('perplexity', 'pro')).toBe(true);
      expect(isProviderAllowed('gemini', 'pro')).toBe(true);
    });
  });

  describe('filterAllowedProviders', () => {
    it('filters providers correctly for starter tier', () => {
      const allProviders = ['openai', 'perplexity', 'gemini'] as const;
      const filtered = filterAllowedProviders([...allProviders], 'starter');
      expect(filtered).toEqual(['openai', 'perplexity']);
    });

    it('keeps all providers for growth tier', () => {
      const allProviders = ['openai', 'perplexity', 'gemini'] as const;
      const filtered = filterAllowedProviders([...allProviders], 'growth');
      expect(filtered).toEqual(['openai', 'perplexity', 'gemini']);
    });
  });
});

describe('ProviderSelector Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows only allowed providers for starter tier', () => {
    const mockUseSubscriptionGate = vi.mocked(subscriptionHook.useSubscriptionGate);
    mockUseSubscriptionGate.mockReturnValue({
      currentTier: 'starter',
      limits: {
        allowedProviders: ['openai', 'perplexity'],
        promptsPerDay: 25,
        providersPerPrompt: 2,
        hasRecommendations: false,
        hasCompetitorAnalysis: false,
        hasAdvancedScoring: false,
        hasApiAccess: false,
        hasPrioritySupport: false,
        hasWhiteLabeling: false,
      }
    } as any);

    const { container } = render(
      <MemoryRouter>
        <ProviderSelector 
          selectedProviders={[]} 
          onProviderChange={() => {}} 
        />
      </MemoryRouter>
    );

    // Should show OpenAI and Perplexity as enabled
    expect(container.querySelector('label[for="openai"]')).toBeInTheDocument();
    expect(container.querySelector('label[for="perplexity"]')).toBeInTheDocument();
    
    // Gemini should be shown but disabled/locked
    expect(container.querySelector('label[for="gemini"]')).toBeInTheDocument();
    expect(container.textContent).toContain('Upgrade');
  });

  it('shows all providers as enabled for growth tier', () => {
    const mockUseSubscriptionGate = vi.mocked(subscriptionHook.useSubscriptionGate);
    mockUseSubscriptionGate.mockReturnValue({
      currentTier: 'growth',
      limits: {
        allowedProviders: ['openai', 'perplexity', 'gemini'],
        promptsPerDay: 100,
        providersPerPrompt: 3,
        hasRecommendations: true,
        hasCompetitorAnalysis: true,
        hasAdvancedScoring: true,
        hasApiAccess: false,
        hasPrioritySupport: true,
        hasWhiteLabeling: false,
      }
    } as any);

    const { container } = render(
      <MemoryRouter>
        <ProviderSelector 
          selectedProviders={[]} 
          onProviderChange={() => {}} 
        />
      </MemoryRouter>
    );

    // All providers should be enabled (no upgrade buttons)
    expect(container.textContent).not.toContain('Upgrade');
    expect(container.textContent).toContain('All AI providers available on your Growth plan!');
  });

  it('shows upgrade prompt for starter users', () => {
    const mockUseSubscriptionGate = vi.mocked(subscriptionHook.useSubscriptionGate);
    mockUseSubscriptionGate.mockReturnValue({
      currentTier: 'starter',
      limits: {
        allowedProviders: ['openai', 'perplexity'],
        promptsPerDay: 25,
        providersPerPrompt: 2,
        hasRecommendations: false,
        hasCompetitorAnalysis: false,
        hasAdvancedScoring: false,
        hasApiAccess: false,
        hasPrioritySupport: false,
        hasWhiteLabeling: false,
      }
    } as any);

    const { container } = render(
      <MemoryRouter>
        <ProviderSelector 
          selectedProviders={[]} 
          onProviderChange={() => {}} 
        />
      </MemoryRouter>
    );

    expect(container.textContent).toContain('Upgrade to Growth');
    expect(container.textContent).toContain('View plans');
  });
});