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

    console.log('🔍 Batch reconciler running - checking for stuck jobs...');

    // Find stuck batch jobs (processing for more than 10 minutes or with mismatched counts)
    const { data: stuckJobs } = await supabase
      .from('batch_jobs')
      .select(`
        id, org_id, status, total_tasks, completed_tasks, failed_tasks, started_at,
        created_at
      `)
      .in('status', ['processing', 'pending'])
      .or(`started_at.lt.${new Date(Date.now() - 10 * 60 * 1000).toISOString()},started_at.is.null`)
      .limit(10);

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

    for (const job of stuckJobs) {
      try {
        console.log(`🔧 Reconciling job ${job.id}...`);

        // Use our database function to handle the reconciliation
        const { data: result, error } = await supabase.rpc('resume_stuck_batch_job', {
          p_job_id: job.id
        });

        if (error) {
          console.error(`Failed to reconcile job ${job.id}:`, error);
          continue;
        }

        if (result.action === 'finalized') {
          finalizedJobs++;
          console.log(`✅ Finalized job ${job.id}: ${result.completed_tasks} completed, ${result.failed_tasks} failed`);
        } else if (result.action === 'resumed') {
          resumedJobs++;
          console.log(`🔄 Prepared job ${job.id} for resumption: ${result.pending_tasks} tasks pending`);

          // Optionally trigger the robust-batch-processor to resume the job
          try {
            await supabase.functions.invoke('robust-batch-processor', {
              body: { 
                orgId: job.org_id, 
                resumeJobId: job.id 
              }
            });
            console.log(`📨 Triggered resume for job ${job.id}`);
          } catch (resumeError) {
            console.warn(`Failed to trigger resume for job ${job.id}:`, resumeError);
          }
        }

        reconciledJobs++;

      } catch (jobError) {
        console.error(`Error processing stuck job ${job.id}:`, jobError);
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
      totalStuckFound: stuckJobs.length
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