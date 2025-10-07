import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log('🛡️ [GUARDIAN] Starting health check');

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate cron secret
    const providedSecret = req.headers.get('x-cron-secret');
    const { data: secretData } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'cron_secret')
      .single();

    if (!secretData || providedSecret !== secretData.value) {
      console.error('🛡️ [GUARDIAN] Invalid cron secret');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check for recent prompt runs (last 25 hours)
    const cutoffTime = new Date(Date.now() - 25 * 60 * 60 * 1000);
    const { data: recentRuns, error: runsError } = await supabase
      .from('prompt_provider_responses')
      .select('id, run_at')
      .gte('run_at', cutoffTime.toISOString())
      .limit(1);

    if (runsError) {
      console.error('🛡️ [GUARDIAN] Error checking recent runs:', runsError);
      throw runsError;
    }

    const hasRecentRuns = recentRuns && recentRuns.length > 0;
    console.log(`🛡️ [GUARDIAN] Recent runs found: ${hasRecentRuns} (checked since ${cutoffTime.toISOString()})`);

    if (!hasRecentRuns) {
      // NO RECENT RUNS - TRIGGER RECOVERY
      console.log('🚨 [GUARDIAN] ALERT: No prompt runs in last 25 hours - triggering recovery');
      
      const recoveryResult = await supabase.functions.invoke('daily-batch-trigger', {
        body: { 
          force: true, 
          trigger_source: 'guardian_recovery',
          reason: 'No prompt runs detected in last 25 hours'
        },
        headers: { 'x-cron-secret': secretData.value }
      });

      if (recoveryResult.error) {
        console.error('🛡️ [GUARDIAN] Recovery trigger failed:', recoveryResult.error);
        return new Response(JSON.stringify({
          status: 'recovery_failed',
          error: recoveryResult.error,
          duration_ms: Date.now() - startTime
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log('🛡️ [GUARDIAN] Recovery triggered successfully');
      return new Response(JSON.stringify({
        status: 'recovery_triggered',
        reason: 'No runs in last 25 hours',
        recovery_response: recoveryResult.data,
        duration_ms: Date.now() - startTime
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // System is healthy
    console.log('🛡️ [GUARDIAN] System healthy - recent runs detected');
    return new Response(JSON.stringify({
      status: 'healthy',
      recent_runs: recentRuns.length,
      last_run: recentRuns[0]?.run_at,
      duration_ms: Date.now() - startTime
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('🛡️ [GUARDIAN] Fatal error:', error);
    return new Response(JSON.stringify({
      error: error.message,
      duration_ms: Date.now() - startTime
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
