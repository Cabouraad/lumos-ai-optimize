
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

    console.log('🔧 Batch reconciler running - detecting and fixing stuck jobs...');

    // Find stuck batch jobs using aggressive criteria:
    // 1. Processing/pending for more than 2 minutes with no recent heartbeat
    // 2. Processing/pending with old heartbeat (>2 minutes ago)
    // 3. Processing status but appears complete based on task counts
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    
    const { data: potentiallyStuckJobs } = await supabase
      .from('batch_jobs')
      .select(`
        id, org_id, status, total_tasks, completed_tasks, failed_tasks, 
        started_at, created_at, last_heartbeat, runner_id, cancellation_requested
      `)
      .in('status', ['processing', 'pending'])
      .or(`last_heartbeat.lt.${twoMinutesAgo},last_heartbeat.is.null,started_at.lt.${twoMinutesAgo}`)
      .limit(50);

    if (!potentiallyStuckJobs || potentiallyStuckJobs.length === 0) {
      console.log('✅ No stuck jobs detected');
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
        const isReallyStuck = (
          // No heartbeat for 2+ minutes
          !job.last_heartbeat || new Date(job.last_heartbeat) < new Date(twoMinutesAgo)
        ) || (
          // Started over 2 minutes ago with no progress
          job.started_at && new Date(job.started_at) < new Date(twoMinutesAgo)
        );

        if (!isReallyStuck) {
          console.log(`⏭️ Skipping job ${job.id} - not actually stuck`);
          continue;
        }

        console.log(`🔧 Reconciling stuck job ${job.id} (status: ${job.status}, last heartbeat: ${job.last_heartbeat || 'never'})`);

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
            failedTasks: resumeResult.failed_tasks,
            message: 'Job was complete, marked as finalized'
          });
          
        } else if (resumeResult?.action === 'resumed') {
          resumedJobs++;
          console.log(`🔄 Prepared job ${job.id} for resumption: ${resumeResult.pending_tasks} tasks pending`);
          
          // Trigger the robust-batch-processor to actually resume processing
          try {
            const resumeResponse = await supabase.functions.invoke('robust-batch-processor', {
              body: { 
                orgId: job.org_id, 
                resumeJobId: job.id 
              }
            });
            
            if (resumeResponse.error) {
              console.warn(`⚠️ Failed to trigger resume for job ${job.id}:`, resumeResponse.error);
              results.push({
                jobId: job.id,
                action: 'prepared_for_resume',
                pendingTasks: resumeResult.pending_tasks,
                warning: 'Job prepared but auto-resume failed - manual trigger needed'
              });
            } else {
              console.log(`📨 Successfully triggered resume for job ${job.id}`);
              results.push({
                jobId: job.id,
                action: 'resumed_successfully',
                pendingTasks: resumeResult.pending_tasks,
                message: 'Job resumed and processing restarted'
              });
            }
          } catch (resumeError) {
            console.warn(`⚠️ Exception triggering resume for job ${job.id}:`, resumeError);
            results.push({
              jobId: job.id,
              action: 'prepared_for_resume',
              pendingTasks: resumeResult.pending_tasks,
              warning: 'Job prepared but auto-resume failed - manual trigger needed'
            });
          }
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
      ? `Processed ${processedJobs} stuck jobs: ${finalizedJobs} finalized, ${resumedJobs} resumed`
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
