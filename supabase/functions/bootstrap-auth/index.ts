import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";
import { getStrictCorsHeaders } from "../_shared/cors.ts";

interface BootstrapResponse {
  success: boolean;
  user_id: string;
  email: string;
  org_id: string | null;
  org: {
    id: string;
    name: string;
  } | null;
  subscription: {
    subscribed: boolean;
    subscription_tier: string;
    trial_expires_at: string | null;
    trial_started_at: string | null;
    payment_collected: boolean;
    requires_subscription: boolean;
    subscription_end: string | null;
    metadata: any;
  };
  has_access: boolean;
  reason?: string;
}

Deno.serve(async (req) => {
  const requestOrigin = req.headers.get('Origin');
  const corsHeaders = getStrictCorsHeaders(requestOrigin);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create service role client
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Get user from JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: "Invalid token or user not found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const { id: userId, email } = userData.user;

    if (!email) {
      return new Response(JSON.stringify({ error: "User email not available" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // Get user data with organization information
    const { data: userRecord, error: userQueryError } = await supabaseAdmin
      .from('users')
      .select(`
        id,
        email,
        role,
        org_id,
        organizations (
          id,
          name
        )
      `)
      .eq('id', userId)
      .maybeSingle();

    if (userQueryError) {
      console.error('Error fetching user record:', userQueryError);
      return new Response(JSON.stringify({ error: "Database error while fetching user" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    // Determine org data
    const orgId = userRecord?.org_id || null;
    const orgData = userRecord?.organizations || null;

    // Get subscription status
    let subscriptionData = {
      subscribed: false,
      subscription_tier: 'starter',
      trial_expires_at: null,
      trial_started_at: null,
      payment_collected: false,
      requires_subscription: true,
      subscription_end: null,
      metadata: null
    };

    try {
      // Try to get subscription data from subscribers table
      const { data: subscriberData, error: subError } = await supabaseAdmin
        .from('subscribers')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (!subError && subscriberData) {
        subscriptionData = {
          subscribed: subscriberData.subscribed || false,
          subscription_tier: subscriberData.subscription_tier || 'starter',
          trial_expires_at: subscriberData.trial_expires_at,
          trial_started_at: subscriberData.trial_started_at,
          payment_collected: subscriberData.payment_collected || false,
          requires_subscription: !subscriberData.subscribed,
          subscription_end: subscriberData.subscription_end,
          metadata: subscriberData.metadata
        };
      } else if (!subError) {
        // No subscriber record found, try by email
        const { data: subscriberByEmail, error: emailSubError } = await supabaseAdmin
          .from('subscribers')
          .select('*')
          .eq('email', email)
          .maybeSingle();

        if (!emailSubError && subscriberByEmail) {
          subscriptionData = {
            subscribed: subscriberByEmail.subscribed || false,
            subscription_tier: subscriberByEmail.subscription_tier || 'starter',
            trial_expires_at: subscriberByEmail.trial_expires_at,
            trial_started_at: subscriberByEmail.trial_started_at,
            payment_collected: subscriberByEmail.payment_collected || false,
            requires_subscription: !subscriberByEmail.subscribed,
            subscription_end: subscriberByEmail.subscription_end,
            metadata: subscriberByEmail.metadata
          };

          // Update the user_id in the subscriber record
          if (!subscriberByEmail.user_id) {
            await supabaseAdmin
              .from('subscribers')
              .update({ user_id: userId })
              .eq('email', email);
          }
        }
      }
    } catch (subQueryError) {
      console.warn('Error fetching subscription data:', subQueryError);
      // Continue with default subscription data
    }

    // Determine access level
    const hasActiveSubscription = subscriptionData.subscribed || 
      (subscriptionData.trial_expires_at && new Date(subscriptionData.trial_expires_at) > new Date());
    
    const hasAccess = hasActiveSubscription || !subscriptionData.requires_subscription;

    const response: BootstrapResponse = {
      success: true,
      user_id: userId,
      email: email,
      org_id: orgId,
      org: orgData ? {
        id: orgData.id,
        name: orgData.name
      } : null,
      subscription: subscriptionData,
      has_access: hasAccess,
      reason: !hasAccess ? 'Subscription required' : undefined
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error("Bootstrap auth error:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error",
      success: false 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});