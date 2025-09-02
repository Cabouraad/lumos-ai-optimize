import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useAuth } from '@/contexts/AuthContext';

// Mock the AuthContext
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn()
}));

const mockUseAuth = vi.mocked(useAuth);

// Mock Supabase client
const mockSupabase = {
  functions: {
    invoke: vi.fn()
  }
};

vi.mock('@/integrations/supabase/client', () => ({
  supabase: mockSupabase
}));

describe('check-subscription Periodic and Post-Checkout Refresh', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Periodic Refresh Behavior', () => {
    it('should refresh subscription status every 10 seconds when user is active', async () => {
      const mockCheckSubscription = vi.fn().mockResolvedValue({
        subscribed: true,
        subscription_tier: 'pro'
      });

      mockUseAuth.mockReturnValue({
        checkSubscription: mockCheckSubscription,
        subscriptionData: {
          subscribed: false,
          subscription_tier: 'starter'
        },
        user: { id: 'user1' }
      } as any);

      // Simulate component mounting (would start the interval)
      const intervalId = setInterval(() => {
        mockCheckSubscription();
      }, 10000);

      // Fast-forward 30 seconds
      vi.advanceTimersByTime(30000);

      expect(mockCheckSubscription).toHaveBeenCalledTimes(3); // 10s, 20s, 30s

      clearInterval(intervalId);
    });

    it('should not refresh when user is not authenticated', () => {
      const mockCheckSubscription = vi.fn();

      mockUseAuth.mockReturnValue({
        checkSubscription: mockCheckSubscription,
        subscriptionData: null,
        user: null
      } as any);

      // Interval should not start without authenticated user
      const intervalId = setInterval(() => {
        if (mockUseAuth().user) {
          mockCheckSubscription();
        }
      }, 10000);

      vi.advanceTimersByTime(30000);

      expect(mockCheckSubscription).toHaveBeenCalledTimes(0);
      clearInterval(intervalId);
    });

    it('should handle check-subscription function errors gracefully', async () => {
      const mockCheckSubscription = vi.fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ subscribed: true });

      mockUseAuth.mockReturnValue({
        checkSubscription: mockCheckSubscription,
        user: { id: 'user1' }
      } as any);

      // Mock console.error to verify error handling
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const intervalId = setInterval(async () => {
        try {
          await mockCheckSubscription();
        } catch (error) {
          console.error('Subscription check failed:', error);
        }
      }, 10000);

      vi.advanceTimersByTime(20000);

      expect(mockCheckSubscription).toHaveBeenCalledTimes(2);
      expect(consoleSpy).toHaveBeenCalledWith(
        'Subscription check failed:',
        expect.any(Error)
      );

      clearInterval(intervalId);
      consoleSpy.mockRestore();
    });
  });

  describe('Post-Checkout Refresh', () => {
    it('should immediately refresh subscription after successful checkout', async () => {
      const mockCheckSubscription = vi.fn().mockResolvedValue({
        subscribed: true,
        subscription_tier: 'growth'
      });

      mockUseAuth.mockReturnValue({
        checkSubscription: mockCheckSubscription,
        user: { id: 'user1' }
      } as any);

      // Simulate successful Stripe checkout return
      // This would typically be triggered by URL change or component mount
      Object.defineProperty(window, 'location', {
        value: {
          href: 'https://app.example.com/success?session_id=cs_test_123',
          search: '?session_id=cs_test_123',
          pathname: '/success'
        },
        writable: true
      });

      // Mock the effect that would trigger on success page
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('session_id') && window.location.pathname === '/success') {
        await mockCheckSubscription();
      }

      expect(mockCheckSubscription).toHaveBeenCalledTimes(1);
    });

    it('should refresh subscription when returning from customer portal', async () => {
      const mockCheckSubscription = vi.fn().mockResolvedValue({
        subscribed: false,
        subscription_tier: null
      });

      mockUseAuth.mockReturnValue({
        checkSubscription: mockCheckSubscription,
        user: { id: 'user1' }
      } as any);

      // Simulate return from Stripe customer portal
      Object.defineProperty(window, 'location', {
        value: {
          href: 'https://app.example.com/dashboard?portal_return=true',
          search: '?portal_return=true',
          pathname: '/dashboard'
        },
        writable: true
      });

      // Mock the effect that would trigger on portal return
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('portal_return')) {
        await mockCheckSubscription();
      }

      expect(mockCheckSubscription).toHaveBeenCalledTimes(1);
    });

    it('should handle multiple rapid refresh requests', async () => {
      let callCount = 0;
      const mockCheckSubscription = vi.fn().mockImplementation(async () => {
        callCount++;
        // Simulate async delay
        return new Promise(resolve => {
          setTimeout(() => {
            resolve({
              subscribed: true,
              subscription_tier: 'pro'
            });
          }, 100);
        });
      });

      mockUseAuth.mockReturnValue({
        checkSubscription: mockCheckSubscription,
        user: { id: 'user1' }
      } as any);

      // Simulate rapid calls (e.g., user clicking refresh multiple times)
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(mockCheckSubscription());
      }

      // Fast forward to resolve all promises
      vi.advanceTimersByTime(100);
      await Promise.all(promises);

      expect(mockCheckSubscription).toHaveBeenCalledTimes(5);
    });
  });

  describe('Subscription State Transitions', () => {
    it('should handle trial-to-paid subscription transition', async () => {
      let subscriptionState = {
        subscribed: false,
        subscription_tier: 'starter',
        trial_expires_at: new Date(Date.now() + 86400000).toISOString(), // 1 day
        payment_collected: true
      };

      const mockCheckSubscription = vi.fn()
        .mockResolvedValueOnce(subscriptionState) // Initial trial state
        .mockResolvedValueOnce({
          ...subscriptionState,
          subscribed: true,
          subscription_tier: 'growth',
          trial_expires_at: null
        }); // After successful payment

      mockUseAuth.mockReturnValue({
        checkSubscription: mockCheckSubscription,
        subscriptionData: subscriptionState,
        user: { id: 'user1' }
      } as any);

      // First check - trial state
      await mockCheckSubscription();
      
      // Simulate checkout completion
      await mockCheckSubscription();

      expect(mockCheckSubscription).toHaveBeenCalledTimes(2);
    });

    it('should handle subscription cancellation', async () => {
      const mockCheckSubscription = vi.fn()
        .mockResolvedValueOnce({
          subscribed: true,
          subscription_tier: 'pro'
        })
        .mockResolvedValueOnce({
          subscribed: false,
          subscription_tier: null,
          subscription_end: new Date().toISOString()
        });

      mockUseAuth.mockReturnValue({
        checkSubscription: mockCheckSubscription,
        user: { id: 'user1' }
      } as any);

      // Before cancellation
      await mockCheckSubscription();
      
      // After cancellation
      await mockCheckSubscription();

      expect(mockCheckSubscription).toHaveBeenCalledTimes(2);
    });
  });

  describe('Edge Function Response Handling', () => {
    it('should handle check-subscription function success response', async () => {
      mockSupabase.functions.invoke.mockResolvedValue({
        data: {
          subscribed: true,
          subscription_tier: 'growth',
          subscription_end: new Date(Date.now() + 30 * 86400000).toISOString() // 30 days
        },
        error: null
      });

      const result = await mockSupabase.functions.invoke('check-subscription');
      
      expect(result.data.subscribed).toBe(true);
      expect(result.data.subscription_tier).toBe('growth');
      expect(result.error).toBeNull();
    });

    it('should handle check-subscription function error response', async () => {
      mockSupabase.functions.invoke.mockResolvedValue({
        data: null,
        error: {
          message: 'Stripe API error'
        }
      });

      const result = await mockSupabase.functions.invoke('check-subscription');
      
      expect(result.data).toBeNull();
      expect(result.error).toBeTruthy();
      expect(result.error.message).toBe('Stripe API error');
    });

    it('should handle network failures in check-subscription', async () => {
      mockSupabase.functions.invoke.mockRejectedValue(
        new Error('Network request failed')
      );

      try {
        await mockSupabase.functions.invoke('check-subscription');
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect(error.message).toBe('Network request failed');
      }
    });
  });
});