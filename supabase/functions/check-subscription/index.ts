import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { createDiagnostics } from "../_shared/diagnostics.ts";
import { authenticateRequest } from "../_shared/auth-utils.ts";

// Simplified and reliable CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  
  const diagnostics = createDiagnostics("check-subscription", req);

  try {
    // Enhanced environment validation with detailed error messages
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");

    if (!supabaseUrl) {
      diagnostics.logStep("env_missing_supabase_url");
      return new Response(JSON.stringify({ 
        success: false, 
        error: "Server configuration error: SUPABASE_URL not set",
        code: "ENV_MISSING_SUPABASE_URL"
      }), {
        headers: { ...corsHeaders, "content-type": "application/json" },
        status: 500,
      });
    }

    if (!serviceRoleKey) {
      diagnostics.logStep("env_missing_service_key");
      return new Response(JSON.stringify({ 
        success: false, 
        error: "Server configuration error: Service role key not configured",
        code: "ENV_MISSING_SERVICE_KEY"
      }), {
        headers: { ...corsHeaders, "content-type": "application/json" },
        status: 500,
      });
    }

    if (!stripeKey) {
      diagnostics.logStep("env_missing_stripe_key");
      return new Response(JSON.stringify({ 
        success: false, 
        error: "Server configuration error: Stripe not configured",
        code: "ENV_MISSING_STRIPE_KEY"
      }), {
        headers: { ...corsHeaders, "content-type": "application/json" },
        status: 500,
      });
    }

    diagnostics.logStep("env_validation_success");
    
    const supabaseClient = createClient(
      supabaseUrl,
      serviceRoleKey,
      { auth: { persistSession: false } }
    );

    diagnostics.logStep("stripe_key_verified");

    // Enhanced authentication with timeout
    let user;
    try {
      const authPromise = authenticateRequest(req, supabaseClient, diagnostics);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Authentication timeout")), 10000)
      );
      user = await Promise.race([authPromise, timeoutPromise]);
    } catch (authError: unknown) {
      diagnostics.logStep("auth_failed", { error: authError.message });
      return new Response(JSON.stringify({ 
        success: false, 
        error: `Authentication failed: ${authError.message}`,
        code: "AUTH_FAILED"
      }), {
        headers: { ...corsHeaders, "content-type": "application/json" },
        status: 401,
      });
    }

    // Check for existing subscriber record
    const { data: existingSubscriber } = await diagnostics.measure(
      "subscriber_lookup",
      () => supabaseClient
        .from('subscribers')
        .select('*')
        .eq('email', user.email)
        .maybeSingle()
    );

// Manual override: honor existing active subscription or active trial in DB
const now = new Date();
const manualSubscribed = !!existingSubscriber?.subscribed;
const manualTrialActive = !!(existingSubscriber?.trial_expires_at && new Date(existingSubscriber.trial_expires_at) > now);
const isManualBypass = existingSubscriber?.stripe_customer_id === "manual_bypass";

    if ((manualSubscribed || manualTrialActive) && isManualBypass) {
      diagnostics.logStep("bypass_manual_subscription", {
        subscribed: existingSubscriber?.subscribed,
        trial_expires_at: existingSubscriber?.trial_expires_at,
        subscription_tier: existingSubscriber?.subscription_tier,
        subscription_end: existingSubscriber?.subscription_end
      });
  return new Response(JSON.stringify({
    // Legacy API fields (keep unchanged)
    subscribed: true,
    subscription_tier: existingSubscriber?.subscription_tier ?? null,
    subscription_end: existingSubscriber?.subscription_end ?? null,
    trial_expires_at: existingSubscriber?.trial_expires_at ?? null,
    trial_started_at: existingSubscriber?.trial_started_at ?? null,
    payment_collected: existingSubscriber?.payment_collected ?? false,
    requires_subscription: false,
    bypass_mode: true,
    metadata: existingSubscriber?.metadata || null,
    // Normalized payload fields
    plan: (existingSubscriber?.subscription_tier ?? 'starter').toUpperCase(),
    status: 'active',
    current_period_end: existingSubscriber?.subscription_end ?? null,
    source: 'bypass'
    }), {
      headers: { ...corsHeaders, "content-type": "application/json" },
      status: 200,
    });
}

