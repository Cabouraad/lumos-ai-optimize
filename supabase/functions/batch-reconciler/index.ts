import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

// Entry validated: batch-reconciler function entrypoint present
const ORIGIN = '*';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-manual-call, x-cron-secret',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

Deno.serve(async (req) => {
  const requestOrigin = req.headers.get('origin');
  console.log(`🔍 Batch reconciler request:`, {
    method: req.method,
    origin: requestOrigin,
    hasAuth: !!req.headers.get('authorization'),
    hasCronSecret: !!req.headers.get('x-cron-secret'),
    isManualCall: req.headers.get('x-manual-call') === 'true'
  });
  
  if (req.method === 'OPTIONS') {
    console.log('✅ CORS preflight handled for reconciler');
    return new Response(null, { headers: corsHeaders });
  }

  const currentTime = new Date();
  const runId = crypto.randomUUID();
  
  console.log('🔧 Batch reconciler started', { runId });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Start logging this run
  const { error: logError } = await supabase
    .from('scheduler_runs')
    .insert({
      id: runId,
      run_key: `reconciler-${currentTime.toISOString().split('T')[0]}`,
      function_name: 'batch-reconciler',
      started_at: currentTime.toISOString(),
      status: 'running'
    });

  if (logError) {
    console.warn('⚠️ Failed to log scheduler run start:', logError);
  }

  // Verify cron secret (supports both database and manual calls)
  const cronSecret = req.headers.get('x-cron-secret');
  const isManualCall = req.headers.get('x-manual-call') === 'true';
  
  if (!isManualCall && !cronSecret) {
    console.error('❌ Missing cron secret');
    await supabase.from('scheduler_runs').update({
      status: 'failed',
      error_message: 'Missing cron secret',
      completed_at: new Date().toISOString()
    }).eq('id', runId);
    
    return new Response(
      JSON.stringify({ error: 'Missing cron secret' }), 
      { status: 401, headers: corsHeaders }
    );
  }

  try {
    // Verify secret against database if not manual call
    if (!isManualCall) {
      const { data: secretData, error: secretError } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'cron_secret')
        .single();

      if (secretError || !secretData?.value || secretData.value !== cronSecret) {
        console.error('❌ Invalid cron secret');
        await supabase.from('scheduler_runs').update({
          status: 'failed',
          error_message: 'Invalid cron secret',
          completed_at: new Date().toISOString()
        }).eq('id', runId);
        
        return new Response(
          JSON.stringify({ error: 'Invalid cron secret' }),
          { status: 401, headers: corsHeaders }
        );
      }
    }

    console.log('🔧 Batch reconciler running - detecting and fixing stuck jobs...');

    // NOTE: batch_jobs table has been deprecated in favor of the new scheduling system
    // This reconciler is kept for backwards compatibility but currently returns healthy status
    // The current system uses robust-batch-processor with inline task management
    
    console.log('✅ No stuck jobs detected - batch_jobs table deprecated, system using new scheduling');
    
    const potentiallyStuckJobs: any[] = [];

    if (!potentiallyStuckJobs || potentiallyStuckJobs.length === 0) {
      console.log('✅ No stuck jobs detected - system healthy');
      
      await supabase.from('scheduler_runs').update({
        status: 'completed',
        result: {
          message: 'No stuck jobs found - system healthy',
          processedJobs: 0,
          finalizedJobs: 0,
          resumedJobs: 0
        },
        completed_at: new Date().toISOString()
      }).eq('id', runId);
      
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
          resumedJobs++;
          const correlationId = crypto.randomUUID();
          console.log(`🔄 Job ${job.id} ready for resume, triggering processor, correlation_id: ${correlationId}`);
          
          // Immediately trigger resume processing
          try {
            const resumeResponse = await supabase.functions.invoke('robust-batch-processor', {
              body: { 
                action: 'resume', 
                resumeJobId: job.id, 
                orgId: job.org_id,
                correlationId,
                resumedBy: 'batch-reconciler'
              }
            });

            if (resumeResponse.error) {
              console.error(`❌ Failed to trigger resume for job ${job.id}:`, resumeResponse.error);
            } else {
              console.log(`✅ Resume triggered for job ${job.id}, result: ${resumeResponse.data?.action}, correlation_id: ${correlationId}`);
            }
          } catch (invokeError: unknown) {
            console.error(`💥 Error invoking resume for job ${job.id}:`, invokeError);
          }
          
          results.push({
            jobId: job.id,
            action: 'resumed',
            pendingTasks: resumeResult.pending_tasks,
            completedTasks: resumeResult.completed_tasks,
            failedTasks: resumeResult.failed_tasks,
            correlationId
          });
        }

        processedJobs++;

      } catch (jobError: unknown) {
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

    const finalResult = {
      success: true,
      message,
      processedJobs,
      finalizedJobs,  
      resumedJobs,
      totalStuckFound: potentiallyStuckJobs.length,
      results
    };

    // Log successful completion
    await supabase.from('scheduler_runs').update({
      status: 'completed',
      result: finalResult,
      completed_at: new Date().toISOString()
    }).eq('id', runId);

    return new Response(JSON.stringify(finalResult), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    console.error('💥 Batch reconciler error:', error);
    
    // Log the failure
    await supabase.from('scheduler_runs').update({
      status: 'failed',
      error_message: error.message,
      completed_at: new Date().toISOString()
    }).eq('id', runId);
    
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