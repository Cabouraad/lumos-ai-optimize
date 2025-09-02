import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ORIGIN = '*';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
  const yyyy = parts.find(part => part.type === 'year')?.value || '1970';
  const mm = parts.find(part => part.type === 'month')?.value || '01';
  const dd = parts.find(part => part.type === 'day')?.value || '01';
  const hh = parts.find(part => part.type === 'hour')?.value || '00';
  const mi = parts.find(part => part.type === 'minute')?.value || '00';
  const ss = parts.find(part => part.type === 'second')?.value || '00';
  
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

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const currentTime = new Date();
  const todayKey = todayKeyNY(currentTime);
  const runId = crypto.randomUUID();
  
  console.log('🚀 Daily batch trigger started', { runId, todayKey });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Start logging this run
  const { error: logError } = await supabase
    .from('scheduler_runs')
    .insert({
      id: runId,
      run_key: todayKey,
      function_name: 'daily-batch-trigger',
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

    // Check for bypass flag
    let requestBody = {};
    try {
      const body = await req.text();
      if (body) {
        requestBody = JSON.parse(body);
      }
    } catch (e) {
      // Not JSON or empty body, continue
    }

    // Check execution window (3:00 AM - 6:00 AM ET) unless force flag is set
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

    // Use the standardized RPC function for duplicate prevention
    const { data: runCheck, error: runCheckError } = await supabase
      .rpc('try_mark_daily_run', { p_today_key: todayKey });

    if (runCheckError) {
      console.error('Error checking/updating scheduler state:', runCheckError);
      await supabase.from('scheduler_runs').update({
        status: 'failed',
        error_message: `Failed to mark daily run: ${runCheckError.message}`,
        completed_at: new Date().toISOString()
      }).eq('id', runId);
      throw runCheckError;
    }

    console.log('Daily run check result:', runCheck);

    // If we didn't update (already ran today), skip
    if (!runCheck.updated) {
      console.log(`Daily batch already ran for ${todayKey} (previous: ${runCheck.previous_key})`);
      
      await supabase.from('scheduler_runs').update({
        status: 'completed',
        result: { 
          message: 'Daily batch already completed today',
          date: todayKey,
          previousRun: runCheck.previous_key,
          skipped: true,
          currentTime: currentTime.toISOString()
        },
        completed_at: new Date().toISOString()
      }).eq('id', runId);
      
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Daily batch already completed today',
        date: todayKey,
        previousRun: runCheck.previous_key,
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

    // Trigger batch processor for each org
    for (const org of orgs) {
      try {
        console.log(`Triggering batch processor for org ${org.id} (${org.name})`);
        
        let batchSuccess = false;
        let attempts = 0;
        const maxAttempts = 2;
        
        while (!batchSuccess && attempts < maxAttempts) {
          attempts++;
          
          try {
            const { data, error } = await supabase.functions.invoke('robust-batch-processor', {
              body: { 
                orgId: org.id, 
                source: 'daily-batch-trigger',
                attempt: attempts
              },
              headers: { 'x-cron-secret': cronSecret! }
            });

            if (error) {
              console.error(`Attempt ${attempts} failed for org ${org.id}:`, error);
              if (attempts < maxAttempts) {
                console.log(`Retrying in 30 seconds...`);
                await new Promise(resolve => setTimeout(resolve, 30000));
                continue;
              }
              throw error;
            }
            
            batchSuccess = true;
            console.log(`✅ Batch processor started successfully for org ${org.id}`);
          } catch (err) {
            console.error(`Attempt ${attempts} exception for org ${org.id}:`, err);
            if (attempts >= maxAttempts) {
              console.error(`❌ All attempts failed for org ${org.id}`);
            }
          }
        }
        
        // Update results based on success
        if (batchSuccess) {
          successfulJobs++;
          orgResults.push({
            orgId: org.id,
            orgName: org.name,
            success: true,
            attempts: attempts
          });
        } else {
          orgResults.push({
            orgId: org.id,
            orgName: org.name,
            success: false,
            attempts: attempts,
            error: 'All retry attempts failed'
          });
        }
        
        totalBatchJobs++;

        // Small delay to avoid overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (orgError) {
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

    const result = {
      success: true,
      date: todayKey,
      currentTime: currentTime.toISOString(),
      totalOrgs: totalBatchJobs,
      successfulJobs,
      message: `Triggered batch processing for ${successfulJobs}/${totalBatchJobs} organizations`,
      orgResults,
      runCheck
    };

    console.log(`Daily batch trigger completed:`, result);

    // Log successful completion
    await supabase.from('scheduler_runs').update({
      status: 'completed',
      result: result,
      completed_at: new Date().toISOString()
    }).eq('id', runId);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Daily batch trigger error:', error);
    
    // Log the failure
    await supabase.from('scheduler_runs').update({
      status: 'failed',
      error_message: error.message,
      completed_at: new Date().toISOString()
    }).eq('id', runId);
    
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message,
      date: todayKey,
      currentTime: currentTime.toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});