if ((manualSubscribed || manualTrialActive) && !isManualBypass) {
  diagnostics.logStep("Using manual subscription override from DB", {
    subscribed: existingSubscriber?.subscribed,
    trial_expires_at: existingSubscriber?.trial_expires_at,
    subscription_tier: existingSubscriber?.subscription_tier,
    subscription_end: existingSubscriber?.subscription_end
  });
  return new Response(JSON.stringify({
    subscribed: true,
    subscription_tier: existingSubscriber?.subscription_tier ?? null,
    subscription_end: existingSubscriber?.subscription_end ?? null,
    trial_expires_at: existingSubscriber?.trial_expires_at ?? null,
    trial_started_at: existingSubscriber?.trial_started_at ?? null,
    payment_collected: existingSubscriber?.payment_collected ?? false,
    requires_subscription: false,
    }), {
      headers: { ...corsHeaders, "content-type": "application/json" },
      status: 200,
    });
}

// Skip Stripe checks for manual bypass users
if (isManualBypass) {
  diagnostics.logStep("BYPASS MODE - Skipping Stripe checks for manual bypass user", { 
    email: user.email,
    bypass_mode: true 
  });
  return new Response(JSON.stringify({
    // Legacy API fields (keep unchanged)
    subscribed: manualSubscribed || manualTrialActive,
    subscription_tier: existingSubscriber?.subscription_tier ?? null,
    subscription_end: existingSubscriber?.subscription_end ?? null,
    trial_expires_at: existingSubscriber?.trial_expires_at ?? null,
    trial_started_at: existingSubscriber?.trial_started_at ?? null,
    payment_collected: existingSubscriber?.payment_collected ?? false,
    requires_subscription: !(manualSubscribed || manualTrialActive),
    bypass_mode: true,
    metadata: existingSubscriber?.metadata || null,
    // Normalized payload fields
    plan: (existingSubscriber?.subscription_tier ?? 'starter').toUpperCase(),
    status: (manualSubscribed || manualTrialActive) ? 'active' : 'inactive',
    current_period_end: existingSubscriber?.subscription_end ?? null,
    source: 'bypass'
    }), {
      headers: { ...corsHeaders, "content-type": "application/json" },
      status: 200,
    });
}

// Enhanced Stripe API calls with timeout handling
const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

let customers;
try {
  diagnostics.logStep("stripe_customer_lookup_start", { email: user.email });
  const customerPromise = stripe.customers.list({ email: user.email, limit: 1 });
  const timeoutPromise = new Promise((_, reject) => 
    setTimeout(() => reject(new Error("Stripe API timeout")), 15000)
  );
  customers = await Promise.race([customerPromise, timeoutPromise]);
  diagnostics.logStep("stripe_customer_lookup_success", { count: customers.data.length });
} catch (stripeError: unknown) {
  diagnostics.logStep("stripe_customer_lookup_failed", { error: stripeError.message });
  return new Response(JSON.stringify({ 
    success: false, 
    error: `Unable to verify subscription status: ${stripeError.message}`,
    code: "STRIPE_API_ERROR"
  }), {
    headers: { ...corsHeaders, "content-type": "application/json" },
    status: 503,
  });
}

