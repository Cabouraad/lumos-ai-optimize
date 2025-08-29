import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CRON_SECRET = Deno.env.get('CRON_SECRET');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Verify cron secret for security (allows both cron and manual calls)
  const cronSecret = req.headers.get('x-cron-secret');
  const isManualCall = req.headers.get('x-manual-call') === 'true';
  
  if (!isManualCall && (!cronSecret || !CRON_SECRET || cronSecret !== CRON_SECRET)) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized - Invalid cron secret' }), 
      { status: 401, headers: corsHeaders }
    );
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('🔧 Batch reconciler running - detecting and fixing stuck jobs...');

    // AGGRESSIVE: Find stuck batch jobs using multiple criteria:
    // 1. Processing/pending for more than 2 minutes with no recent heartbeat
    // 2. Processing/pending with old heartbeat (>2 minutes ago)
    // 3. Jobs that started but show no progress for 3+ minutes
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    const threeMinutesAgo = new Date(Date.now() - 3 * 60 * 1000).toISOString();
    
    const { data: potentiallyStuckJobs, error: fetchError } = await supabase
      .from('batch_jobs')
      .select(`
        id, org_id, status, total_tasks, completed_tasks, failed_tasks, 
        started_at, created_at, last_heartbeat, runner_id, cancellation_requested
      `)
      .in('status', ['processing', 'pending'])
      .or(`last_heartbeat.lt.${twoMinutesAgo},last_heartbeat.is.null,started_at.lt.${threeMinutesAgo}`)
      .limit(50);

    if (fetchError) {
      console.error('❌ Failed to fetch stuck jobs:', fetchError);
      throw new Error(`Database error: ${fetchError.message}`);
    }

    if (!potentiallyStuckJobs || potentiallyStuckJobs.length === 0) {
      console.log('✅ No stuck jobs detected - system healthy');
      return new Response(JSON.stringify({
        success: true,
        message: 'No stuck jobs found - system healthy',
        processedJobs: 0,
        finalizedJobs: 0,
        resumedJobs: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`🚨 Found ${potentiallyStuckJobs.length} potentially stuck jobs, analyzing...`);

    let processedJobs = 0;
    let resumedJobs = 0;
    let finalizedJobs = 0;
    const results: any[] = [];

    for (const job of potentiallyStuckJobs) {
      try {
        // SMARTER: Determine if job is actually stuck
        const now = Date.now();
        const jobAge = job.started_at ? now - new Date(job.started_at).getTime() : 0;
        const heartbeatAge = job.last_heartbeat ? now - new Date(job.last_heartbeat).getTime() : Infinity;
        
        const isReallyStuck = (
          // No heartbeat for 2+ minutes
          heartbeatAge > 2 * 60 * 1000
        ) || (
          // Started over 3 minutes ago with minimal progress
          jobAge > 3 * 60 * 1000 && (job.completed_tasks + job.failed_tasks) === 0
        );

        if (!isReallyStuck) {
          console.log(`⏭️ Job ${job.id} not stuck (age: ${Math.round(jobAge/1000)}s, heartbeat: ${Math.round(heartbeatAge/1000)}s)`);
          continue;
        }

        console.log(`🔧 Reconciling stuck job ${job.id} (status: ${job.status}, heartbeat age: ${Math.round(heartbeatAge/1000)}s)`);

        // Use the resume function to handle the stuck job
        const { data: resumeResult, error: resumeError } = await supabase.rpc('resume_stuck_batch_job', {
          p_job_id: job.id
        });

        if (resumeError) {
          console.error(`❌ Failed to reconcile job ${job.id}:`, resumeError);
          results.push({
            jobId: job.id,
            action: 'error',
            error: resumeError.message
          });
          continue;
        }

        if (resumeResult?.action === 'finalized') {
          finalizedJobs++;
          console.log(`✅ Finalized job ${job.id}: ${resumeResult.completed_tasks} completed, ${resumeResult.failed_tasks} failed`);
          
          results.push({
            jobId: job.id,
            action: 'finalized',
            completedTasks: resumeResult.completed_tasks,
            failedTasks: resumeResult.failed_tasks
          });
          
        } else if (resumeResult?.action === 'resumed') {
          // SIMPLIFIED: Just prepare for resumption, don't auto-trigger processor
          // This prevents cascade failures and lets UI handle resumption
          resumedJobs++;
          console.log(`🔄 Prepared job ${job.id} for resumption: ${resumeResult.pending_tasks} tasks pending`);
          
          results.push({
            jobId: job.id,
            action: 'resumed',
            pendingTasks: resumeResult.pending_tasks,
            completedTasks: resumeResult.completed_tasks,
            failedTasks: resumeResult.failed_tasks
          });
        }

        processedJobs++;

      } catch (jobError) {
        console.error(`💥 Error processing stuck job ${job.id}:`, jobError);
        results.push({
          jobId: job.id,
          action: 'error',
          error: jobError instanceof Error ? jobError.message : String(jobError)
        });
      }
    }

    const message = processedJobs > 0 
      ? `Reconciled ${processedJobs} stuck jobs: ${finalizedJobs} finalized, ${resumedJobs} ready for resume`
      : 'No stuck jobs needed reconciliation';
      
    console.log(`🎯 Reconciliation complete: ${message}`);

    return new Response(JSON.stringify({
      success: true,
      message,
      processedJobs,
      finalizedJobs,
      resumedJobs,
      totalStuckFound: potentiallyStuckJobs.length,
      results
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('💥 Batch reconciler error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      message: 'Reconciler encountered an error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});