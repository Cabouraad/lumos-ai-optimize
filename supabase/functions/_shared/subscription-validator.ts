/**
 * SECURITY: Shared subscription validation for edge functions
 * 
 * All edge functions that require subscription access MUST use this validator
 * to prevent billing bypass attacks.
 */

import { createClient } from "npm:@supabase/supabase-js@2";

export interface SubscriptionValidationResult {
  valid: boolean;
  tier: 'free' | 'starter' | 'growth' | 'pro';
  reason?: string;
  userId?: string;
}

/**
 * Validate that the user has an active, paid subscription or trial
 * 
 * CRITICAL: This function enforces that payment_collected MUST be true for any access
 */
export async function validateSubscription(
  authHeader: string | null,
  supabaseUrl: string,
  supabaseServiceKey: string
): Promise<SubscriptionValidationResult> {
  
  // Check auth header exists
  if (!authHeader) {
    return {
      valid: false,
      tier: 'free',
      reason: 'No authorization header provided'
    };
  }

  // Create Supabase client with service role to bypass RLS for validation
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Get user from JWT
  const { data: { user }, error: userError } = await supabase.auth.getUser(
    authHeader.replace('Bearer ', '')
  );

  if (userError || !user) {
    return {
      valid: false,
      tier: 'free',
      reason: 'Invalid authentication token'
    };
  }

  // Fetch subscription status
  const { data: subscriber, error: subError } = await supabase
    .from('subscribers')
    .select('subscribed, subscription_tier, trial_expires_at, payment_collected')
    .eq('user_id', user.id)
    .single();

  if (subError) {
    console.error('[SUBSCRIPTION_VALIDATOR] Database error:', subError);
    return {
      valid: false,
      tier: 'free',
      reason: 'Failed to fetch subscription data',
      userId: user.id
    };
  }

  if (!subscriber) {
    return {
      valid: false,
      tier: 'free',
      reason: 'No subscription record found',
      userId: user.id
    };
  }

  // SECURITY: ALWAYS require payment_collected = true
  if (subscriber.payment_collected !== true) {
    return {
      valid: false,
      tier: 'free',
      reason: 'Payment method not on file',
      userId: user.id
    };
  }

  // Check if paid subscription is active
  if (subscriber.subscribed === true) {
    const tier = (subscriber.subscription_tier || 'free') as 'free' | 'starter' | 'growth' | 'pro';
    return {
      valid: tier !== 'free',
      tier,
      reason: tier === 'free' ? 'Free tier has no access' : undefined,
      userId: user.id
    };
  }

  // Check if trial is active
  if (subscriber.trial_expires_at) {
    const trialExpiry = new Date(subscriber.trial_expires_at);
    const now = new Date();
    
    if (trialExpiry > now) {
      // Active trial with payment on file
      return {
        valid: true,
        tier: 'starter', // Trials default to starter access
        userId: user.id
      };
    } else {
      return {
        valid: false,
        tier: 'free',
        reason: 'Trial expired',
        userId: user.id
      };
    }
  }

  // No active subscription or trial
  return {
    valid: false,
    tier: 'free',
    reason: 'No active subscription or trial',
    userId: user.id
  };
}

/**
 * Create a standardized error response for subscription validation failures
 */
export function createSubscriptionErrorResponse(
  validation: SubscriptionValidationResult,
  corsHeaders: Record<string, string>
): Response {
  return new Response(
    JSON.stringify({
      error: 'Subscription required',
      message: validation.reason || 'Active subscription required to use this feature',
      required_action: 'upgrade',
      current_tier: validation.tier
    }),
    {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    }
  );
}
