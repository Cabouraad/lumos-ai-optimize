import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSubscriptionGate } from '@/hooks/useSubscriptionGate';
import { useAuth } from '@/contexts/AuthContext';

// Mock the AuthContext
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn()
}));

const mockUseAuth = vi.mocked(useAuth);

describe('Subscription Gating Matrix - Extended Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Trial vs Paid Access Matrix', () => {
    const testCases = [
      {
        name: 'Subscribed=true, payment_collected=false (Active Subscription)',
        subscriptionData: {
          subscribed: true,
          subscription_tier: 'pro',
          trial_expires_at: null,
          payment_collected: false,
          subscription_end: null,
          requires_subscription: true
        },
        expectedAppAccess: true,
        expectedFeatureAccess: true,
        description: 'Active subscription overrides payment_collected flag'
      },
      {
        name: 'Subscribed=true, payment_collected=true (Active Subscription)',
        subscriptionData: {
          subscribed: true,
          subscription_tier: 'growth',
          trial_expires_at: null,
          payment_collected: true,
          subscription_end: null,
          requires_subscription: true
        },
        expectedAppAccess: true,
        expectedFeatureAccess: true,
        description: 'Active subscription with payment collected'
      },
      {
        name: 'Trial active, payment_collected=false',
        subscriptionData: {
          subscribed: false,
          subscription_tier: 'starter',
          trial_expires_at: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
          payment_collected: false,
          subscription_end: null,
          requires_subscription: true
        },
        expectedAppAccess: false,
        expectedFeatureAccess: false,
        description: 'Trial without payment method should deny access'
      },
      {
        name: 'Trial active, payment_collected=true',
        subscriptionData: {
          subscribed: false,
          subscription_tier: 'starter',
          trial_expires_at: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
          payment_collected: true,
          subscription_end: null,
          requires_subscription: true
        },
        expectedAppAccess: true,
        expectedFeatureAccess: true,
        description: 'Trial with payment method should grant access'
      },
      {
        name: 'Trial expired, payment_collected=true',
        subscriptionData: {
          subscribed: false,
          subscription_tier: 'starter',
          trial_expires_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          payment_collected: true,
          subscription_end: null,
          requires_subscription: true
        },
        expectedAppAccess: false,
        expectedFeatureAccess: false,
        description: 'Expired trial should deny access regardless of payment'
      },
      {
        name: 'Trial expired, payment_collected=false',
        subscriptionData: {
          subscribed: false,
          subscription_tier: 'starter',
          trial_expires_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          payment_collected: false,
          subscription_end: null,
          requires_subscription: true
        },
        expectedAppAccess: false,
        expectedFeatureAccess: false,
        description: 'Expired trial without payment should deny access'
      },
      {
        name: 'No subscription, no trial',
        subscriptionData: {
          subscribed: false,
          subscription_tier: null,
          trial_expires_at: null,
          payment_collected: false,
          subscription_end: null,
          requires_subscription: true
        },
        expectedAppAccess: false,
        expectedFeatureAccess: false,
        description: 'No subscription or trial should deny access'
      },
      {
        name: 'Subscription ended, payment_collected=true',
        subscriptionData: {
          subscribed: false,
          subscription_tier: 'pro',
          trial_expires_at: null,
          payment_collected: true,
          subscription_end: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
          requires_subscription: true
        },
        expectedAppAccess: false,
        expectedFeatureAccess: false,
        description: 'Ended subscription should deny access'
      }
    ];

    testCases.forEach(({ name, subscriptionData, expectedAppAccess, expectedFeatureAccess, description }) => {
      it(`should handle ${name}`, () => {
        mockUseAuth.mockReturnValue({
          subscriptionData,
          user: { id: 'user1' },
          session: { user: { id: 'user1' } },
          orgData: { organizations: { id: 'org1' } },
          loading: false
        } as any);

        const { result } = renderHook(() => useSubscriptionGate());
        
        const appAccess = result.current.hasAccessToApp();
        const recoAccess = result.current.canAccessRecommendations();
        const competitorAccess = result.current.canAccessCompetitorAnalysis();

        expect(appAccess.hasAccess).toBe(expectedAppAccess);
        expect(recoAccess.hasAccess).toBe(expectedFeatureAccess);
        expect(competitorAccess.hasAccess).toBe(expectedFeatureAccess);
        
        console.log(`Test: ${description} - App access: ${appAccess.hasAccess}, Feature access: ${recoAccess.hasAccess}`);
      });
    });
  });

  describe('Payment Collection Scenarios', () => {
    it('should track trial days remaining accurately', () => {
      const daysRemaining = 3;
      const futureDate = new Date(Date.now() + daysRemaining * 24 * 60 * 60 * 1000);
      
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
      
      expect(result.current.daysRemainingInTrial).toBe(daysRemaining);
      expect(result.current.isOnTrial).toBe(true);
      expect(result.current.trialExpired).toBe(false);
    });

    it('should handle edge case: trial expires today', () => {
      // Set trial to expire in 12 hours (same day)
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);
      
      mockUseAuth.mockReturnValue({
        subscriptionData: {
          subscribed: false,
          subscription_tier: 'starter',
          trial_expires_at: todayEnd.toISOString(),
          payment_collected: true,
          subscription_end: null,
          requires_subscription: true
        }
      } as any);

      const { result } = renderHook(() => useSubscriptionGate());
      
      expect(result.current.daysRemainingInTrial).toBeLessThanOrEqual(1);
      expect(result.current.isOnTrial).toBe(true);
      expect(result.current.trialExpired).toBe(false);
      expect(result.current.hasAccessToApp().hasAccess).toBe(true);
    });

    it('should handle prompt quota limits based on tier and payment status', () => {
      mockUseAuth.mockReturnValue({
        subscriptionData: {
          subscribed: false,
          subscription_tier: 'starter',
          trial_expires_at: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
          payment_collected: true,
          subscription_end: null,
          requires_subscription: true
        }
      } as any);

      const { result } = renderHook(() => useSubscriptionGate());
      
      // Should allow creating prompts within starter limits
      expect(result.current.canCreatePrompts(50).hasAccess).toBe(true);
      
      // Should deny when exceeding starter daily limits
      expect(result.current.canCreatePrompts(150).hasAccess).toBe(false);
    });
  });

  describe('Tier-based Feature Access', () => {
    const tierTests = [
      {
        tier: 'starter',
        expectations: {
          hasRecommendations: true,
          hasCompetitorAnalysis: true,
          hasAdvancedScoring: false,
          promptsPerDay: 100,
          providersPerPrompt: 3
        }
      },
      {
        tier: 'growth',
        expectations: {
          hasRecommendations: true,
          hasCompetitorAnalysis: true,
          hasAdvancedScoring: true,
          
          promptsPerDay: 500,
          providersPerPrompt: 5
        }
      },
      {
        tier: 'pro',
        expectations: {
          hasRecommendations: true,
          hasCompetitorAnalysis: true,
          hasAdvancedScoring: true,
          
          promptsPerDay: 2000,
          providersPerPrompt: 10
        }
      }
    ];

    tierTests.forEach(({ tier, expectations }) => {
      it(`should provide correct feature access for ${tier} tier`, () => {
        mockUseAuth.mockReturnValue({
          subscriptionData: {
            subscribed: true,
            subscription_tier: tier,
            trial_expires_at: null,
            payment_collected: true,
            subscription_end: null,
            requires_subscription: true
          }
        } as any);

        const { result } = renderHook(() => useSubscriptionGate());
        
        expect(result.current.canAccessRecommendations().hasAccess).toBe(expectations.hasRecommendations);
        expect(result.current.canAccessCompetitorAnalysis().hasAccess).toBe(expectations.hasCompetitorAnalysis);
        expect(result.current.canAccessAdvancedScoring().hasAccess).toBe(expectations.hasAdvancedScoring);
        
        expect(result.current.limits.promptsPerDay).toBe(expectations.promptsPerDay);
        expect(result.current.limits.providersPerPrompt).toBe(expectations.providersPerPrompt);
      });
    });
  });
});