import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// Dynamic CORS origin handling for multiple domains
function getCorsHeaders(requestOrigin: string | null) {
  const allowedOrigins = [
    "https://llumos.app",
    "https://www.llumos.app", 
    /^https:\/\/.*\.lovable\.app$/,
    /^https:\/\/.*\.lovable\.dev$/,
    /^http:\/\/localhost:\d+$/
  ];
  
  let allowedOrigin = "https://llumos.app"; // default fallback
  
  if (requestOrigin) {
    const isAllowed = allowedOrigins.some(origin => {
      if (typeof origin === 'string') {
        return origin === requestOrigin;
      } else {
        return origin.test(requestOrigin);
      }
    });
    
    if (isAllowed) {
      allowedOrigin = requestOrigin;
    }
  }
  
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-SUBSCRIPTION] ${step}${detailsStr}`);
};

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("Origin"));
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    logStep("Stripe key verified");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");
    logStep("Authorization header found");

    const token = authHeader.replace("Bearer ", "");
    logStep("Authenticating user with token");
    
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id }); // Removed email logging

// Check for existing subscriber record
const { data: existingSubscriber } = await supabaseClient
  .from('subscribers')
  .select('*')
  .eq('email', user.email)
  .maybeSingle();

// Manual override: honor existing active subscription or active trial in DB
const now = new Date();
const manualSubscribed = !!existingSubscriber?.subscribed;
const manualTrialActive = !!(existingSubscriber?.trial_expires_at && new Date(existingSubscriber.trial_expires_at) > now);
if (manualSubscribed || manualTrialActive) {
  logStep("Using manual subscription override from DB", {
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
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status: 200,
  });
}

const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
const customers = await stripe.customers.list({ email: user.email, limit: 1 });

// If no Stripe customer and no manual override, mark as unsubscribed (no free tier)
if (customers.data.length === 0) {
  logStep("No Stripe customer found, marking unsubscribed");
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
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status: 200,
  });
}

    const customerId = customers.data[0].id;
    logStep("Found Stripe customer", { customerId });

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
      logStep("Active subscription found", { subscriptionId: subscription.id, endDate: subscriptionEnd });
      
      // First check subscription metadata for tier (most reliable)
      subscriptionTier = subscription.metadata?.tier || null;
      logStep("Checked subscription metadata", { tier: subscriptionTier });
      
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
        logStep("Determined subscription tier from price", { priceId, amount, monthlyAmount, subscriptionTier });
      }
    } else {
      logStep("No active subscription found");
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
        logStep("Found trialing subscription", { subscriptionId: trialSubscription.id, trialEnd: subscriptionEnd });
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

    logStep("Updated database with subscription info", { subscribed: updateData.subscribed, subscriptionTier });

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
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in check-subscription", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});