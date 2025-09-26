import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { cors } from "../_shared/cors.ts";
import { createDiagnostics } from "../_shared/diagnostics.ts";
import { authenticateRequest, validateAuthEnvironment, getUserOrgId } from "../_shared/auth-utils.ts";

// Check if billing bypass is enabled and user is eligible
function checkBypassEligibility(userEmail: string): { eligible: boolean; reason?: string } {
  const bypassEnabled = Deno.env.get("BILLING_BYPASS_ENABLED") === "true";
  if (!bypassEnabled) {
    return { eligible: false, reason: "Billing bypass is disabled" };
  }

  const allowedEmails = Deno.env.get("BILLING_BYPASS_EMAILS")?.split(",").map((email: string) => email.trim().toLowerCase()) || [];
  if (!allowedEmails.includes(userEmail.toLowerCase())) {
    return { eligible: false, reason: "Email not in bypass list" };
  }

  const expiresAt = Deno.env.get("BILLING_BYPASS_EXPIRES_AT");
  if (expiresAt && new Date() > new Date(expiresAt)) {
    return { eligible: false, reason: "Bypass period has expired" };
  }

  return { eligible: true };
}

serve(async (req) => {
  const C = cors(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: C.headers });
  if (!C.allowed) return new Response("CORS: origin not allowed", { status: 403, headers: C.headers });
  
  const diagnostics = createDiagnostics("grant-starter-bypass", req);

  try {
    // Validate environment and authenticate user
    validateAuthEnvironment(diagnostics);
    
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    const user = await authenticateRequest(req, supabaseClient, diagnostics);

    // Check bypass eligibility using environment variables
    const eligibility = checkBypassEligibility(user.email);
    if (!eligibility.eligible) {
      diagnostics.logStep("bypass_eligibility_denied", { 
        reason: eligibility.reason 
      });
      throw new Error(`Access denied: ${eligibility.reason}`);
    }

    diagnostics.logStep("bypass_eligibility_approved", { 
      bypass_enabled: Deno.env.get("BILLING_BYPASS_ENABLED"),
      expires_at: Deno.env.get("BILLING_BYPASS_EXPIRES_AT") || "no expiration"
    });

    // Check for existing subscription to protect real paid customers
    const { data: existingSubscription } = await diagnostics.measure(
      "existing_subscription_check",
      () => supabaseClient
        .from("subscribers")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle()
    );

    // Get user's org_id for org-based bypass logic
    const orgId = await getUserOrgId(supabaseClient, user.id, diagnostics);

    // Check for existing non-bypass active or trialing subscriptions for this org
    const { data: existingNonBypass } = await supabaseClient
      .from('subscribers')
      .select('*')
      .eq('user_id', user.id)
      .or('subscribed.eq.true,trial_expires_at.gte.' + new Date().toISOString())
      .neq('stripe_customer_id', 'manual_bypass')
      .maybeSingle();

    // CRITICAL: Never overwrite real paid subscriptions
    if (existingNonBypass && existingNonBypass.metadata?.source !== 'bypass') {
      diagnostics.logStep("bypass_blocked_existing_subscription", {
        tier: existingNonBypass.subscription_tier,
        subscribed: existingNonBypass.subscribed,
        source: existingNonBypass.metadata?.source
      });
      
      return new Response(JSON.stringify({
        success: false,
        error: "Cannot apply bypass to user with existing non-bypass subscription"
      }), {
        headers: { ...C.headers, "content-type": "application/json" },
        status: 400,
      });
    }

    // Check if bypass already exists and is active
    if (existingSubscription?.subscribed && 
        existingSubscription?.subscription_tier === "starter" &&
        existingSubscription?.metadata?.source === 'bypass') {
      diagnostics.logStep("bypass_already_exists", {
        tier: existingSubscription.subscription_tier,
        expires: existingSubscription.subscription_end
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
          // Normalized payload fields
          plan: 'STARTER',
          status: 'active',
          current_period_end: existingSubscription.subscription_end,
          source: 'bypass'
        }
      }), {
        headers: { ...C.headers, "content-type": "application/json" },
        status: 200,
      });
    }

    // Set up starter subscription with manual bypass (12 months)
    const bypassPeriodEnd = new Date();
    bypassPeriodEnd.setFullYear(bypassPeriodEnd.getFullYear() + 1); // 12 months from now

    const subscriptionData = {
      email: user.email,
      user_id: user.id,
      stripe_customer_id: "manual_bypass",
      subscribed: true,
      subscription_tier: "starter",
      subscription_end: bypassPeriodEnd.toISOString(),
      trial_started_at: null,
      trial_expires_at: null,
      payment_collected: true,
      metadata: {
        source: "bypass",
        set_at: new Date().toISOString(),
        by: "grant-starter-bypass",
        plan: "STARTER",
        status: "active"
      },
      updated_at: new Date().toISOString(),
    };

    // Upsert with conflict handling - only update if existing record is also a bypass
    const { error: upsertError } = await supabaseClient
      .from("subscribers")
      .upsert(subscriptionData, { 
        onConflict: 'user_id',
        ignoreDuplicates: false 
      });

    if (upsertError) {
      throw new Error(`Failed to update subscription: ${upsertError.message}`);
    }

    diagnostics.logStep("bypass_granted_successfully", {
      tier: subscriptionData.subscription_tier,
      expires: subscriptionData.subscription_end,
      org_id: orgId,
      bypass_mode: true
    });

    return new Response(JSON.stringify({
      success: true,
      message: "Starter subscription bypass granted successfully",
      subscription: {
        subscribed: true,
        subscription_tier: "starter",
        subscription_end: subscriptionData.subscription_end,
        trial_expires_at: null,
        trial_started_at: null,
        payment_collected: true,
        requires_subscription: false,
        bypass_mode: true,
        metadata: subscriptionData.metadata,
        // Normalized payload fields
        plan: 'STARTER',
        status: 'active',
        current_period_end: subscriptionData.subscription_end,
        source: 'bypass'
      }
    }), {
      headers: { ...C.headers, "content-type": "application/json" },
      status: 200,
    });

  } catch (error: unknown) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    return diagnostics.createErrorResponse(errorObj, 500);
  }
});