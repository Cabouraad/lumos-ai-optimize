import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthProvider';

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
      
      // Try to get subscription data from subscribers table
      const { data: subscriberData, error: subError } = await supabase
        .from('subscribers')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      let finalSubscriptionData: SubscriptionData;

      if (subError) {
        console.warn('[SubscriptionProvider] Error fetching subscription:', subError);
        // Use safe defaults
        finalSubscriptionData = {
          subscribed: false,
          subscription_tier: 'starter',
          subscription_end: null,
          trial_expires_at: null,
          trial_started_at: null,
          payment_collected: false,
          metadata: null
        };
      } else if (subscriberData) {
        finalSubscriptionData = {
          subscribed: subscriberData.subscribed || false,
          subscription_tier: subscriberData.subscription_tier || 'starter',
          subscription_end: subscriberData.subscription_end,
          trial_expires_at: subscriberData.trial_expires_at,
          trial_started_at: subscriberData.trial_started_at,
          payment_collected: subscriberData.payment_collected || false,
          metadata: subscriberData.metadata
        };
      } else {
        // Try to find by email
        const { data: subscriberByEmail, error: emailError } = await supabase
          .from('subscribers')
          .select('*')
          .eq('email', user.email!)
          .maybeSingle();

        if (!emailError && subscriberByEmail) {
          finalSubscriptionData = {
            subscribed: subscriberByEmail.subscribed || false,
            subscription_tier: subscriberByEmail.subscription_tier || 'starter',
            subscription_end: subscriberByEmail.subscription_end,
            trial_expires_at: subscriberByEmail.trial_expires_at,
            trial_started_at: subscriberByEmail.trial_started_at,
            payment_collected: subscriberByEmail.payment_collected || false,
            metadata: subscriberByEmail.metadata
          };

          // Update the user_id in the subscriber record
          if (!subscriberByEmail.user_id) {
            await supabase
              .from('subscribers')
              .update({ user_id: user.id })
              .eq('email', user.email!);
          }
        } else {
          // No subscription record found, use defaults
          finalSubscriptionData = {
            subscribed: false,
            subscription_tier: 'starter',
            subscription_end: null,
            trial_expires_at: null,
            trial_started_at: null,
            payment_collected: false,
            metadata: null
          };
        }
      }

      setSubscriptionData(finalSubscriptionData);
      setError(null);
    } catch (err) {
      console.error('[SubscriptionProvider] Error fetching subscription data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load subscription data');
      // Set safe defaults on error
      setSubscriptionData({
        subscribed: false,
        subscription_tier: 'starter',
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