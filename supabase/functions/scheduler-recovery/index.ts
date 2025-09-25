import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('🔄 Starting scheduler recovery process...');

    // Phase 1: Reinstall missing cron jobs
    console.log('📋 Phase 1: Reinstalling cron jobs...');
    const cronSetupResponse = await supabase.functions.invoke('cron-manager', {
      body: {},
      headers: { 
        'x-cron-secret': Deno.env.get('CRON_SECRET') ?? '',
      }
    });

    if (cronSetupResponse.error) {
      console.error('❌ Cron setup failed:', cronSetupResponse.error);
      throw new Error(`Cron setup failed: ${cronSetupResponse.error.message}`);
    }

    console.log('✅ Cron jobs reinstalled successfully');

    // Phase 2: Manual recovery for today
    console.log('🚀 Phase 2: Running manual daily batch trigger...');
    const manualTriggerResponse = await supabase.functions.invoke('daily-batch-trigger', {
      body: { 
        force: true, 
        manual_recovery: true,
        recovery_date: new Date().toISOString().split('T')[0]
      },
      headers: { 
        'x-cron-secret': Deno.env.get('CRON_SECRET') ?? '',
      }
    });

    if (manualTriggerResponse.error) {
      console.error('❌ Manual trigger failed:', manualTriggerResponse.error);
      throw new Error(`Manual trigger failed: ${manualTriggerResponse.error.message}`);
    }

    console.log('✅ Manual batch trigger completed');

    // Phase 3: Verify cron jobs are installed
    console.log('🔍 Phase 3: Verifying cron job installation...');
    const { data: cronJobs, error: cronJobsError } = await supabase.rpc('get_cron_jobs_status');
    
    if (cronJobsError) {
      console.error('❌ Failed to verify cron jobs:', cronJobsError);
    } else {
      const activeDailyJobs = cronJobs.filter((job: any) => 
        job.jobname.includes('daily-batch-trigger') && job.active
      );
      console.log(`✅ Found ${activeDailyJobs.length} active daily batch jobs`);
    }

    const result = {
      success: true,
      phase1_cron_setup: cronSetupResponse.data,
      phase2_manual_trigger: manualTriggerResponse.data,
      phase3_verification: cronJobs || [],
      recovery_timestamp: new Date().toISOString(),
      message: 'Scheduler recovery completed successfully'
    };

    console.log('🎉 Recovery process completed successfully');

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: unknown) {
    console.error('💥 Recovery process failed:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      recovery_timestamp: new Date().toISOString(),
      message: 'Scheduler recovery failed'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});