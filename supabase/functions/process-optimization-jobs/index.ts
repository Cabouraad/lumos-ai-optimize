import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log('🚀 Optimization job processor started');

  try {
    // Authenticate: require either CRON_SECRET or valid JWT
    const cronSecret = req.headers.get('x-cron-secret');
    const authHeader = req.headers.get('authorization');
    const validCronSecret = Deno.env.get('CRON_SECRET');

    if (cronSecret !== validCronSecret && !authHeader) {
      console.error('❌ Authentication failed');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create Supabase client with service role for admin operations
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch up to 5 queued jobs, ordered by creation time (oldest first)
    const { data: jobs, error: fetchError } = await supabase
      .from('optimization_jobs')
      .select('*')
      .eq('status', 'queued')
      .order('created_at', { ascending: true })
      .limit(5);

    if (fetchError) {
      console.error('❌ Failed to fetch jobs:', fetchError);
      throw fetchError;
    }

    if (!jobs || jobs.length === 0) {
      console.log('✅ No queued jobs to process');
      return new Response(JSON.stringify({ 
        success: true, 
        processed: 0,
        message: 'No jobs in queue' 
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`📋 Found ${jobs.length} queued job(s) to process`);

    const results = [];

    // Process each job
    for (const job of jobs) {
      console.log(`🔄 Processing job ${job.id} (scope: ${job.scope})`);

      // Update job status to 'running' atomically
      const { error: updateError } = await supabase
        .from('optimization_jobs')
        .update({ 
          status: 'running',
          started_at: new Date().toISOString()
        })
        .eq('id', job.id)
        .eq('status', 'queued'); // Only update if still queued (prevent race conditions)

      if (updateError) {
        console.error(`❌ Failed to update job ${job.id} to running:`, updateError);
        results.push({ jobId: job.id, success: false, error: 'Failed to claim job' });
        continue;
      }

      try {
        // Prepare request body for generate-optimizations function
        const body: any = {
          scope: job.scope,
          category: 'low_visibility',
          diag: true
        };

        if (job.scope === 'prompt' && job.prompt_ids && job.prompt_ids.length > 0) {
          body.promptId = job.prompt_ids[0]; // Take first prompt ID
        } else if (job.scope === 'org') {
          body.batch = true;
        }

        console.log(`📤 Invoking generate-optimizations for job ${job.id}`, body);

        // Invoke the existing generate-optimizations function (server-to-server)
        const { data: genData, error: genError } = await supabase.functions.invoke(
          'generate-optimizations',
          { body }
        );

        if (genError) {
          throw genError;
        }

        console.log(`✅ Job ${job.id} completed successfully`);

        // Mark job as done
        await supabase
          .from('optimization_jobs')
          .update({ 
            status: 'done',
            finished_at: new Date().toISOString()
          })
          .eq('id', job.id);

        results.push({ 
          jobId: job.id, 
          success: true,
          result: genData 
        });

      } catch (error: any) {
        console.error(`❌ Job ${job.id} failed:`, error);

        // Mark job as failed with error message
        await supabase
          .from('optimization_jobs')
          .update({ 
            status: 'failed',
            finished_at: new Date().toISOString(),
            error_text: error.message || String(error)
          })
          .eq('id', job.id);

        results.push({ 
          jobId: job.id, 
          success: false, 
          error: error.message || String(error) 
        });
      }
    }

    const duration = Date.now() - startTime;
    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    console.log(`✅ Processor complete: ${successCount} succeeded, ${failCount} failed (${duration}ms)`);

    return new Response(JSON.stringify({
      success: true,
      processed: jobs.length,
      succeeded: successCount,
      failed: failCount,
      duration,
      results
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('💥 Fatal error in processor:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Internal server error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
