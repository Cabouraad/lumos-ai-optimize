import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-manual-call, x-cron-secret',
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
    // Check for stuck jobs (no heartbeat for 2+ minutes)
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    
    const { data: stuckJobs } = await supabase
      .from('batch_jobs')
      .select('*')
      .eq('status', 'processing')
      .or(`metadata->last_heartbeat.lt.${twoMinutesAgo},metadata->last_heartbeat.is.null`)
      .order('started_at', { ascending: true })
      .limit(10);

    let processedJobs = 0, finalizedJobs = 0, resumedJobs = 0, errorJobs = 0;
    const reconciliationActions = [];

    if (!stuckJobs || stuckJobs.length === 0) {
      console.log('✅ No stuck jobs detected - system healthy');
    } else {
      console.log(`🔧 Found ${stuckJobs.length} stuck jobs`);

      for (const job of stuckJobs) {
        processedJobs++;
        const isComplete = (job.completed_tasks + job.failed_tasks) >= job.total_tasks;

        if (isComplete) {
          // Finalize completed job
          await supabase.from('batch_jobs').update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            metadata: { ...(job.metadata || {}), reconciled_by: 'batch-reconciler', reconciled_at: new Date().toISOString() }
          }).eq('id', job.id);

          finalizedJobs++;
          reconciliationActions.push({ job_id: job.id, action: 'finalized', completed_tasks: job.completed_tasks });
        } else {
          // Resume incomplete job
          const resumeResponse = await supabase.functions.invoke('robust-batch-processor', {
            body: { action: 'resume', resumeJobId: job.id, orgId: job.org_id, correlationId: runId }
          });

          if (resumeResponse.error) {
            errorJobs++;
            reconciliationActions.push({ job_id: job.id, action: 'resume_failed', error: resumeResponse.error.message });
          } else {
            resumedJobs++;
            reconciliationActions.push({ job_id: job.id, action: 'resumed', response: resumeResponse.data });
          }
        }
      }
    }

    const result = {
      status: stuckJobs && stuckJobs.length > 0 ? 'reconciled' : 'healthy',
      message: stuckJobs && stuckJobs.length > 0 
        ? `Processed ${processedJobs} stuck jobs: ${finalizedJobs} finalized, ${resumedJobs} resumed, ${errorJobs} errors`
        : 'No stuck jobs detected',
      stuck_jobs_found: stuckJobs?.length || 0,
      processed: processedJobs,
      finalized: finalizedJobs,
      resumed: resumedJobs,
      errors: errorJobs,
      actions_taken: reconciliationActions
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
