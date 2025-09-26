import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://llumos.app, http://localhost:3000, https://cgocsffxqyhojtyzniyz.supabase.co",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CUSTOMER-PORTAL] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    logStep("Stripe key verified");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { 
        auth: { persistSession: false },
        global: { 
          headers: { Authorization: req.headers.get("Authorization") ?? "" }
        }
      }
    );

    const { data: userData, error: userError } = await supabaseClient.auth.getUser();
    if (userError) {
      logStep("Authentication failed", { error: userError.message });
      throw new Error(`Authentication failed: ${userError.message}`);
    }
    
    const user = userData.user;
    if (!user?.email) {
      logStep("User validation failed", { hasUser: !!user, hasEmail: !!user?.email });
      throw new Error("User not authenticated or email not available");
    }
    logStep("User authenticated", { userId: user.id, email: user.email });

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    if (customers.data.length === 0) {
      throw new Error("No Stripe customer found for this user");
    }
    const customerId = customers.data[0].id;
    logStep("Found Stripe customer", { customerId });

    // Create billing portal session with validated return URL
    const referer = req.headers.get('referer');
    const origin = req.headers.get('origin') || "https://cgocsffxqyhojtyzniyz.supabase.co";
    let returnUrl = `${origin}/settings`;
    
    // Validate return URL to prevent open redirects
    if (referer) {
      try {
        const refererUrl = new URL(referer);
        const allowedOrigins = [
          "http://localhost:3000",
          "https://llumos.app",
          "https://cgocsffxqyhojtyzniyz.supabase.co"
        ];
        
        if (allowedOrigins.includes(refererUrl.origin)) {
          returnUrl = `${refererUrl.origin}/settings`;
        }
      } catch (e: unknown) {
        // Invalid URL, use default
      }
    }
    
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });
    logStep("Customer portal session created", { sessionId: portalSession.id, url: portalSession.url });

    return new Response(JSON.stringify({ url: portalSession.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in customer-portal", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});