import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscriptionGate } from '@/hooks/useSubscriptionGate';

interface PollEntitlementsOptions {
  max?: number;
  interval?: number;
}

/**
 * Polls subscription entitlements until access is granted or timeout occurs
 * @param options Configuration for polling behavior
 * @returns Promise that resolves when access is granted, rejects on timeout
 */
export async function pollEntitlements(options: PollEntitlementsOptions = {}): Promise<void> {
  const { max = 6, interval = 1000 } = options;
  
  for (let attempt = 0; attempt < max; attempt++) {
    try {
      // Call check-subscription edge function
      await supabase.functions.invoke('check-subscription');
      
      // Check subscription gate for access
      // Note: We need to get fresh subscription data, so we'll use a direct check
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.user) {
        throw new Error('User not authenticated');
      }
      
      // Get fresh subscription data
      const { data: subscriptionData } = await supabase
        .from('subscribers')
        .select('*')
        .eq('user_id', session.session.user.id)
        .maybeSingle();
      
      // Check if access should be granted
      const isSubscribed = subscriptionData?.subscribed;
      const trialActive = subscriptionData?.trial_expires_at && 
        new Date(subscriptionData.trial_expires_at) > new Date();
      const paymentCollected = subscriptionData?.payment_collected;
      
      const hasAccess = isSubscribed || (trialActive && paymentCollected);
      
      console.log(`[pollEntitlements] Attempt ${attempt + 1}/${max}`, {
        isSubscribed,
        trialActive,
        paymentCollected,
        hasAccess,
        subscriptionData: subscriptionData ? {
          subscription_tier: subscriptionData.subscription_tier,
          subscription_end: subscriptionData.subscription_end,
          trial_expires_at: subscriptionData.trial_expires_at,
          metadata: subscriptionData.metadata
        } : null
      });
      
      if (hasAccess) {
        console.log('[pollEntitlements] Access granted!');
        return; // Success - access granted
      }
      
      if (attempt < max - 1) {
        // Wait before next attempt (unless this is the last attempt)
        await new Promise(resolve => setTimeout(resolve, interval));
      }
    } catch (error) {
      console.error(`[pollEntitlements] Attempt ${attempt + 1} failed:`, error);
      
      if (attempt < max - 1) {
        // Wait before retry (unless this is the last attempt)
        await new Promise(resolve => setTimeout(resolve, interval));
      }
    }
  }
  
  // All attempts exhausted
  throw new Error(`Subscription verification timeout after ${max} attempts`);
}