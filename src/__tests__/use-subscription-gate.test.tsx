import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSubscriptionGate } from '@/hooks/useSubscriptionGate';
import { useAuth } from '@/contexts/AuthContext';

// Mock the AuthContext
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn()
}));

// Mock the quotas module
vi.mock('../../lib/tiers/quotas', () => ({
  getQuotasForTier: vi.fn((tier: string) => {
    switch (tier) {
      case 'starter':
        return { promptsPerDay: 100, providersPerPrompt: 3 };
      case 'growth':
        return { promptsPerDay: 500, providersPerPrompt: 5 };
      case 'pro':
        return { promptsPerDay: 2000, providersPerPrompt: 10 };
      default:
        return { promptsPerDay: 5, providersPerPrompt: 1 };
    }
  })
}));

// Mock feature flags
vi.mock('@/config/featureFlags', () => ({
  optimizationFlags: {
    FEATURE_TRIAL_GRACE: false
  }
}));

const mockUseAuth = vi.mocked(useAuth);

describe('useSubscriptionGate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Access Control Matrix', () => {
    it('should allow app access when subscribed=true', () => {
      mockUseAuth.mockReturnValue({
        subscriptionData: {
          subscribed: true,
          subscription_tier: 'pro',
          trial_expires_at: null,
          payment_collected: false, // doesn't matter when subscribed
          subscription_end: null,
          requires_subscription: true
        }
      } as any);

      const { result } = renderHook(() => useSubscriptionGate());
      const appAccess = result.current.hasAccessToApp();

      expect(appAccess.hasAccess).toBe(true);
    });

    it('should deny app access when trial active but payment_collected=false', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 5);

      mockUseAuth.mockReturnValue({
        subscriptionData: {
          subscribed: false,
          subscription_tier: 'starter',
          trial_expires_at: futureDate.toISOString(),
          payment_collected: false, // Key: no payment collected
          subscription_end: null,
          requires_subscription: true
        }
      } as any);

      const { result } = renderHook(() => useSubscriptionGate());
      const appAccess = result.current.hasAccessToApp();

      expect(appAccess.hasAccess).toBe(false);
      expect(appAccess.reason).toBe('Access requires an active subscription or valid trial with payment method.');
      expect(appAccess.upgradeRequired).toBe(true);
    });

    it('should allow app access when trial active and payment_collected=true', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 5);

      mockUseAuth.mockReturnValue({
        subscriptionData: {
          subscribed: false,
          subscription_tier: 'starter',
          trial_expires_at: futureDate.toISOString(),
          payment_collected: true, // Key: payment collected
          subscription_end: null,
          requires_subscription: true
        }
      } as any);

      const { result } = renderHook(() => useSubscriptionGate());
      const appAccess = result.current.hasAccessToApp();

      expect(appAccess.hasAccess).toBe(true);
    });

    it('should deny app access when trial expired even with payment_collected=true', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 2);

      mockUseAuth.mockReturnValue({
        subscriptionData: {
          subscribed: false,
          subscription_tier: 'starter',
          trial_expires_at: pastDate.toISOString(),
          payment_collected: true, // Doesn't matter if expired
          subscription_end: null,
          requires_subscription: true
        }
      } as any);

      const { result } = renderHook(() => useSubscriptionGate());
      const appAccess = result.current.hasAccessToApp();

      expect(appAccess.hasAccess).toBe(false);
      expect(appAccess.reason).toBe('Access requires an active subscription or valid trial with payment method.');
      expect(appAccess.isTrialExpired).toBe(true);
    });

    it('should deny app access when no subscription and no trial', () => {
      mockUseAuth.mockReturnValue({
        subscriptionData: {
          subscribed: false,
          subscription_tier: null,
          trial_expires_at: null,
          payment_collected: false,
          subscription_end: null,
          requires_subscription: true
        }
      } as any);

      const { result } = renderHook(() => useSubscriptionGate());
      const appAccess = result.current.hasAccessToApp();

      expect(appAccess.hasAccess).toBe(false);
      expect(appAccess.reason).toBe('Access requires an active subscription or valid trial with payment method.');
    });
  });

  describe('Feature Access with New Logic', () => {
    it('should allow feature access when subscribed=true', () => {
      mockUseAuth.mockReturnValue({
        subscriptionData: {
          subscribed: true,
          subscription_tier: 'growth',
          trial_expires_at: null,
          payment_collected: false,
          subscription_end: null,
          requires_subscription: true
        }
      } as any);

      const { result } = renderHook(() => useSubscriptionGate());
      const recoAccess = result.current.canAccessRecommendations();
      const competitorAccess = result.current.canAccessCompetitorAnalysis();

      expect(recoAccess.hasAccess).toBe(true);
      expect(competitorAccess.hasAccess).toBe(true);
    });

    it('should allow feature access when trial valid with payment', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 5);

      mockUseAuth.mockReturnValue({
        subscriptionData: {
          subscribed: false,
          subscription_tier: 'starter',
          trial_expires_at: futureDate.toISOString(),
          payment_collected: true,
          subscription_end: null,
          requires_subscription: true
        }
      } as any);

      const { result } = renderHook(() => useSubscriptionGate());
      const recoAccess = result.current.canAccessRecommendations();
      const promptAccess = result.current.canCreatePrompts(10);

      expect(recoAccess.hasAccess).toBe(true);
      expect(promptAccess.hasAccess).toBe(true);
    });

    it('should deny feature access when trial valid but no payment', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 5);

      mockUseAuth.mockReturnValue({
        subscriptionData: {
          subscribed: false,
          subscription_tier: 'starter',
          trial_expires_at: futureDate.toISOString(),
          payment_collected: false,
          subscription_end: null,
          requires_subscription: true
        }
      } as any);

      const { result } = renderHook(() => useSubscriptionGate());
      const recoAccess = result.current.canAccessRecommendations();
      const promptAccess = result.current.canCreatePrompts(10);

      expect(recoAccess.hasAccess).toBe(false);
      expect(promptAccess.hasAccess).toBe(false);
      expect(recoAccess.reason).toBe('Access requires an active subscription or valid trial with payment method.');
    });
  });

  describe('Trial Status Calculation', () => {
    it('should calculate days remaining correctly for valid trial', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 3); // 3 days remaining

      mockUseAuth.mockReturnValue({
        subscriptionData: {
          subscribed: false,
          subscription_tier: 'starter',
          trial_expires_at: futureDate.toISOString(),
          payment_collected: true,
          subscription_end: null,
          requires_subscription: true
        }
      } as any);

      const { result } = renderHook(() => useSubscriptionGate());

      expect(result.current.isOnTrial).toBe(true);
      expect(result.current.trialExpired).toBe(false);
      expect(result.current.daysRemainingInTrial).toBe(3);
    });

    it('should mark trial as expired when date has passed', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1); // 1 day ago

      mockUseAuth.mockReturnValue({
        subscriptionData: {
          subscribed: false,
          subscription_tier: 'starter',
          trial_expires_at: pastDate.toISOString(),
          payment_collected: true,
          subscription_end: null,
          requires_subscription: true
        }
      } as any);

      const { result } = renderHook(() => useSubscriptionGate());

      expect(result.current.isOnTrial).toBe(true); // Still considered on trial tier
      expect(result.current.trialExpired).toBe(true); // But expired
      expect(result.current.daysRemainingInTrial).toBe(0);
    });
  });
});