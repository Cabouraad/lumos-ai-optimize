import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";
import { withRequestLogging } from "../_shared/observability/structured-logger.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://llumos.app",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
  "Access-Control-Allow-Methods": "POST",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  return withRequestLogging("stripe-webhook", req, async (logger) => {
    logger.info("Webhook received");
    
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    
    if (!stripeKey || !webhookSecret) {
      logger.error("Missing Stripe configuration");
      return new Response("Server configuration error", { 
        status: 500, 
        headers: corsHeaders 
      });
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
    
    // Get the raw body and signature
    const body = await req.text();
    const signature = req.headers.get("stripe-signature");

    if (!signature) {
      logger.error("Missing Stripe signature");
      return new Response("Missing signature", { status: 400, headers: corsHeaders });
    }

    // Verify webhook signature
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
      logger.info("Webhook signature verified", { metadata: { type: event.type } });
    } catch (err: unknown) {
      const errorObj = err instanceof Error ? err : new Error(String(err));
      logger.error("Invalid signature", errorObj);
      return new Response("Invalid signature", { status: 400, headers: corsHeaders });
    }

    // Initialize Supabase client with service role
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Check for idempotency
    const idempotencyKey = `stripe_${event.id}`;
    const { data: existing } = await supabaseClient
      .from("webhook_events")
      .select("id")
      .eq("idempotency_key", idempotencyKey)
      .single();

    if (existing) {
      logger.info("Duplicate webhook ignored", { metadata: { eventId: event.id } });
      return new Response("OK", { status: 200, headers: corsHeaders });
    }

    // Log webhook event
    await supabaseClient
      .from("webhook_events")
      .insert({
        idempotency_key: idempotencyKey,
        event_type: event.type,
        processed: false,
        created_at: new Date().toISOString()
      });

    // Handle different event types
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated":
        await handleSubscriptionEvent(supabaseClient, event, stripe, logger);
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionCancellation(supabaseClient, event, stripe, logger);
        break;
      case "invoice.payment_succeeded":
        await handlePaymentSuccess(supabaseClient, event, stripe, logger);
        break;
      case "invoice.payment_failed":
        await handlePaymentFailed(supabaseClient, event, stripe, logger);
        break;
      default:
        logger.info("Unhandled event type", { metadata: { type: event.type } });
    }

    // Mark as processed
    await supabaseClient
      .from("webhook_events")
      .update({ processed: true })
      .eq("idempotency_key", idempotencyKey);

    logger.info("Webhook processed successfully", { metadata: { type: event.type } });
    return new Response("OK", { status: 200, headers: corsHeaders });
  });
});

async function handleSubscriptionEvent(
  supabaseClient: any, 
  event: Stripe.Event, 
  stripe: Stripe,
  logger: any
) {
  const subscription = event.data.object as Stripe.Subscription;
  
  logger.info("Processing subscription event", { 
    metadata: {
      subscriptionId: subscription.id,
      status: subscription.status 
    }
  });

  // Get customer details
  const customer = await stripe.customers.retrieve(subscription.customer as string);
  if (!customer || customer.deleted) {
    throw new Error("Customer not found");
  }

  const email = (customer as Stripe.Customer).email;
  if (!email) {
    throw new Error("Customer email not found");
  }

  // Get user by email
  const { data: user } = await supabaseClient.auth.admin.listUsers();
  const matchedUser = user?.users?.find((u: any) => u.email === email);
  
  if (!matchedUser) {
    logger.warn("User not found for subscription", { metadata: { email } });
    return;
  }

  // First check subscription metadata for tier (most reliable)
  let subscriptionTier = subscription.metadata?.tier || null;
  logger.info("Checked subscription metadata", { metadata: { tier: subscriptionTier } });
  
  // If no metadata tier, determine from price
  if (!subscriptionTier) {
    const price = subscription.items.data[0]?.price;
    if (price) {
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
      logger.info("Determined tier from price", { metadata: { amount, monthlyAmount, tier: subscriptionTier } });
    } else {
      subscriptionTier = "starter"; // Default fallback
    }
  }

  // Update subscription record
  await supabaseClient
    .from("subscribers")
    .upsert({
      user_id: matchedUser.id,
      email: email,
      stripe_customer_id: subscription.customer,
      stripe_subscription_id: subscription.id,
      subscription_tier: subscriptionTier,
      subscribed: subscription.status === "active",
      subscription_end: new Date(subscription.current_period_end * 1000).toISOString(),
      payment_collected: subscription.status === "active",
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' });

  logger.info("Subscription updated", { 
    metadata: {
      userId: matchedUser.id, 
      tier: subscriptionTier,
      status: subscription.status 
    }
  });
}

async function handleSubscriptionCancellation(
  supabaseClient: any, 
  event: Stripe.Event, 
  stripe: Stripe,
  logger: any
) {
  const subscription = event.data.object as Stripe.Subscription;
  
  logger.info("Processing subscription cancellation", { 
    metadata: { subscriptionId: subscription.id }
  });

  // Update subscription to mark as cancelled and revoke tier access
  await supabaseClient
    .from("subscribers")
    .update({
      subscribed: false,
      subscription_tier: 'free',
      subscription_end: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq("stripe_subscription_id", subscription.id);
  
  logger.info("Subscription cancelled and tier set to free", { 
    metadata: { subscriptionId: subscription.id }
  });
}

async function handlePaymentSuccess(
  supabaseClient: any, 
  event: Stripe.Event, 
  stripe: Stripe,
  logger: any
) {
  const invoice = event.data.object as Stripe.Invoice;
  
  if (invoice.subscription) {
    await supabaseClient
      .from("subscribers")
      .update({
        payment_collected: true,
        updated_at: new Date().toISOString()
      })
      .eq("stripe_subscription_id", invoice.subscription);
  }
}

async function handlePaymentFailed(
  supabaseClient: any, 
  event: Stripe.Event, 
  stripe: Stripe,
  logger: any
) {
  const invoice = event.data.object as Stripe.Invoice;
  
  if (invoice.subscription) {
    await supabaseClient
      .from("subscribers")
      .update({
        payment_collected: false,
        updated_at: new Date().toISOString()
      })
      .eq("stripe_subscription_id", invoice.subscription);
  }
}