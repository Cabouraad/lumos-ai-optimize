import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthProvider';

/**
 * SECURITY: This provider uses the secure RPC function `get_user_subscription_status()`
 * instead of direct table queries to prevent exposure of sensitive payment data:
 * - Stripe Customer IDs
 * - Stripe Subscription IDs  
 * - Email addresses
 * - Raw metadata
 * 
 * If you need to query subscription data, ALWAYS use the RPC function, 
 * never query the subscribers table directly.
 */

interface SubscriptionData {
  subscribed: boolean;
  subscription_tier: string;
  subscription_end: string | null;
  trial_expires_at: string | null;
  trial_started_at: string | null;
  payment_collected: boolean;
  metadata: any;
}

interface SubscriptionContextType {
  subscriptionData: SubscriptionData | null;
  loading: boolean;
  error: string | null;
  hasAccess: boolean;
  refreshSubscription: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextType>({
  subscriptionData: null,
  loading: false,
  error: null,
  hasAccess: false,
  refreshSubscription: async () => {},
});

export const useSubscription = () => {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error('useSubscription must be used within SubscriptionProvider');
  }
  return context;
};

interface SubscriptionProviderProps {
  children: React.ReactNode;
}

export function SubscriptionProvider({ children }: SubscriptionProviderProps) {
  const { user, ready } = useAuth();
  const [subscriptionData, setSubscriptionData] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSubscriptionData = useCallback(async () => {
    if (!user) {
      setSubscriptionData(null);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('[SubscriptionProvider] Fetching subscription data for:', user.email);
      
      // SECURITY: Use secure RPC instead of direct table query to mask sensitive payment data
      // This prevents exposure of Stripe IDs, emails, and metadata in case of account compromise
      const [{ data: rpcData, error: subError }, { data: orgData }] = await Promise.all([
        supabase.rpc('get_user_subscription_status'),
        supabase
          .from('users')
          .select('org_id, organizations(plan_tier)')
          .eq('id', user.id)
          .single()
      ]);
      
      // Parse the JSON response from RPC
      const subscriberData = rpcData as {
        subscribed: boolean;
        subscription_tier: string;
        subscription_end: string | null;
        trial_expires_at: string | null;
        trial_started_at: string | null;
        payment_collected: boolean;
      } | null;

      let finalSubscriptionData: SubscriptionData;

      // Get plan tier from org as authoritative source
      const orgPlanTier = (orgData?.organizations as any)?.plan_tier || 'free';

      if (subError) {
        console.warn('[SubscriptionProvider] Error fetching subscription:', subError);
        // Use org plan tier as fallback
        finalSubscriptionData = {
          subscribed: orgPlanTier !== 'free',
          subscription_tier: orgPlanTier,
          subscription_end: null,
          trial_expires_at: null,
          trial_started_at: null,
          payment_collected: orgPlanTier !== 'free',
          metadata: null
        };
      } else if (subscriberData) {
        // Use subscriber data but prefer org plan tier for subscription_tier
        finalSubscriptionData = {
          subscribed: subscriberData.subscribed || false,
          subscription_tier: orgPlanTier || subscriberData.subscription_tier || 'free',
          subscription_end: subscriberData.subscription_end,
          trial_expires_at: subscriberData.trial_expires_at,
          trial_started_at: subscriberData.trial_started_at,
          payment_collected: subscriberData.payment_collected || false,
          metadata: null // Metadata is intentionally masked for security
        };
      } else {
        // No subscription record found, use org plan tier
        finalSubscriptionData = {
          subscribed: orgPlanTier !== 'free',
          subscription_tier: orgPlanTier,
          subscription_end: null,
          trial_expires_at: null,
          trial_started_at: null,
          payment_collected: orgPlanTier !== 'free',
          metadata: null
        };
      }

      console.log('[SubscriptionProvider] Final subscription data:', {
        tier: finalSubscriptionData.subscription_tier,
        subscribed: finalSubscriptionData.subscribed,
        orgPlanTier,
        source: subscriberData ? 'subscriber' : 'org_fallback'
      });

      setSubscriptionData(finalSubscriptionData);
      setError(null);
    } catch (err) {
      console.error('[SubscriptionProvider] Error fetching subscription data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load subscription data');
      // Set free tier defaults on error
      setSubscriptionData({
        subscribed: false,
        subscription_tier: 'free',
        subscription_end: null,
        trial_expires_at: null,
        trial_started_at: null,
        payment_collected: false,
        metadata: null
      });
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (ready) {
      fetchSubscriptionData();
    }
  }, [ready, fetchSubscriptionData]);

  // Calculate access level
  const hasAccess = subscriptionData ? (
    subscriptionData.subscribed || 
    (subscriptionData.trial_expires_at && 
     new Date(subscriptionData.trial_expires_at) > new Date() &&
     subscriptionData.payment_collected)
  ) : false;

  const value: SubscriptionContextType = {
    subscriptionData,
    loading,
    error,
    hasAccess,
    refreshSubscription: fetchSubscriptionData,
  };

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
}