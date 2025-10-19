import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

interface RequestBody {
  scope?: 'org' | 'prompt';
  promptId?: string;
  force?: boolean;
  orgId?: string; // Only for cron jobs with x-cron-secret
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const cronSecret = Deno.env.get('CRON_SECRET');
    
    // Check if this is a cron job request
    const isCronRequest = req.headers.get('x-cron-secret') === cronSecret;
    
    let orgId: string;
    let body: RequestBody = {};
    
    if (isCronRequest) {
      // Cron request: orgId must be in body
      body = await req.json();
      if (!body.orgId) {
        throw new Error('orgId required for cron requests');
      }
      orgId = body.orgId;
      console.log(`[CRON] Computing Llumos score for org ${orgId}`);
    } else {
      // User request: validate JWT and get org from user
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) {
        throw new Error('Missing authorization header');
      }

      const supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
        global: {
          headers: { Authorization: authHeader },
        },
      });

      const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
      if (authError || !user) {
        throw new Error('Unauthorized');
      }

      // Get user's org_id
      const { data: userData, error: userError } = await supabaseClient
        .from('users')
        .select('org_id')
        .eq('id', user.id)
        .single();

      if (userError || !userData?.org_id) {
        throw new Error('User org not found');
      }

      orgId = userData.org_id;
      body = await req.json().catch(() => ({}));
    }

    // Parse request body
    const scope = body.scope || 'org';
    const promptId = body.promptId || null;
    const force = body.force || false;

    // Validate scope
    if (scope !== 'org' && scope !== 'prompt') {
      throw new Error('Invalid scope. Must be "org" or "prompt"');
    }

    if (scope === 'prompt' && !promptId) {
      throw new Error('promptId required for prompt scope');
    }

    // Use service role client for computation
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    // Check for existing score (unless force=true)
    if (!force) {
      const windowEnd = new Date();
      windowEnd.setUTCHours(0, 0, 0, 0); // Start of current week
      const windowStart = new Date(windowEnd);
      windowStart.setDate(windowStart.getDate() - 28);

      const { data: existingScore } = await serviceClient
        .from('llumos_scores')
        .select('*')
        .eq('org_id', orgId)
        .eq('scope', scope)
        .gte('window_end', windowStart.toISOString())
        .order('window_end', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingScore) {
        console.log('Returning cached score');
        return new Response(
          JSON.stringify({
            score: existingScore.llumos_score,
            composite: existingScore.composite,
            tier: getTier(existingScore.llumos_score),
            submetrics: existingScore.submetrics,
            window: {
              start: existingScore.window_start,
              end: existingScore.window_end,
            },
            cached: true,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Compute score using RPC
    console.log(`Computing score for org ${orgId}, scope ${scope}, prompt ${promptId || 'all'}`);
    
    const { data: result, error: rpcError } = await serviceClient.rpc(
      'compute_llumos_score',
      {
        p_org_id: orgId,
        p_prompt_id: promptId,
      }
    );

    if (rpcError) {
      console.error('RPC error:', rpcError);
      throw new Error(`Score computation failed: ${rpcError.message}`);
    }

    console.log('Score computed:', result);

    // Insert/update the score record
    const { error: insertError } = await serviceClient
      .from('llumos_scores')
      .upsert({
        org_id: orgId,
        prompt_id: promptId,
        scope,
        composite: result.composite,
        llumos_score: result.score,
        submetrics: result.submetrics,
        window_start: result.window.start,
        window_end: result.window.end,
        reason: result.reason,
      }, {
        onConflict: 'org_id,scope,prompt_id,window_start',
      });

    if (insertError) {
      console.error('Insert error:', insertError);
      throw new Error(`Failed to save score: ${insertError.message}`);
    }

    // Return the computed score
    return new Response(
      JSON.stringify({
        score: result.score,
        composite: result.composite,
        tier: result.tier,
        submetrics: result.submetrics,
        window: result.window,
        reason: result.reason,
        totalResponses: result.total_responses,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in compute-llumos-score:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : undefined,
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

function getTier(score: number): string {
  if (score >= 760) return 'Excellent';
  if (score >= 700) return 'Very Good';
  if (score >= 640) return 'Good';
  if (score >= 580) return 'Fair';
  return 'Needs Improvement';
}
