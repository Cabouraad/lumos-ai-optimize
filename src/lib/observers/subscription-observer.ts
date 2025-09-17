/**
 * Read-only Subscription State Observer
 * 
 * SAFETY: This observer never replaces AuthContext logic.
 * It only caches subscription state for performance benefits.
 * Zero risk to core functionality.
 */

import { optimizationFlags, withFeatureFlag } from '@/config/featureFlags';

interface SubscriptionSnapshot {
  subscribed: boolean;
  tier: string | null;
  trialExpired: boolean;
  lastUpdated: number;
  source: 'auth-context' | 'cache';
}

class SubscriptionStateObserver {
  private snapshot: SubscriptionSnapshot | null = null;
  private listeners: Set<(snapshot: SubscriptionSnapshot) => void> = new Set();
  private readonly CACHE_TTL = 30000; // 30 seconds

  /**
   * Observe subscription data from AuthContext (read-only)
   * NEVER fetches data independently
   */
  observe(subscriptionData: any): SubscriptionSnapshot {
    return withFeatureFlag(
      'FEATURE_SUBSCRIPTION_STATE_OBSERVER',
      () => {
        const now = Date.now();
        const snapshot: SubscriptionSnapshot = {
          subscribed: subscriptionData?.subscribed || false,
          tier: subscriptionData?.subscription_tier || null,
          trialExpired: this.isTrialExpired(subscriptionData?.trial_expires_at),
          lastUpdated: now,
          source: 'auth-context'
        };

        // Cache for performance
        this.snapshot = snapshot;
        this.notifyListeners(snapshot);
        
        return snapshot;
      },
      () => {
        // Fallback: Always return fresh data from AuthContext
        return {
          subscribed: subscriptionData?.subscribed || false,
          tier: subscriptionData?.subscription_tier || null,
          trialExpired: this.isTrialExpired(subscriptionData?.trial_expires_at),
          lastUpdated: Date.now(),
          source: 'auth-context'
        };
      },
      'subscription-observer'
    );
  }

  /**
   * Get cached snapshot if valid, otherwise return null
   * Components can use this for performance optimization
   */
  getCachedSnapshot(): SubscriptionSnapshot | null {
    if (!optimizationFlags.FEATURE_SUBSCRIPTION_STATE_OBSERVER) return null;
    
    if (!this.snapshot) return null;
    
    const now = Date.now();
    if (now - this.snapshot.lastUpdated > this.CACHE_TTL) {
      this.snapshot = null;
      return null;
    }
    
    return { ...this.snapshot, source: 'cache' };
  }

  /**
   * Subscribe to subscription state changes
   * Useful for components that need reactive updates
   */
  subscribe(listener: (snapshot: SubscriptionSnapshot) => void): () => void {
    if (!optimizationFlags.FEATURE_SUBSCRIPTION_STATE_OBSERVER) {
      // Return no-op unsubscribe function
      return () => {};
    }

    this.listeners.add(listener);
    
    // Provide current snapshot if available
    if (this.snapshot) {
      listener(this.snapshot);
    }
    
    return () => {
      this.listeners.delete(listener);
    };
  }

  private isTrialExpired(trialExpiresAt?: string): boolean {
    if (!trialExpiresAt) return false;
    return new Date(trialExpiresAt) <= new Date();
  }

  private notifyListeners(snapshot: SubscriptionSnapshot): void {
    this.listeners.forEach(listener => {
      try {
        listener(snapshot);
      } catch (error) {
        console.warn('[SubscriptionObserver] Listener error:', error);
      }
    });
  }

  /**
   * Clear cache (for testing or manual refresh)
   */
  clearCache(): void {
    this.snapshot = null;
  }
}

// Global instance - safe singleton pattern
export const subscriptionObserver = new SubscriptionStateObserver();