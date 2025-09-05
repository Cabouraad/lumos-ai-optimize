import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getStrictCorsHeaders } from "../_shared/cors.ts";

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[GRANT-STARTER-BYPASS] ${step}${detailsStr}`);
};

serve(async (req) => {
  const corsHeaders = getStrictCorsHeaders(req.headers.get("Origin"));
  
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

    // Only allow this for the specific test user
    if (user.email !== "starter@test.app") {
      throw new Error("This bypass is only available for the test account");
    }

    logStep("Test user verified, granting starter bypass");

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
      .upsert(subscriptionData, { onConflict: 'email' });

    if (upsertError) {
      throw new Error(`Failed to update subscription: ${upsertError.message}`);
    }

    logStep("Successfully granted starter bypass", {
      tier: subscriptionData.subscription_tier,
      expires: subscriptionData.trial_expires_at
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