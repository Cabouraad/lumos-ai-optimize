import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";
import { getStrictCorsHeaders } from "../_shared/cors.ts";

const generateIdempotencyKey = (userId: string, intent: string): string => {
  return `${userId}:${intent}:${Date.now() >> 13}`;
};

const validateProductionSafety = (stripeKey: string) => {
  const nodeEnv = Deno.env.get("NODE_ENV");
  if (nodeEnv === "production" && stripeKey.startsWith("sk_test_")) {
    throw new Error("Cannot use test Stripe keys in production environment");
  }
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-TRIAL-CHECKOUT] ${step}${detailsStr}`);
};

Deno.serve(async (req) => {
  const requestOrigin = req.headers.get('Origin');
  const corsHeaders = getStrictCorsHeaders(requestOrigin);
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    logStep("CORS preflight (OPTIONS) request handled");
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started", { method: req.method, origin: requestOrigin });

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    
    // Validate production safety
    validateProductionSafety(stripeKey);
    
    logStep("Stripe key verified");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");
    
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id });

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
    
    // Check if customer already exists
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId;
    
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep("Existing customer found", { customerId });
    } else {
      // Create new customer
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { user_id: user.id }
      });
      customerId = customer.id;
      logStep("New customer created", { customerId });
    }

    // Determine redirect base URL from request origin (fallback to production)
    const origin = req.headers.get("origin") || "https://llumos.app";
    const baseUrl = origin;

    // Generate idempotency key for Stripe call
    const idempotencyKey = generateIdempotencyKey(user.id, "trial-checkout");
    
    // Create checkout session for trial subscription with 7-day trial
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: { 
              name: "Llumos Starter Plan",
              description: "Starter tier subscription for Llumos AI Search Optimization"
            },
            unit_amount: 3900, // $39/month
            recurring: { 
              interval: 'month'
            },
          },
          quantity: 1,
        },
      ],
      mode: 'subscription', // Subscription mode to show trial information
      subscription_data: {
        trial_period_days: 7, // This makes Stripe show "7-day free trial" on checkout
        metadata: {
          user_id: user.id,
          tier: 'starter',
          billing_cycle: 'monthly'
        }
      },
      success_url: `${baseUrl}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/pricing`,
      metadata: {
        user_id: user.id,
        tier: 'starter',
        trial_setup: 'true'
      }
    }, {
      idempotencyKey
    });

    logStep("Trial checkout session created", { sessionId: session.id, url: session.url });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in create-trial-checkout", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});