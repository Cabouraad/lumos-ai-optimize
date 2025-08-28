
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('🔍 Batch reconciler running - aggressive stuck job detection...');

    // Find stuck batch jobs using multiple criteria:
    // 1. Processing/pending for more than 2 minutes with no heartbeat
    // 2. Processing/pending with old heartbeat (>2 minutes)
    // 3. Processing status but all tasks completed/failed
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    
    const { data: stuckJobs } = await supabase
      .from('batch_jobs')
      .select(`
        id, org_id, status, total_tasks, completed_tasks, failed_tasks, 
        started_at, created_at, last_heartbeat, runner_id
      `)
      .in('status', ['processing', 'pending'])
      .or(`last_heartbeat.lt.${twoMinutesAgo},last_heartbeat.is.null,started_at.lt.${twoMinutesAgo}`)
      .limit(20);

    if (!stuckJobs || stuckJobs.length === 0) {
      console.log('✅ No stuck jobs found');
      return new Response(JSON.stringify({
        success: true,
        message: 'No stuck jobs found',
        processedJobs: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`🚨 Found ${stuckJobs.length} potentially stuck jobs`);

    let reconciledJobs = 0;
    let resumedJobs = 0;
    let finalizedJobs = 0;
    const results = [];

    for (const job of stuckJobs) {
      try {
        console.log(`🔧 Reconciling job ${job.id} (status: ${job.status}, heartbeat: ${job.last_heartbeat})`);

        // Use our database function to handle the reconciliation
        const { data: result, error } = await supabase.rpc('resume_stuck_batch_job', {
          p_job_id: job.id
        });

        if (error) {
          console.error(`Failed to reconcile job ${job.id}:`, error);
          results.push({
            jobId: job.id,
            action: 'error',
            error: error.message
          });
          continue;
        }

        if (result.action === 'finalized') {
          finalizedJobs++;
          console.log(`✅ Finalized job ${job.id}: ${result.completed_tasks} completed, ${result.failed_tasks} failed`);
          results.push({
            jobId: job.id,
            action: 'finalized',
            completedTasks: result.completed_tasks,
            failedTasks: result.failed_tasks
          });
        } else if (result.action === 'resumed') {
          resumedJobs++;
          console.log(`🔄 Prepared job ${job.id} for resumption: ${result.pending_tasks} tasks pending`);
          
          // Trigger the robust-batch-processor to resume the job
          try {
            const resumeResponse = await supabase.functions.invoke('robust-batch-processor', {
              body: { 
                orgId: job.org_id, 
                resumeJobId: job.id 
              }
            });
            
            if (resumeResponse.error) {
              console.warn(`Failed to trigger resume for job ${job.id}:`, resumeResponse.error);
            } else {
              console.log(`📨 Successfully triggered resume for job ${job.id}`);
            }
          } catch (resumeError) {
            console.warn(`Exception triggering resume for job ${job.id}:`, resumeError);
          }

          results.push({
            jobId: job.id,
            action: 'resumed',
            pendingTasks: result.pending_tasks,
            completedTasks: result.completed_tasks,
            failedTasks: result.failed_tasks
          });
        }

        reconciledJobs++;

      } catch (jobError) {
        console.error(`Error processing stuck job ${job.id}:`, jobError);
        results.push({
          jobId: job.id,
          action: 'error',
          error: jobError.message
        });
      }
    }

    const message = `Processed ${reconciledJobs} jobs: ${finalizedJobs} finalized, ${resumedJobs} resumed`;
    console.log(`🎯 Reconciliation complete: ${message}`);

    return new Response(JSON.stringify({
      success: true,
      message,
      processedJobs: reconciledJobs,
      finalizedJobs,
      resumedJobs,
      totalStuckFound: stuckJobs.length,
      results
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('💥 Batch reconciler error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
