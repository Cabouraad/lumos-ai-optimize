import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RequestBody {
  tier: 'starter' | 'growth' | 'pro';
  billingCycle: 'monthly' | 'yearly';
}

const TIER_PRICES = {
  starter: {
    monthly: 1900, // $19.00
    yearly: 19000 // $190.00 (save ~17%)
  },
  growth: {
    monthly: 6900, // $69.00
    yearly: 69000 // $690.00 (save ~17%)
  },
  pro: {
    monthly: 19900, // $199.00
    yearly: 199000 // $1,990.00 (save ~17%)
  }
};

serve(async (req) => {
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

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { 
      apiVersion: "2023-10-16" 
    });

    // Check if customer exists
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    }

    const session = await stripe.checkout.sessions.create({
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
      success_url: `${req.headers.get("origin")}/dashboard?subscription=success`,
      cancel_url: `${req.headers.get("origin")}/pricing?subscription=cancelled`,
      metadata: {
        user_id: user.id,
        tier: tier,
        billing_cycle: billingCycle
      }
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