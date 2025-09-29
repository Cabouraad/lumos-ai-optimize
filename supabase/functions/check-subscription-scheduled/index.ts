import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";
import { getStrictCorsHeaders } from "../_shared/cors.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";

const corsHeaders = getStrictCorsHeaders();

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-SUBSCRIPTION-SCHEDULED] ${step}${detailsStr}`);
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    // Verify CRON_SECRET for scheduled runs OR JWT for user-triggered runs
    const authHeader = req.headers.get("Authorization");
    const cronSecret = req.headers.get("x-cron-secret");
    
    let isScheduledRun = false;
    let userId: string | null = null;
    
    if (cronSecret) {
      // Scheduled run - verify cron secret
      const supabaseAdmin = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );
      
      const { data: secretData, error: secretError } = await supabaseAdmin
        .from('app_settings')
        .select('value')
        .eq('key', 'cron_secret')
        .single();

      if (secretError || !secretData?.value || secretData.value !== cronSecret) {
        logStep("Invalid cron secret");
        return new Response(JSON.stringify({ error: 'Invalid cron secret' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      isScheduledRun = true;
      logStep("Cron authentication successful");
    } else if (authHeader) {
      // User-triggered run - verify JWT
      const supabaseClient = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_ANON_KEY") ?? ""
      );

      const token = authHeader.replace("Bearer ", "");
      const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
      
      if (userError || !userData.user) {
        logStep("Invalid JWT token");
        return new Response(JSON.stringify({ error: 'Invalid token' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      userId = userData.user.id;
      logStep("JWT authentication successful", { userId });
    } else {
      logStep("No authentication provided");
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Initialize Supabase and Stripe clients
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      throw new Error("STRIPE_SECRET_KEY is not set");
    }

    // Production safety check
    const nodeEnv = Deno.env.get("NODE_ENV");
    if (nodeEnv === "production" && stripeKey.startsWith("sk_test_")) {
      throw new Error("Cannot use test Stripe keys in production environment");
    }

    const stripe = new Stripe(stripeKey, { 
      apiVersion: "2023-10-16" 
    });

    let usersToCheck: { user_id: string; email: string; stripe_customer_id?: string }[] = [];

    if (isScheduledRun) {
      // Get all users with subscriptions to check
      const { data: subscribers, error: subscribersError } = await supabaseAdmin
        .from("subscribers")
        .select("user_id, email, stripe_customer_id")
        .eq("subscribed", true);

      if (subscribersError) {
        throw subscribersError;
      }

      usersToCheck = subscribers || [];
      logStep("Found subscribers to check", { count: usersToCheck.length });
    } else if (userId) {
      // Check specific user
      const { data: subscriber, error: subscriberError } = await supabaseAdmin
        .from("subscribers")
        .select("user_id, email, stripe_customer_id")
        .eq("user_id", userId)
        .single();

      if (subscriberError) {
        logStep("No subscription record found for user", { userId });
        return new Response(JSON.stringify({ 
          success: true, 
          message: 'No subscription to check' 
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      usersToCheck = [subscriber];
      logStep("Checking specific user subscription", { userId });
    }

    let updatedCount = 0;
    let errorCount = 0;

    for (const user of usersToCheck) {
      try {
        if (!user.stripe_customer_id) {
          logStep("No Stripe customer ID", { userId: user.user_id });
          continue;
        }

        // Get current Stripe subscription status
        const subscriptions = await stripe.subscriptions.list({
          customer: user.stripe_customer_id,
          status: 'all',
          limit: 1
        });

        const subscription = subscriptions.data[0];
        
        if (!subscription) {
          logStep("No Stripe subscription found", { userId: user.user_id });
          continue;
        }

        // Update subscription status in database
        const updateData: any = {
          subscribed: subscription.status === 'active',
          subscription_end: subscription.current_period_end ? 
            new Date(subscription.current_period_end * 1000).toISOString() : null,
          updated_at: new Date().toISOString()
        };

        // Update payment collected status based on subscription
        if (subscription.status === 'active') {
          updateData.payment_collected = true;
        }

        const { error: updateError } = await supabaseAdmin
          .from("subscribers")
          .update(updateData)
          .eq("user_id", user.user_id);

        if (updateError) {
          logStep("Failed to update subscription", { userId: user.user_id, error: updateError.message });
          errorCount++;
        } else {
          logStep("Updated subscription status", { 
            userId: user.user_id, 
            status: subscription.status 
          });
          updatedCount++;
        }

      } catch (error: unknown) {
        logStep("Error checking subscription", { 
          userId: user.user_id, 
          error: error instanceof Error ? error.message : String(error) 
        });
        errorCount++;
      }
    }

    const result = {
      success: true,
      message: `Checked ${usersToCheck.length} subscriptions`,
      updated: updatedCount,
      errors: errorCount,
      isScheduledRun
    };

    logStep("Function completed", result);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Internal server error',
      details: errorMessage
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});