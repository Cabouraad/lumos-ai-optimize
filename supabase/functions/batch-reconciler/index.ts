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
    const HEARTBEAT_STALE_MS = 15 * 60 * 1000;  // 15 minutes
    const STARTED_AT_STALE_MS = 20 * 60 * 1000; // 20 minutes
    const HEARTBEAT_FRESH_MS = 5 * 60 * 1000;   // 5 minutes
    
    // Fetch all processing jobs
    const { data: processingJobs, error: fetchError } = await supabase
      .from('batch_jobs')
      .select('id, org_id, started_at, total_tasks, completed_tasks, failed_tasks, metadata, status')
      .eq('status', 'processing');

    if (fetchError) throw fetchError;

    let processedJobs = 0;
    let finalizedJobs = 0;
    let failedJobs = 0;
    let skippedJobs = 0;

    for (const job of processingJobs || []) {
      const lastHeartbeat = job.metadata?.last_heartbeat;
      const lastKnownProgress = job.metadata?.last_known_progress || 0;
      const currentProgress = (job.completed_tasks || 0) + (job.failed_tasks || 0);
      const now = Date.now();
      
      // Check if making progress
      const isProgressing = currentProgress > lastKnownProgress;
      
      if (isProgressing) {
        console.log(`✅ Job ${job.id} is making progress (${lastKnownProgress} → ${currentProgress})`);
        await supabase
          .from('batch_jobs')
          .update({
            metadata: { 
              ...job.metadata,
              last_known_progress: currentProgress 
            }
          })
          .eq('id', job.id);
        skippedJobs++;
        continue;
      }
      
      // Check if heartbeat is fresh
      if (lastHeartbeat) {
        const heartbeatTime = new Date(lastHeartbeat).getTime();
        if (now - heartbeatTime < HEARTBEAT_FRESH_MS) {
          console.log(`✅ Job ${job.id} is healthy (heartbeat ${Math.round((now - heartbeatTime) / 1000)}s ago)`);
          skippedJobs++;
          continue;
        }
      }

      // Check if job is complete (all tasks done)
      const totalDone = (job.completed_tasks || 0) + (job.failed_tasks || 0);
      if (totalDone >= (job.total_tasks || 0) && job.total_tasks > 0) {
        console.log(`✅ Finalizing completed job ${job.id} (${totalDone}/${job.total_tasks} tasks)`);
        await supabase
          .from('batch_jobs')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString()
          })
          .eq('id', job.id);
        finalizedJobs++;
        processedJobs++;
        continue;
      }

      // Only fail if: no progress + stale heartbeat/old start time
      let isStuck = false;
      let reason = '';

      if (lastHeartbeat) {
        const heartbeatTime = new Date(lastHeartbeat).getTime();
        if (now - heartbeatTime > HEARTBEAT_STALE_MS) {
          isStuck = true;
          reason = `stale_heartbeat (${Math.round((now - heartbeatTime) / 60000)} min ago, no progress)`;
        }
      } else if (job.started_at) {
        const startTime = new Date(job.started_at).getTime();
        if (now - startTime > STARTED_AT_STALE_MS) {
          isStuck = true;
          reason = `no_heartbeat_old_start (${Math.round((now - startTime) / 60000)} min ago)`;
        }
      }

      if (isStuck) {
        console.log(`❌ Failing stuck job ${job.id}: ${reason}`);
        await supabase
          .from('batch_jobs')
          .update({
            status: 'failed',
            completed_at: new Date().toISOString(),
            metadata: { 
              ...job.metadata,
              failed_reason: reason,
              cleaned_by: 'reconciler', 
              cleaned_at: new Date().toISOString(),
              resumable: true
            }
          })
          .eq('id', job.id);
        failedJobs++;
        processedJobs++;
      } else {
        console.log(`⏳ Job ${job.id} is slow but not stuck yet`);
        skippedJobs++;
      }
    }

    const result = {
      success: true,
      status: processedJobs > 0 ? 'cleaned' : 'healthy',
      message: processedJobs > 0 
        ? `Processed ${processedJobs} jobs (${finalizedJobs} finalized, ${failedJobs} failed)` 
        : 'No stuck jobs found',
      processedJobs,
      finalizedJobs,
      resumedJobs: 0,
      failedJobs,
      skippedJobs
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
