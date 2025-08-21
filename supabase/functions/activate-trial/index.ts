import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[ACTIVATE-TRIAL] ${step}${detailsStr}`);
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

    const { sessionId } = await req.json();
    if (!sessionId) throw new Error("Session ID is required");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    
    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
    
    // Retrieve the setup session
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    logStep("Retrieved checkout session", { sessionId, status: session.status });
    
    if (session.status !== 'complete') {
      throw new Error("Payment setup not completed");
    }

    if (!session.customer || !session.metadata?.trial_setup) {
      throw new Error("Invalid session for trial activation");
    }

    const customerId = session.customer as string;
    const userId = session.metadata.user_id;
    
    // Get customer details
    const customer = await stripe.customers.retrieve(customerId) as Stripe.Customer;
    if (!customer.email) throw new Error("Customer email not found");
    
    logStep("Customer verified", { customerId, email: customer.email });

    // Start the trial - user has provided payment method
    const trialStart = new Date();
    const trialEnd = new Date(trialStart);
    trialEnd.setDate(trialEnd.getDate() + 7); // 7-day trial

    await supabaseClient.from("subscribers").upsert({
      email: customer.email,
      user_id: userId,
      stripe_customer_id: customerId,
      subscribed: false,
      subscription_tier: 'starter',
      subscription_end: null,
      trial_started_at: trialStart.toISOString(),
      trial_expires_at: trialEnd.toISOString(),
      payment_collected: true, // Payment method collected
      updated_at: new Date().toISOString(),
    }, { onConflict: 'email' });

    logStep("Trial activated successfully", { 
      email: customer.email, 
      trialStart: trialStart.toISOString(), 
      trialEnd: trialEnd.toISOString() 
    });

    return new Response(JSON.stringify({ 
      success: true,
      trial_expires_at: trialEnd.toISOString(),
      trial_started_at: trialStart.toISOString() 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in activate-trial", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});