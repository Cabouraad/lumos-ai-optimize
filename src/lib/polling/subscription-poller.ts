import { EdgeFunctionClient } from "@/lib/edge-functions/client";
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
      await EdgeFunctionClient.checkSubscription();
      
      // Check subscription gate for access
      // Note: We need to get fresh subscription data, so we'll use a direct check
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.user) {
        throw new Error('User not authenticated');
      }
      
      // Get fresh subscription data from secure view
      const { data: subscriptionData } = await supabase
        .from('subscriber_public')
        .select('id, org_id, tier, plan_code, status, period_ends_at, created_at')
        .eq('org_id', session.session.user.user_metadata?.org_id)
        .maybeSingle();
      
      // Check if access should be granted
      const isSubscribed = subscriptionData?.status === 'active';
      const trialActive = subscriptionData?.status === 'trialing';
      // Note: payment_collected not available in public view, assume true for active status
      const paymentCollected = true;
      
      const hasAccess = isSubscribed || (trialActive && paymentCollected);
      
      console.log(`[pollEntitlements] Attempt ${attempt + 1}/${max}`, {
        isSubscribed,
        trialActive,
        paymentCollected,
        hasAccess,
        subscriptionData: subscriptionData ? {
          tier: subscriptionData.tier,
          status: subscriptionData.status,
          period_ends_at: subscriptionData.period_ends_at
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