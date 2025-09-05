import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { cors } from "../_shared/cors.ts";
import { createDiagnostics } from "../_shared/diagnostics.ts";
import { authenticateRequest, validateAuthEnvironment } from "../_shared/auth-utils.ts";

serve(async (req) => {
  const C = cors(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: C.headers });
  if (!C.allowed) return new Response("CORS: origin not allowed", { status: 403, headers: C.headers });
  
  const diagnostics = createDiagnostics("check-subscription", req);

  try {
    // Validate environment and authenticate user
    validateAuthEnvironment(diagnostics);
    
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      throw new Error("STRIPE_SECRET_KEY is not set");
    }
    diagnostics.logStep("stripe_key_verified");

    const user = await authenticateRequest(req, supabaseClient, diagnostics);

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
      headers: { ...C.headers, "content-type": "application/json" },
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
      headers: { ...C.headers, "content-type": "application/json" },
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
      headers: { ...C.headers, "content-type": "application/json" },
      status: 200,
    });
}

const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
const customers = await stripe.customers.list({ email: user.email, limit: 1 });

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
      headers: { ...C.headers, "content-type": "application/json" },
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
        
        if (monthlyAmount >= 19900) {
          subscriptionTier = "pro";
        } else if (monthlyAmount >= 6900) {
          subscriptionTier = "growth";
        } else if (monthlyAmount >= 2900) {
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
          headers: { ...C.headers, "content-type": "application/json" },
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
          headers: { ...C.headers, "content-type": "application/json" },
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
        headers: { ...C.headers, "content-type": "application/json" },
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
      headers: { ...C.headers, "content-type": "application/json" },
      status: 200,
    });
  } catch (error) {
    return diagnostics.createErrorResponse(error as Error, 500);
  }
});