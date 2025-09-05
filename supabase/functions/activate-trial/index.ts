import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { cors } from "../_shared/cors.ts";

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[ACTIVATE-TRIAL] ${step}${detailsStr}`);
};

serve(async (req) => {
  const C = cors(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: C.headers });
  if (!C.allowed) return new Response("CORS: origin not allowed", { status: 403, headers: C.headers });

  try {
    // Get authorization header for authenticated requests
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      logStep('Missing authorization header');
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...C.headers, "content-type": "application/json" } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify the user is authenticated
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      logStep('Authentication failed', { error: authError });
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...C.headers, "content-type": "application/json" } }
      );
    }

    const { sessionId } = await req.json();
    if (!sessionId) {
      throw new Error("Session ID is required");
    }
    logStep('Processing session for authenticated user', { sessionId, userId: user.id });

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    
    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
    
    // Retrieve the checkout session
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    logStep("Retrieved checkout session", { sessionId, status: session.status });
    
    if (session.status !== 'complete') {
      throw new Error("Payment setup not completed");
    }

    if (!session.customer || !session.metadata?.trial_setup) {
      throw new Error("Invalid session for trial activation");
    }

    // Retrieve customer details
    const customer = await stripe.customers.retrieve(session.customer as string);
    logStep('Retrieved customer', { customerId: customer.id });

    if (!customer || customer.deleted) {
      throw new Error('Customer not found or deleted');
    }

    const customerEmail = (customer as any).email;
    
    // Security validation: ensure the authenticated user matches the customer
    if (user.email !== customerEmail) {
      logStep('Email mismatch security check failed', { 
        userEmail: user.email, 
        customerEmail: customerEmail 
      });
      return new Response(
        JSON.stringify({ error: 'User email does not match customer email' }),
        { status: 403, headers: { ...C.headers, "content-type": "application/json" } }
      );
    }

    // Additional validation: check session metadata if available
    const sessionMetadata = session.metadata;
    if (sessionMetadata?.user_id && sessionMetadata.user_id !== user.id) {
      logStep('User ID mismatch security check failed', {
        sessionUserId: sessionMetadata.user_id,
        authenticatedUserId: user.id
      });
      return new Response(
        JSON.stringify({ error: 'User ID mismatch' }),
        { status: 403, headers: { ...C.headers, "content-type": "application/json" } }
      );
    }

    // Use secure function to update subscriber data
    const trialStartedAt = new Date();
    const trialExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
    
    const { error } = await supabaseAdmin.rpc('update_subscriber_safe', {
      p_user_id: user.id,
      p_email: customerEmail,
      p_stripe_customer_id: customer.id,
      p_subscription_tier: 'starter',
      p_trial_started_at: trialStartedAt.toISOString(),
      p_trial_expires_at: trialExpiresAt.toISOString(),
      p_payment_collected: true
    });

    if (error) {
      logStep('Database update failed', { error });
      throw new Error(`Failed to update subscriber: ${error.message}`);
    }

    logStep('Trial activated successfully', { 
      userId: user.id,
      trialExpires: trialExpiresAt.toISOString()
    });

    return new Response(
      JSON.stringify({
        success: true,
        trial_expires_at: trialExpiresAt.toISOString(),
        trial_started_at: trialStartedAt.toISOString()
      }),
      { headers: { ...C.headers, "content-type": "application/json" } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in activate-trial", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...C.headers, "content-type": "application/json" },
      status: 500,
    });
  }
});