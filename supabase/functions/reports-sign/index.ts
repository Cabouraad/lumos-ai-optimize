import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getStrictCorsHeaders } from "../_shared/cors.ts";

// CORS headers will be computed per request

// Helper logging function
const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[REPORTS-SIGN] ${step}${detailsStr}`);
};

serve(async (req) => {
  // Compute CORS headers for this specific request
  const requestOrigin = req.headers.get('origin');
  const corsHeaders = getStrictCorsHeaders(requestOrigin);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    // Only accept POST requests
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Initialize Supabase client with service role for admin operations
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // 1) Verify JWT authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      logStep("No authorization header");
      return new Response(JSON.stringify({ error: 'Authorization required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Initialize client with proper authentication headers
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: {
            Authorization: authHeader,
          },
        },
      }
    );

    // Get authenticated user
    const { data: userData, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !userData.user) {
      logStep("Authentication failed", { 
        error: userError?.message,
        hasAuthHeader: !!authHeader
      });
      return new Response(JSON.stringify({ error: 'Authentication failed' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = userData.user.id;
    logStep("User authenticated", { userId });

    // 2) Get user's org_id and role from users table
    const { data: userRecord, error: userRecordError } = await supabaseAdmin
      .from("users")
      .select("org_id, role, email")
      .eq("id", userId)
      .single();

    if (userRecordError || !userRecord?.org_id) {
      logStep("User not properly onboarded", { error: userRecordError?.message });
      return new Response(JSON.stringify({ error: 'User not properly onboarded' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const orgId = userRecord.org_id;
    const userRole = userRecord.role;
    const userEmail = userRecord.email;
    logStep("User org resolved", { orgId, userRole, userEmail });

    // Parse request body to get reportId
    const { reportId } = await req.json();
    if (!reportId) {
      return new Response(JSON.stringify({ error: 'reportId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    logStep("Report ID received", { reportId });

    // 3) Verify report exists and belongs to user's org
    const { data: report, error: reportError } = await supabaseAdmin
      .from("reports")
      .select("id, storage_path, org_id")
      .eq("id", reportId)
      .eq("org_id", orgId)
      .single();

    if (reportError || !report) {
      logStep("Report not found", { reportId, orgId, error: reportError?.message });
      return new Response(JSON.stringify({ error: 'Report not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    logStep("Report found", { reportId, storagePath: report.storage_path });

    // 4) Admin override - bypass plan gate for owners/admins
    const adminEmails = ['abouraa.chri@gmail.com', 'amirdt22@gmail.com'];
    const isAdminUser = adminEmails.includes(userEmail) || userRole === 'owner';
    
    if (isAdminUser) {
      logStep("Admin user - bypassing plan gate", { userEmail, userRole });
    } else {
      // Regular plan gate - check subscription tier
      let subscription = null;
      
      // Try user_id first, fallback to email
      const { data: subByUserId, error: subByUserIdError } = await supabaseAdmin
        .from("subscribers")
        .select("subscription_tier, subscribed")
        .eq("user_id", userId)
        .maybeSingle();
        
      if (subByUserId) {
        subscription = subByUserId;
      } else {
        // Fallback to email lookup
        const { data: subByEmail, error: subByEmailError } = await supabaseAdmin
          .from("subscribers")
          .select("subscription_tier, subscribed")
          .eq("email", userEmail)
          .maybeSingle();
        subscription = subByEmail;
      }

      if (!subscription) {
        logStep("No subscription found", { userId, userEmail });
        return new Response(JSON.stringify({ 
          error: 'Access denied', 
          code: 'plan_denied',
          message: 'Upgrade to Growth or Pro plan to access reports'
        }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const tier = subscription.subscription_tier?.toLowerCase();
      const allowedTiers = ['growth', 'pro'];
      
      if (!allowedTiers.includes(tier)) {
        logStep("Plan not allowed", { tier, allowedTiers });
        return new Response(JSON.stringify({ 
          error: 'Access denied', 
          code: 'plan_denied',
          message: 'Upgrade to Growth or Pro plan to access reports'
        }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      logStep("Plan gate passed", { tier });
    }

    // 5) Generate signed download URL
    const expiresIn = 300; // 5 minutes TTL
    
    // Normalize storage path: remove 'reports/' prefix if present since storage bucket is 'reports'
    const normalizedPath = report.storage_path.startsWith('reports/') 
      ? report.storage_path.substring('reports/'.length)
      : report.storage_path;
    
    logStep("Generating signed URL", { originalPath: report.storage_path, normalizedPath });
    
    const { data: signedUrlData, error: signedUrlError } = await supabaseAdmin.storage
      .from('reports')
      .createSignedUrl(normalizedPath, expiresIn);

    if (signedUrlError || !signedUrlData) {
      logStep("Failed to generate signed URL", { error: signedUrlError?.message });
      return new Response(JSON.stringify({ error: 'Failed to generate download URL' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
    logStep("Signed URL generated", { expiresAt });

    // 6) Return success response
    return new Response(JSON.stringify({
      url: signedUrlData.signedUrl,
      expiresAt
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});