import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getStrictCorsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  const requestOrigin = req.headers.get('Origin');
  const corsHeaders = getStrictCorsHeaders(requestOrigin);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");

    const { tier, billingCycle }: RequestBody = await req.json();
    
    // Validate tier and billing cycle
    if (!TIER_PRICES[tier] || !TIER_PRICES[tier][billingCycle]) {
      throw new Error("Invalid tier or billing cycle");
    }

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY") || "";
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    
    // Validate production safety
    validateProductionSafety(stripeKey);
    
    const stripe = new Stripe(stripeKey, { 
      apiVersion: "2023-10-16" 
    });

    // Check if customer exists
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    }

    // Determine redirect base URL from request origin (fallback to production)
    const origin = req.headers.get("origin") || "https://llumos.app";
    const baseUrl = origin;

    // Create subscription with trial for starter tier
    const sessionConfig: any = {
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: { 
              name: `Llumos ${tier.charAt(0).toUpperCase() + tier.slice(1)} Plan`,
              description: `${tier} tier subscription for Llumos AI Search Optimization`
            },
            unit_amount: TIER_PRICES[tier][billingCycle],
            recurring: { 
              interval: billingCycle === 'yearly' ? 'year' : 'month'
            },
          },
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: `${baseUrl}/dashboard?subscription=success`,
      cancel_url: `${baseUrl}/onboarding?subscription=cancelled`,
      metadata: {
        user_id: user.id,
        tier: tier,
        billing_cycle: billingCycle
      }
    };

    // Add subscription metadata for all tiers
    sessionConfig.subscription_data = {
      metadata: {
        user_id: user.id,
        tier: tier,
        billing_cycle: billingCycle
      }
    };

    // Add 7-day trial for starter tier only
    if (tier === 'starter') {
      sessionConfig.subscription_data.trial_period_days = 7;
    }

    // Generate idempotency key for Stripe call
    const idempotencyKey = generateIdempotencyKey(user.id, `checkout:${tier}:${billingCycle}`);
    
    const session = await stripe.checkout.sessions.create(sessionConfig, {
      idempotencyKey
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Create checkout error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});