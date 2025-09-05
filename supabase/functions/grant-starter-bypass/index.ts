import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getStrictCorsHeaders } from "../_shared/cors.ts";
import { isEdgeFeatureEnabled } from "../_shared/feature-flags.ts";

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[GRANT-STARTER-BYPASS] ${step}${detailsStr}`);
};

serve(async (req) => {
  const corsHeaders = getStrictCorsHeaders(req.headers.get("Origin"));
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Check if billing bypass is enabled
  if (!isEdgeFeatureEnabled('FEATURE_BILLING_BYPASS')) {
    logStep("BLOCKED - Billing bypass feature is disabled");
    return new Response(JSON.stringify({ 
      success: false,
      error: "Billing bypass feature is not enabled"
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 403,
    });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started - BYPASS MODE ACTIVE");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");
    logStep("Authorization header found");

    const token = authHeader.replace("Bearer ", "");
    logStep("Authenticating user with token");
    
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id });

    // Validate test user eligibility
    const testEmails = ['starter@test.app', 'test@example.com'];
    if (!testEmails.includes(user.email)) {
      logStep("BLOCKED - User not eligible for bypass", { email: user.email });
      throw new Error("This bypass is only available for authorized test accounts");
    }

    logStep("BYPASS - Test user verified, granting starter bypass", { email: user.email });

    // Check for existing subscription to ensure idempotency
    const { data: existingSubscription } = await supabaseClient
      .from("subscribers")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (existingSubscription?.subscribed && existingSubscription?.subscription_tier === "starter") {
      logStep("BYPASS - Subscription already exists, skipping creation", {
        tier: existingSubscription.subscription_tier,
        expires: existingSubscription.trial_expires_at
      });
      
      return new Response(JSON.stringify({
        success: true,
        message: "Starter subscription already active (idempotent)",
        subscription: {
          subscribed: existingSubscription.subscribed,
          subscription_tier: existingSubscription.subscription_tier,
          subscription_end: existingSubscription.subscription_end,
          trial_expires_at: existingSubscription.trial_expires_at,
          trial_started_at: existingSubscription.trial_started_at,
          payment_collected: existingSubscription.payment_collected,
          requires_subscription: false,
          bypass_mode: true,
        }
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Set up starter subscription with manual bypass
    const trialStart = new Date();
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 30); // 30-day starter access for testing

    const subscriptionData = {
      email: user.email,
      user_id: user.id,
      stripe_customer_id: "manual_bypass", // Special flag to prevent Stripe override
      subscribed: true,
      subscription_tier: "starter",
      subscription_end: trialEnd.toISOString(),
      trial_started_at: trialStart.toISOString(),
      trial_expires_at: trialEnd.toISOString(),
      payment_collected: true, // Bypass payment requirement
      updated_at: new Date().toISOString(),
    };

    const { error: upsertError } = await supabaseClient
      .from("subscribers")
      .upsert(subscriptionData, { onConflict: 'user_id' });

    if (upsertError) {
      throw new Error(`Failed to update subscription: ${upsertError.message}`);
    }

    logStep("BYPASS - Successfully granted starter bypass", {
      tier: subscriptionData.subscription_tier,
      expires: subscriptionData.trial_expires_at,
      bypass_mode: true
    });

    return new Response(JSON.stringify({
      success: true,
      message: "Starter subscription bypass granted successfully",
      subscription: {
        subscribed: true,
        subscription_tier: "starter",
        subscription_end: subscriptionData.subscription_end,
        trial_expires_at: subscriptionData.trial_expires_at,
        trial_started_at: subscriptionData.trial_started_at,
        payment_collected: true,
        requires_subscription: false,
        bypass_mode: true,
      }
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in grant-starter-bypass", { message: errorMessage });
    return new Response(JSON.stringify({ 
      success: false,
      error: errorMessage 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});