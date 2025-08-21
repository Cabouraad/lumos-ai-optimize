import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-SUBSCRIPTION] ${step}${detailsStr}`);
};

serve(async (req) => {
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
    logStep("User authenticated", { userId: user.id, email: user.email });

    // Check for existing subscriber record
    const { data: existingSubscriber } = await supabaseClient
      .from('subscribers')
      .select('*')
      .eq('email', user.email)
      .single();

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    
    // Check if this is a new user (first check)
    const isNewUser = !existingSubscriber;
    
    if (customers.data.length === 0) {
      logStep("No customer found, no trial without payment");
      
      // New users get free tier by default - no trial without payment
      await supabaseClient.from("subscribers").upsert({
        email: user.email,
        user_id: user.id,
        stripe_customer_id: null,
        subscribed: false,
        subscription_tier: 'free',
        subscription_end: null,
        trial_started_at: null,
        trial_expires_at: null,
        payment_collected: false,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'email' });
      
      return new Response(JSON.stringify({ 
        subscribed: false,
        subscription_tier: 'free',
        subscription_end: null,
        trial_expires_at: null,
        trial_started_at: null,
        payment_collected: false,
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
    let subscriptionTier = null;
    let subscriptionEnd = null;
    let paymentCollected = false;

    if (hasActiveSub) {
      const subscription = subscriptions.data[0];
      subscriptionEnd = new Date(subscription.current_period_end * 1000).toISOString();
      paymentCollected = true; // Active subscription means payment was collected
      logStep("Active subscription found", { subscriptionId: subscription.id, endDate: subscriptionEnd });
      
      // Determine subscription tier from price
      const priceId = subscription.items.data[0].price.id;
      const price = await stripe.prices.retrieve(priceId);
      const amount = price.unit_amount || 0;
      
      // Map price to tier based on our pricing structure
      if (amount >= 19900) {
        subscriptionTier = "pro";
      } else if (amount >= 6900) {
        subscriptionTier = "growth";
      } else {
        subscriptionTier = "starter";
      }
      logStep("Determined subscription tier", { priceId, amount, subscriptionTier });
    } else {
      logStep("No active subscription found");
      
      // Users without active subscriptions get free tier - no auto trial
      subscriptionTier = "free";
    }

    // Update subscriber record with current status
    const updateData: any = {
      email: user.email,
      user_id: user.id,
      stripe_customer_id: customerId,
      subscribed: hasActiveSub,
      subscription_tier: subscriptionTier,
      subscription_end: subscriptionEnd,
      payment_collected: paymentCollected,
      updated_at: new Date().toISOString(),
    };
    
    // Preserve existing trial data if no active subscription
    if (!hasActiveSub && existingSubscriber) {
      updateData.trial_started_at = existingSubscriber.trial_started_at;
      updateData.trial_expires_at = existingSubscriber.trial_expires_at;
    }

    await supabaseClient.from("subscribers").upsert(updateData, { onConflict: 'email' });

    logStep("Updated database with subscription info", { subscribed: hasActiveSub, subscriptionTier });
    
    return new Response(JSON.stringify({
      subscribed: hasActiveSub,
      subscription_tier: subscriptionTier || existingSubscriber?.subscription_tier || 'starter',
      subscription_end: subscriptionEnd,
      trial_expires_at: existingSubscriber?.trial_expires_at || null,
      trial_started_at: existingSubscriber?.trial_started_at || null,
      payment_collected: paymentCollected,
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