// If no Stripe customer and no manual override, mark as unsubscribed (no free tier)
if (customers.data.length === 0) {
  diagnostics.logStep("No Stripe customer found, marking unsubscribed");
  await supabaseClient.from("subscribers").upsert({
    email: user.email,
    user_id: user.id,
    stripe_customer_id: null,
    subscribed: false,
    subscription_tier: null,
    subscription_end: null,
    trial_started_at: null,
    trial_expires_at: null,
    payment_collected: false,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'email' });
  return new Response(JSON.stringify({ 
    subscribed: false,
    subscription_tier: null,
    subscription_end: null,
    trial_expires_at: null,
    trial_started_at: null,
    payment_collected: false,
    requires_subscription: true,
    }), {
      headers: { ...corsHeaders, "content-type": "application/json" },
      status: 200,
    });
}

    const customerId = customers.data[0].id;
    diagnostics.logStep("Found Stripe customer", { customerId });

    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 1,
    });
    const hasActiveSub = subscriptions.data.length > 0;

    let subscriptionTier: string | null = null;
    let subscriptionEnd: string | null = null;
    let paymentCollected = false;
    let trialStartedAt: string | null = null;
    let trialExpiresAt: string | null = null;

    if (hasActiveSub) {
      const subscription = subscriptions.data[0];
      subscriptionEnd = new Date(subscription.current_period_end * 1000).toISOString();
      paymentCollected = true; // Active subscription means payment was collected
      diagnostics.logStep("Active subscription found", { subscriptionId: subscription.id, endDate: subscriptionEnd });
      
      // First check subscription metadata for tier (most reliable)
      subscriptionTier = subscription.metadata?.tier || null;
      diagnostics.logStep("Checked subscription metadata", { tier: subscriptionTier });
      
      // If no metadata tier, determine from price
      if (!subscriptionTier) {
        const priceId = subscription.items.data[0].price.id;
        const price = await stripe.prices.retrieve(priceId);
        const amount = price.unit_amount || 0;
        
        // Handle both monthly and yearly prices
        const monthlyAmount = price.recurring?.interval === 'year' ? Math.round(amount / 12) : amount;
        
        if (monthlyAmount >= 25000) {
          subscriptionTier = "pro";
        } else if (monthlyAmount >= 8900) {
          subscriptionTier = "growth";
        } else if (monthlyAmount >= 3900) {
          subscriptionTier = "starter";
        } else {
          subscriptionTier = "starter"; // Default fallback
        }
        diagnostics.logStep("Determined subscription tier from price", { priceId, amount, monthlyAmount, subscriptionTier });
      }
    } else {
      diagnostics.logStep("No active subscription found");
      // Check for trial subscription (trialing status)
      const trialingSubscriptions = await stripe.subscriptions.list({
        customer: customerId,
        status: "trialing",
        limit: 1,
      });
      if (trialingSubscriptions.data.length > 0) {
        const trialSubscription = trialingSubscriptions.data[0];
        subscriptionTier = "starter"; // Trial is only for starter tier
        subscriptionEnd = new Date(trialSubscription.current_period_end * 1000).toISOString();
        trialStartedAt = new Date(trialSubscription.created * 1000).toISOString();
        trialExpiresAt = subscriptionEnd;
        paymentCollected = true; // Payment method was collected
        diagnostics.logStep("Found trialing subscription", { subscriptionId: trialSubscription.id, trialEnd: subscriptionEnd });
      } else {
        subscriptionTier = null;
      }
    }

    // Update subscriber record with current status
    const updateData: any = {
      email: user.email,
      user_id: user.id,
      stripe_customer_id: customerId,
      subscribed: hasActiveSub || !!trialExpiresAt,
      subscription_tier: subscriptionTier,
      subscription_end: subscriptionEnd,
      trial_started_at: trialStartedAt ?? (existingSubscriber?.trial_started_at ?? null),
      trial_expires_at: trialExpiresAt ?? (existingSubscriber?.trial_expires_at ?? null),
      payment_collected: paymentCollected,
      updated_at: new Date().toISOString(),
    };

    await supabaseClient.from("subscribers").upsert(updateData, { onConflict: 'email' });

    diagnostics.logStep("Updated database with subscription info", { subscribed: updateData.subscribed, subscriptionTier });

    // BILLING BYPASS LOGIC - Check environment toggles after Stripe processing
    const bypassEnabled = Deno.env.get("BILLING_BYPASS_ENABLED") === "true";
    const allowedEmails = (Deno.env.get("BILLING_BYPASS_EMAILS") ?? "").split(",").map(s => s.trim().toLowerCase());
    const bypassCutoff = Deno.env.get("BILLING_BYPASS_EXPIRES_AT");
    
    const isEmailAllowed = allowedEmails.includes(user.email.toLowerCase());
    const isCutoffValid = !bypassCutoff || new Date() < new Date(bypassCutoff);
    
    if (bypassEnabled && isEmailAllowed && isCutoffValid) {
      diagnostics.logStep("BYPASS MODE - Applying subscription bypass", { 
        bypass: true, 
        email: user.email, 
        user_id: user.id 
      });
      
      // Get user's org_id
      const { data: userData } = await supabaseClient
        .from('users')
        .select('org_id')
        .eq('id', user.id)
        .single();
      
      if (!userData?.org_id) {
        diagnostics.logStep("BYPASS MODE - Cannot apply bypass: No org_id found for user");
        return new Response(JSON.stringify({ error: "User not associated with organization" }), {
          headers: { ...corsHeaders, "content-type": "application/json" },
          status: 400,
        });
      }
      
      // Check for existing non-bypass active or trialing subscriptions for this org
      const { data: existingNonBypass } = await supabaseClient
        .from('subscribers')
        .select('*')
        .eq('user_id', user.id)
        .or('subscribed.eq.true,trial_expires_at.gte.' + new Date().toISOString())
        .neq('stripe_customer_id', 'manual_bypass')
        .maybeSingle();
      
      if (existingNonBypass && existingNonBypass.metadata?.source !== 'bypass') {
        diagnostics.logStep("BYPASS MODE - Existing non-bypass subscription found, skipping bypass", {
          existing_subscription: existingNonBypass.subscription_tier,
          existing_source: existingNonBypass.metadata?.source
        });
        
        // Return the existing subscription data without modification
        return new Response(JSON.stringify({
          subscribed: existingNonBypass.subscribed,
          subscription_tier: existingNonBypass.subscription_tier,
          subscription_end: existingNonBypass.subscription_end,
          trial_expires_at: existingNonBypass.trial_expires_at,
          trial_started_at: existingNonBypass.trial_started_at,
          payment_collected: existingNonBypass.payment_collected,
          requires_subscription: !existingNonBypass.subscribed,
          metadata: existingNonBypass.metadata,
          // Normalized payload fields
          plan: (existingNonBypass.subscription_tier || 'starter').toUpperCase(),
          status: existingNonBypass.subscribed ? 'active' : 'inactive',
          current_period_end: existingNonBypass.subscription_end,
          source: existingNonBypass.metadata?.source || 'stripe'
        }), {
          headers: { ...corsHeaders, "content-type": "application/json" },
          status: 200,
        });
      }
      
      const bypassPeriodEnd = new Date();
      bypassPeriodEnd.setFullYear(bypassPeriodEnd.getFullYear() + 1); // 12 months from now
      
      // Prepare bypass data with normalized payload fields
      const bypassData = {
        email: user.email,
        user_id: user.id,
        stripe_customer_id: "manual_bypass",
        subscribed: true,
        subscription_tier: "starter",
        subscription_end: bypassPeriodEnd.toISOString(),
        trial_started_at: null,
        trial_expires_at: null,
        payment_collected: true,
        metadata: {
          source: "bypass",
          set_at: new Date().toISOString(),
          by: "check-subscription",
          plan: "STARTER",
          status: "active"
        },
        updated_at: new Date().toISOString(),
      };
      
      // Upsert with conflict handling - only update if existing record is also a bypass
      const { error: upsertError } = await supabaseClient
        .from("subscribers")
        .upsert(bypassData, { 
          onConflict: 'user_id',
          ignoreDuplicates: false 
        });
      
      if (upsertError) {
        diagnostics.logStep("BYPASS MODE - Upsert error", { error: upsertError.message });
        throw new Error(`Failed to apply bypass: ${upsertError.message}`);
      }
      
      diagnostics.logStep("BYPASS MODE - Subscription bypass applied successfully", { 
        bypass: true, 
        email: user.email, 
        user_id: user.id,
        org_id: userData.org_id,
        tier: "starter",
        expires: bypassPeriodEnd.toISOString()
      });
      
      // Return bypass subscription data with normalized payload
      return new Response(JSON.stringify({
        // Legacy API fields (keep unchanged)
        subscribed: true,
        subscription_tier: "starter",
        subscription_end: bypassPeriodEnd.toISOString(),
        trial_expires_at: null,
        trial_started_at: null,
        payment_collected: true,
        requires_subscription: false,
        bypass_mode: true,
        metadata: bypassData.metadata,
        // Normalized payload fields
        plan: 'STARTER',
        status: 'active',
        current_period_end: bypassPeriodEnd.toISOString(),
        source: 'bypass'
      }), {
        headers: { ...corsHeaders, "content-type": "application/json" },
        status: 200,
      });
    }

    const nowDate = new Date();
    const trialActive = updateData.trial_expires_at && new Date(updateData.trial_expires_at) > nowDate;

    return new Response(JSON.stringify({
      subscribed: !!(hasActiveSub || trialActive),
      subscription_tier: subscriptionTier,
      subscription_end: subscriptionEnd,
      trial_expires_at: updateData.trial_expires_at || null,
      trial_started_at: updateData.trial_started_at || null,
      payment_collected: updateData.payment_collected || false,
      requires_subscription: !(hasActiveSub || trialActive),
      metadata: existingSubscriber?.metadata || null, // Include existing metadata
    }), {
      headers: { ...corsHeaders, "content-type": "application/json" },
      status: 200,
    });
  } catch (error: unknown) {
    diagnostics.logStep("unexpected_error", { error: error.message, stack: error.stack });
    return new Response(JSON.stringify({ 
      success: false, 
      error: `Subscription check failed: ${error.message}`,
      code: "UNEXPECTED_ERROR",
      requestId: diagnostics.getRequestSummary().requestId
    }), {
      headers: { ...corsHeaders, "content-type": "application/json" },
      status: 500,
    });
  }
});