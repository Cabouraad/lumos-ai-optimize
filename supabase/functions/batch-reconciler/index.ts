import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-manual-call, x-cron-secret, x-correlation-id, x-client-version',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const runId = crypto.randomUUID();
  console.log('🔧 Batch reconciler started', { runId });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  await supabase.from('scheduler_runs').insert({
    id: runId,
    run_key: `reconciler-${new Date().toISOString().split('T')[0]}`,
    function_name: 'batch-reconciler',
    started_at: new Date().toISOString(),
    status: 'running'
  });

  try {
    // Mark old stuck jobs as failed (micro-batch architecture should prevent new stuck jobs)
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    
    const { data: stuckJobs } = await supabase
      .from('batch_jobs')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        metadata: { failed_reason: 'stuck_job_cleanup', cleaned_by: 'reconciler', cleaned_at: new Date().toISOString() }
      })
      .eq('status', 'processing')
      .lt('started_at', tenMinutesAgo)
      .select();

    const cleanedCount = stuckJobs?.length || 0;
    console.log(cleanedCount > 0 ? `🧹 Cleaned ${cleanedCount} stuck jobs` : '✅ No stuck jobs found');

    const result = {
      status: cleanedCount > 0 ? 'cleaned' : 'healthy',
      message: cleanedCount > 0 ? `Cleaned ${cleanedCount} stuck jobs` : 'No stuck jobs',
      cleaned_jobs: cleanedCount
    };

    await supabase.from('scheduler_runs').update({
      status: 'completed',
      result,
      completed_at: new Date().toISOString()
    }).eq('id', runId);

    return new Response(JSON.stringify({ success: true, ...result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('💥 Reconciler error:', error);
    
    await supabase.from('scheduler_runs').update({
      status: 'failed',
      error_message: error.message,
      completed_at: new Date().toISOString()
    }).eq('id', runId);
    
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
