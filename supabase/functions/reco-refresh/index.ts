import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildRecommendations } from "../_shared/reco/engine.ts";
import { upsertRecommendations } from "../_shared/reco/persist.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Only allow POST requests
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { 
          status: 405, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Parse request body
    let body;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON body' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const { accountId } = body;
    if (!accountId) {
      return new Response(
        JSON.stringify({ error: 'accountId is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Authenticate the request using the Authorization header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Create client for user authentication check
    const userSupabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader
        }
      }
    });

    // Verify user is authenticated and get their details
    const { data: { user }, error: authError } = await userSupabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Authentication failed' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Check if user is owner of the target account OR has admin access
    const { data: userRecord } = await userSupabase
      .from('users')
      .select('org_id, role')
      .eq('id', user.id)
      .single();

    if (!userRecord) {
      return new Response(
        JSON.stringify({ error: 'User record not found' }),
        { 
          status: 403, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Verify user has access to this account (is owner of the target org)
    if (userRecord.org_id !== accountId || userRecord.role !== 'owner') {
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions' }),
        { 
          status: 403, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Use service role client for recommendation operations
    const serviceSupabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log(`Refreshing recommendations for account: ${accountId}`);

    // Verify the account exists
    const { data: org } = await serviceSupabase
      .from('organizations')
      .select('id, name')
      .eq('id', accountId)
      .single();

    if (!org) {
      return new Response(
        JSON.stringify({ error: 'Account not found' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Generate recommendations using the service client
    console.log(`Building recommendations for org: ${org.name}`);
    const recommendations = await buildRecommendations(serviceSupabase, accountId);
    
    console.log(`Generated ${recommendations.length} recommendations`);

    // Persist recommendations
    await upsertRecommendations(serviceSupabase, accountId, recommendations);

    console.log(`Recommendations refresh completed for ${org.name}`);

    return new Response(
      JSON.stringify({ 
        created: recommendations.length,
        account: org.name
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error) {
    console.error('Recommendation refresh error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: String(error)
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});