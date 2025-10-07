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
  console.log('💀 [MONITOR] Dead man\'s switch check starting');

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
      console.error('💀 [MONITOR] Invalid cron secret');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check for successful scheduler runs in last 25 hours
    const cutoffTime = new Date(Date.now() - 25 * 60 * 60 * 1000);
    const { data: recentSchedulerRuns, error: schedulerError } = await supabase
      .from('scheduler_runs')
      .select('id, function_name, status, completed_at, trigger_source')
      .eq('function_name', 'daily-batch-trigger')
      .eq('status', 'completed')
      .gte('completed_at', cutoffTime.toISOString())
      .order('completed_at', { ascending: false })
      .limit(1);

    if (schedulerError) {
      console.error('💀 [MONITOR] Error checking scheduler runs:', schedulerError);
      throw schedulerError;
    }

    const hasSuccessfulRun = recentSchedulerRuns && recentSchedulerRuns.length > 0;
    console.log(`💀 [MONITOR] Successful runs found: ${hasSuccessfulRun} (checked since ${cutoffTime.toISOString()})`);

    if (!hasSuccessfulRun) {
      // DEAD MAN'S SWITCH TRIGGERED
      console.log('💀 [MONITOR] ALERT: No successful batch runs in 25h - forcing execution');
      
      const recoveryResult = await supabase.functions.invoke('daily-batch-trigger', {
        body: { 
          force: true, 
          trigger_source: 'monitor_recovery',
          reason: 'Dead man\'s switch - no successful runs in 25 hours'
        },
        headers: { 'x-cron-secret': secretData.value }
      });

      if (recoveryResult.error) {
        console.error('💀 [MONITOR] Recovery trigger failed:', recoveryResult.error);
        return new Response(JSON.stringify({
          status: 'recovery_failed',
          error: recoveryResult.error,
          duration_ms: Date.now() - startTime
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log('💀 [MONITOR] Recovery triggered successfully');
      return new Response(JSON.stringify({
        status: 'recovery_triggered',
        reason: 'Dead man\'s switch activated',
        recovery_response: recoveryResult.data,
        duration_ms: Date.now() - startTime
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // System is healthy
    const lastRun = recentSchedulerRuns[0];
    console.log(`💀 [MONITOR] System healthy - last successful run: ${lastRun.completed_at} (source: ${lastRun.trigger_source})`);
    return new Response(JSON.stringify({
      status: 'healthy',
      last_successful_run: lastRun.completed_at,
      trigger_source: lastRun.trigger_source,
      duration_ms: Date.now() - startTime
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('💀 [MONITOR] Fatal error:', error);
    return new Response(JSON.stringify({
      error: error.message,
      duration_ms: Date.now() - startTime
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
