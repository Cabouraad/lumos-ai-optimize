import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[DAILY-SUB-CHECK] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    logStep("Starting daily subscription check");

    // Verify cron secret
    const cronSecret = req.headers.get('x-cron-secret');
    if (!cronSecret) {
      logStep("Missing cron secret");
      return new Response(
        JSON.stringify({ error: 'Missing cron secret' }),
        { status: 401, headers: corsHeaders }
      );
    }

    // Verify secret against database
    const { data: secretData, error: secretError } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'cron_secret')
      .single();

    if (secretError || !secretData?.value || secretData.value !== cronSecret) {
      logStep("Invalid cron secret");
      return new Response(
        JSON.stringify({ error: 'Invalid cron secret' }),
        { status: 401, headers: corsHeaders }
      );
    }

    // Get all active users (logged in within the last 30 days)
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, email, created_at')
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

    if (usersError) {
      logStep("Error fetching users", { error: usersError.message });
      throw usersError;
    }

    if (!users || users.length === 0) {
      logStep("No active users found");
      return new Response(JSON.stringify({
        success: true,
        message: 'No active users to check',
        processedUsers: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    logStep("Found active users", { count: users.length });

    let processedUsers = 0;
    let successfulChecks = 0;
    let failedChecks = 0;
    const results: any[] = [];

    // Process users in batches to avoid overwhelming the system
    const batchSize = 10;
    for (let i = 0; i < users.length; i += batchSize) {
      const batch = users.slice(i, i + batchSize);
      
      await Promise.all(batch.map(async (user) => {
        try {
          // Create a temporary token for the user to check their subscription
          const { data: authData, error: authError } = await supabase.auth.admin.generateLink({
            type: 'magiclink',
            email: user.email,
            options: {
              redirectTo: `${Deno.env.get('SUPABASE_URL')}/auth/v1/callback`
            }
          });

          if (authError) {
            logStep(`Failed to generate auth for user ${user.id}`, { error: authError.message });
            failedChecks++;
            results.push({
              userId: user.id,
              email: user.email,
              success: false,
              error: authError.message
            });
            return;
          }

          // Extract the access token from the magic link
          const urlParams = new URL(authData.properties.action_link).searchParams;
          const accessToken = urlParams.get('access_token');

          if (!accessToken) {
            logStep(`No access token for user ${user.id}`);
            failedChecks++;
            results.push({
              userId: user.id,
              email: user.email,
              success: false,
              error: 'No access token generated'
            });
            return;
          }

          // Call check-subscription function with the user's token
          const checkResponse = await fetch(`${supabaseUrl}/functions/v1/check-subscription`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
              'apikey': Deno.env.get('SUPABASE_ANON_KEY')!,
            }
          });

          if (!checkResponse.ok) {
            const errorText = await checkResponse.text();
            logStep(`Subscription check failed for user ${user.id}`, { status: checkResponse.status, error: errorText });
            failedChecks++;
            results.push({
              userId: user.id,
              email: user.email,
              success: false,
              error: `HTTP ${checkResponse.status}: ${errorText}`
            });
            return;
          }

          const subscriptionData = await checkResponse.json();
          successfulChecks++;
          results.push({
            userId: user.id,
            email: user.email,
            success: true,
            subscriptionData
          });

          logStep(`Successfully checked subscription for user ${user.id}`, {
            subscribed: subscriptionData.subscribed,
            tier: subscriptionData.subscription_tier
          });

        } catch (error) {
          logStep(`Exception checking user ${user.id}`, { error: error.message });
          failedChecks++;
          results.push({
            userId: user.id,
            email: user.email,
            success: false,
            error: error.message
          });
        }
        
        processedUsers++;
      }));

      // Small delay between batches
      if (i + batchSize < users.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    const finalResult = {
      success: true,
      message: `Daily subscription check completed`,
      totalUsers: users.length,
      processedUsers,
      successfulChecks,
      failedChecks,
      timestamp: new Date().toISOString(),
      results: results.slice(0, 10) // Only include first 10 results to avoid large responses
    };

    logStep("Daily subscription check completed", {
      totalUsers: users.length,
      successful: successfulChecks,
      failed: failedChecks
    });

    return new Response(JSON.stringify(finalResult), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    logStep("Error in daily subscription checker", { error: error.message });
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});