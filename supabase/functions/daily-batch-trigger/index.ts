import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';
import { getStrictCorsHeaders } from "../_shared/cors.ts";

// Helper logging function  
const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[DAILY-BATCH] ${step}${detailsStr}`);
};

// Timezone-aware date utility functions
function nyParts(d = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  
  const parts = formatter.formatToParts(d);
  const yyyy = parts.find((part: any) => part.type === 'year')?.value || '1970';
  const mm = parts.find((part: any) => part.type === 'month')?.value || '01';
  const dd = parts.find((part: any) => part.type === 'day')?.value || '01';
  const hh = parts.find((part: any) => part.type === 'hour')?.value || '00';
  const mi = parts.find((part: any) => part.type === 'minute')?.value || '00';
  const ss = parts.find((part: any) => part.type === 'second')?.value || '00';
  
  return { yyyy, mm, dd, hh, mi, ss };
}

function todayKeyNY(d = new Date()): string {
  const { yyyy, mm, dd } = nyParts(d);
  return `${yyyy}-${mm}-${dd}`;
}

function isInExecutionWindow(d = new Date()): boolean {
  const { hh } = nyParts(d);
  const hour = Number(hh);
  // Allow execution window: 3:00 AM - 6:00 AM ET
  return hour >= 3 && hour < 6;
}

Deno.serve(async (req) => {
  const requestOrigin = req.headers.get('Origin');
  const corsHeaders = getStrictCorsHeaders(requestOrigin);
  
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const currentTime = new Date();
  const todayKey = todayKeyNY(currentTime);
  const runId = crypto.randomUUID();
  
  // Parse request body early to get trigger_source
  let requestBody: any = {};
  let triggerSource = 'manual_unknown';
  try {
    const body = await req.text();
    if (body) {
      requestBody = JSON.parse(body);
      triggerSource = requestBody.trigger_source || 'manual_unknown';
    }
  } catch (e: unknown) {
    // Not JSON or empty body, use default trigger_source
  }
  
  console.log('🚀 Daily batch trigger started', { runId, todayKey, triggerSource });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Start logging this run with trigger_source
  const { error: logError } = await supabase
    .from('scheduler_runs')
    .insert({
      id: runId,
      run_key: todayKey,
      function_name: 'daily-batch-trigger',
      trigger_source: triggerSource,
      started_at: currentTime.toISOString(),
      status: 'running'
    });

  if (logError) {
    console.warn('⚠️ Failed to log scheduler run start:', logError);
  }

  // Verify cron secret
  const cronSecret = req.headers.get('x-cron-secret');
  
  if (!cronSecret) {
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
    // Verify secret against database
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

    // Check execution window (3:00 AM - 6:00 AM ET) unless force flag is set
    // (requestBody already parsed above)
    const inWindow = isInExecutionWindow(currentTime);
    const forceRun = requestBody.force === true;
    
    if (!inWindow && !forceRun) {
      console.log('⏰ Outside execution window, skipping run');
      await supabase.from('scheduler_runs').update({
        status: 'completed',
        result: { message: 'Outside execution window' },
        completed_at: new Date().toISOString()
      }).eq('id', runId);
      
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'Outside execution window (3:00 AM - 6:00 AM ET). Use {"force": true} to bypass.' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    if (forceRun) {
      console.log('🚀 Force flag detected - bypassing execution window');
    } else {
      console.log('✅ Within execution window');
    }

    // FIRST: Check if already ran today WITHOUT marking (read-only check)
    const { data: currentState, error: stateError } = await supabase
      .from('scheduler_state')
      .select('last_daily_run_key, last_daily_run_at')
      .eq('id', 'global')
      .single();

    if (stateError && stateError.code !== 'PGRST116') {
      console.error('Error checking scheduler state:', stateError);
      await supabase.from('scheduler_runs').update({
        status: 'failed',
        error_message: `Failed to check scheduler state: ${stateError.message}`,
        completed_at: new Date().toISOString()
      }).eq('id', runId);
      throw stateError;
    }

    // If already ran today, skip (unless force flag is set)
    if (currentState?.last_daily_run_key === todayKey && !requestBody.force) {
      console.log(`Daily batch already ran for ${todayKey} (at: ${currentState.last_daily_run_at})`);
      
      await supabase.from('scheduler_runs').update({
        status: 'completed',
        result: { 
          message: 'Daily batch already completed today',
          date: todayKey,
          previousRun: currentState.last_daily_run_key,
          previousRunAt: currentState.last_daily_run_at,
          skipped: true,
          currentTime: currentTime.toISOString()
        },
        completed_at: new Date().toISOString()
      }).eq('id', runId);
      
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Daily batch already completed today',
        date: todayKey,
        previousRun: currentState.last_daily_run_key,
        previousRunAt: currentState.last_daily_run_at,
        skipped: true,
        currentTime: currentTime.toISOString()
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Starting daily batch trigger for ${todayKey} at ${currentTime.toISOString()}`);

    // Get all organizations with active prompts
    const { data: orgs, error: orgsError } = await supabase
      .from('organizations')
      .select(`
        id,
        name,
        prompts!inner(id)
      `)
      .eq('prompts.active', true);

    if (orgsError) {
      console.error('❌ Failed to fetch organizations:', orgsError);
      await supabase.from('scheduler_runs').update({
        status: 'failed',
        error_message: `Failed to fetch organizations: ${orgsError.message}`,
        completed_at: new Date().toISOString()
      }).eq('id', runId);
      throw orgsError;
    }

    if (!orgs || orgs.length === 0) {
      console.log('No organizations with active prompts found');
      
      await supabase.from('scheduler_runs').update({
        status: 'completed',
        result: { 
          message: 'No organizations to process',
          date: todayKey,
          currentTime: currentTime.toISOString(),
          totalOrgs: 0
        },
        completed_at: new Date().toISOString()
      }).eq('id', runId);
      
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No organizations to process',
        date: todayKey,
        currentTime: currentTime.toISOString()
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let totalBatchJobs = 0;
    let successfulJobs = 0;
    const orgResults: any[] = [];
    
    // Background driver function to complete batch jobs
    const driveJobToCompletion = async (jobId: string, orgId: string, orgName: string, cronSecret: string) => {
      const maxWallTimeMs = 20 * 60 * 1000; // 20 minutes max per org
      const startTime = Date.now();
      let iteration = 0;
      let lastProgress = 0;
      let zeroProgressCount = 0;
      
      console.log(`🔄 [Driver] Starting background driver for job ${jobId} (org: ${orgName})`);
      
      try {
        while (Date.now() - startTime < maxWallTimeMs) {
          iteration++;
          
          const driverResult = await supabase.functions.invoke('robust-batch-processor', {
            body: { 
              jobId,
              orgId,
              source: 'scheduler-driver'
            },
            headers: { 'x-cron-secret': cronSecret }
          });
          
          if (driverResult.error) {
            console.error(`🔄 [Driver] Iteration ${iteration} error for job ${jobId}:`, driverResult.error);
            break;
          }
          
          const driverData = driverResult.data;
          const currentProgress = driverData?.completed || 0;
          
          console.log(`🔄 [Driver] Iteration ${iteration} for job ${jobId}: action=${driverData?.action}, progress=${currentProgress}/${driverData?.total}`);
          
          if (driverData?.action === 'completed') {
            console.log(`✅ [Driver] Job ${jobId} completed after ${iteration} iterations (${Date.now() - startTime}ms)`);
            break;
          }
          
          // Detect stalled jobs
          if (currentProgress === lastProgress) {
            zeroProgressCount++;
            if (zeroProgressCount >= 5) {
              console.warn(`⚠️ [Driver] Job ${jobId} stalled (no progress in 5 iterations)`);
              break;
            }
          } else {
            zeroProgressCount = 0;
            lastProgress = currentProgress;
          }
          
          // Wait before next iteration
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          if (iteration > 100) {
            console.warn(`⚠️ [Driver] Job ${jobId} exceeded max iterations (100)`);
            break;
          }
        }
      } catch (driverError: unknown) {
        console.error(`🔄 [Driver] Fatal error for job ${jobId}:`, driverError);
      }
      
      console.log(`🔄 [Driver] Exiting for job ${jobId} after ${iteration} iterations, runtime: ${Date.now() - startTime}ms`);
    };

    // Helper function to call batch processor with timeout
    const invokeBatchProcessorWithTimeout = async (orgId: string, cronSecret: string, attempt: number) => {
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Batch processor invocation timed out after 30 seconds'));
        }, 30000);

        supabase.functions.invoke('robust-batch-processor', {
          body: { 
            action: 'create',
            orgId, 
            source: 'daily-batch-trigger',
            attempt,
            replace: false
          },
          headers: { 'x-cron-secret': cronSecret }
        }).then(result => {
          clearTimeout(timeout);
          resolve(result);
        }).catch((error: unknown) => {
          clearTimeout(timeout);
          reject(error);
        });
      });
    };

    // Trigger batch processor for each org
    for (const org of orgs) {
      try {
        console.log(`Triggering batch processor for org ${org.id} (${org.name})`);
        
        let batchSuccess = false;
        let attempts = 0;
        let data: any = null;
        const maxAttempts = 2;
        
        while (!batchSuccess && attempts < maxAttempts) {
          attempts++;
          
          try {
            const batchResult = await invokeBatchProcessorWithTimeout(org.id, cronSecret!, attempts);

            if (batchResult.error) {
              console.error(`Attempt ${attempts} failed for org ${org.id}:`, batchResult.error);
              if (attempts < maxAttempts) {
                console.log(`Retrying in 5 seconds...`);
                await new Promise(resolve => setTimeout(resolve, 5000));
                continue;
              }
              throw batchResult.error;
            }
            
            data = batchResult.data;
            
            // Extract jobId for driver loop (support both field names)
            const jobId = data?.jobId || data?.batchJobId;
            
            if (jobId) {
              // Start background driver to complete the job
              console.log(`🔄 Starting background driver for job ${jobId} (org: ${org.name})`);
              EdgeRuntime.waitUntil(driveJobToCompletion(jobId, org.id, org.name, cronSecret!));
            } else {
              console.warn(`⚠️ No jobId returned for org ${org.name}, skipping driver`);
            }
            
            batchSuccess = true;
            console.log(`✅ Batch processor invoked successfully for org ${org.id}, result: ${data?.action}`);
          } catch (err: unknown) {
            console.error(`Attempt ${attempts} exception for org ${org.id}:`, err);
            if (attempts >= maxAttempts) {
              console.error(`❌ All attempts failed for org ${org.id}`);
            }
          }
        }
        
        // Update results based on success - accept created/in_progress/completed as success
        const isActualSuccess = batchSuccess && 
          (data?.action === 'created' || data?.action === 'in_progress' || data?.action === 'completed');
        
        const isFailure = data?.action && [
          'job_update_failed', 
          'configuration_missing', 
          'no_valid_providers', 
          'prompt_fetch_failed', 
          'error'
        ].includes(data.action);
        
        if (isActualSuccess && !isFailure) {
          successfulJobs++;
          orgResults.push({
            orgId: org.id,
            orgName: org.name,
            success: true,
            attempts: attempts,
            batchJobId: data?.jobId || data?.batchJobId,
            action: data?.action,
            driverStarted: true
          });
        } else {
          orgResults.push({
            orgId: org.id,
            orgName: org.name,
            success: false,
            attempts: attempts,
            error: isFailure ? `Job failed with action: ${data?.action}` : 'All retry attempts failed',
            action: data?.action
          });
        }
        
        totalBatchJobs++;

        // Small delay to avoid overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (orgError: unknown) {
        console.error(`Error processing org ${org.id}:`, orgError);
        totalBatchJobs++;
        orgResults.push({
          orgId: org.id,
          orgName: org.name,
          success: false,
          error: orgError instanceof Error ? orgError.message : String(orgError)
        });
      }
    }

    // ONLY mark daily run as completed AFTER all organizations are processed successfully
    let runCheck = null;
    if (successfulJobs === totalBatchJobs) {
      // All organizations processed successfully - mark day as completed
      const { data: markResult, error: markError } = await supabase
        .rpc('try_mark_daily_run', { p_today_key: todayKey });

      if (markError) {
        console.error('Failed to mark daily run after successful processing:', markError);
        // Continue anyway - organizations were processed successfully
      } else {
        runCheck = markResult;
        console.log('✅ Daily run marked as completed after successful processing');
      }
    } else {
      // Partial failure - do NOT mark the day as completed to allow retry
      console.warn(`⚠️ Partial failure: ${successfulJobs}/${totalBatchJobs} organizations processed successfully`);
      console.warn('Day NOT marked as completed - allowing future retry attempts');
    }

    const isFullSuccess = successfulJobs === totalBatchJobs;
    const result = {
      success: isFullSuccess,
      date: todayKey,
      currentTime: currentTime.toISOString(),
      totalOrgs: totalBatchJobs,
      successfulJobs,
      failedJobs: totalBatchJobs - successfulJobs,
      message: isFullSuccess 
        ? `Successfully triggered batch processing for all ${successfulJobs} organizations` 
        : `Partial success: ${successfulJobs}/${totalBatchJobs} organizations processed`,
      orgResults,
      runCheck,
      dayMarkedCompleted: !!runCheck,
      coverage: {
        percent: totalBatchJobs > 0 ? Math.round((successfulJobs / totalBatchJobs) * 100) : 100,
        successful: successfulJobs,
        total: totalBatchJobs
      }
    };

    console.log(`Daily batch trigger ${isFullSuccess ? 'completed successfully' : 'completed with partial failures'}:`, result);

    // Log completion with appropriate status
    await supabase.from('scheduler_runs').update({
      status: isFullSuccess ? 'completed' : 'failed_partial',
      result: result,
      completed_at: new Date().toISOString()
    }).eq('id', runId);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Daily batch trigger error:', error);
    
    // Log the failure with enhanced context
    await supabase.from('scheduler_runs').update({
      status: 'failed',
      error_message: error.message || 'Unknown error',
      result: {
        success: false,
        error: error.message || 'Unknown error',
        date: todayKey,
        currentTime: currentTime.toISOString(),
        context: 'Exception in main execution loop',
        dayMarkedCompleted: false
      },
      completed_at: new Date().toISOString()
    }).eq('id', runId);
    
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message || 'Unknown error',
      date: todayKey,
      currentTime: currentTime.toISOString(),
      context: 'Exception in main execution loop'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});