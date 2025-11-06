import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-manual-trigger',
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

    console.log('🚀 Manual prompt trigger initiated');

    // Validate manual trigger authorization
    const manualTriggerHeader = req.headers.get('x-manual-trigger');
    if (!manualTriggerHeader) {
      throw new Error('Missing x-manual-trigger header');
    }

    // Step 1: Verify cron jobs exist
    console.log('Step 1: Checking cron job status...');
    const { data: cronJobs, error: cronError } = await supabase
      .rpc('get_all_cron_jobs');

    const cronCount = cronJobs?.length || 0;
    console.log(`Found ${cronCount} cron jobs`);

    if (cronCount === 0) {
      console.log('⚠️ No cron jobs found! Triggering recovery...');
      
      const recoveryResponse = await supabase.functions.invoke('scheduler-recovery');
      
      if (recoveryResponse.error) {
        throw new Error(`Recovery failed: ${recoveryResponse.error.message}`);
      }
      
      console.log('✅ Recovery completed');
    }

    // Step 2: Trigger daily batch
    console.log('Step 2: Triggering daily batch...');
    const batchResponse = await supabase.functions.invoke('daily-batch-trigger', {
      body: { 
        force: true,
        manual_trigger: true,
        triggered_by: 'manual-prompt-trigger',
        timestamp: new Date().toISOString()
      },
      headers: {
        'x-cron-secret': Deno.env.get('CRON_SECRET') ?? ''
      }
    });

    if (batchResponse.error) {
      throw new Error(`Batch trigger failed: ${batchResponse.error.message}`);
    }

    console.log('✅ Batch triggered:', batchResponse.data);

    // Step 3: Wait a bit and check results
    console.log('Step 3: Waiting for execution...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Check for new responses
    const { data: recentResponses, error: checkError } = await supabase
      .from('prompt_provider_responses')
      .select('id, run_at, status, provider')
      .order('run_at', { ascending: false })
      .limit(10);

    if (checkError) {
      console.error('Error checking responses:', checkError);
    }

    const result = {
      success: true,
      timestamp: new Date().toISOString(),
      cronJobsRestored: cronCount === 0,
      cronJobCount: cronCount,
      batchTrigger: {
        success: !batchResponse.error,
        data: batchResponse.data
      },
      recentResponses: recentResponses?.length || 0,
      recentResponsesDetail: recentResponses || [],
      message: 'Manual trigger completed successfully'
    };

    console.log('🎉 Manual trigger result:', JSON.stringify(result, null, 2));

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('💥 Manual trigger failed:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
