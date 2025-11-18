import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
}

interface CronJob {
  jobid: number;
  jobname: string;
  schedule: string;
  active: boolean;
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

    console.log('🔍 Starting cron health check...');

    // Get all cron jobs
    const { data: cronJobs, error: cronError } = await supabase
      .rpc('get_all_cron_jobs') as { data: CronJob[] | null; error: any };

    if (cronError) {
      console.error('❌ Error fetching cron jobs:', cronError);
      throw new Error(`Failed to fetch cron jobs: ${cronError.message}`);
    }

    const jobCount = cronJobs?.length || 0;
    console.log(`📊 Found ${jobCount} cron jobs`);

    // Expected jobs
    const expectedJobs = [
      'daily-batch-trigger-resilient',
      'batch-reconciler-cleanup'
    ];

    const missingJobs: string[] = [];
    const foundJobs: string[] = [];

    for (const expectedJob of expectedJobs) {
      const exists = cronJobs?.some(job => job.jobname.includes(expectedJob.split('-')[0]));
      if (exists) {
        foundJobs.push(expectedJob);
      } else {
        missingJobs.push(expectedJob);
      }
    }

    // Check for recent prompt executions
    const { data: recentResponses, error: responsesError } = await supabase
      .from('prompt_provider_responses')
      .select('run_at')
      .order('run_at', { ascending: false })
      .limit(1);

    if (responsesError) {
      console.error('❌ Error checking recent responses:', responsesError);
    }

    const lastExecutionAt = recentResponses?.[0]?.run_at;
    const hoursSinceLastExecution = lastExecutionAt 
      ? (Date.now() - new Date(lastExecutionAt).getTime()) / (1000 * 60 * 60)
      : null;

    const needsRecovery = missingJobs.length > 0 || (hoursSinceLastExecution && hoursSinceLastExecution > 30);

    const status = {
      healthy: !needsRecovery,
      timestamp: new Date().toISOString(),
      cronJobs: {
        total: jobCount,
        expected: expectedJobs.length,
        found: foundJobs,
        missing: missingJobs,
        details: cronJobs || []
      },
      promptExecution: {
        lastExecutionAt,
        hoursSinceLastExecution,
        stale: hoursSinceLastExecution && hoursSinceLastExecution > 30
      },
      recommendations: [] as string[]
    };

    if (missingJobs.length > 0) {
      status.recommendations.push(`⚠️ Missing cron jobs: ${missingJobs.join(', ')}. Run scheduler recovery immediately.`);
    }

    if (hoursSinceLastExecution && hoursSinceLastExecution > 30) {
      status.recommendations.push(`⚠️ No prompt executions in ${hoursSinceLastExecution.toFixed(1)} hours. System may be stuck.`);
    }

    if (jobCount === 0) {
      status.recommendations.push('🚨 CRITICAL: No cron jobs exist! All scheduling has stopped. Immediate recovery required.');
      
      // Auto-trigger recovery if completely broken
      console.log('🚨 Attempting automatic recovery...');
      try {
        const recoveryResponse = await supabase.functions.invoke('scheduler-recovery', {
          headers: { 'x-cron-secret': Deno.env.get('CRON_SECRET') ?? '' }
        });
        
        if (recoveryResponse.error) {
          status.recommendations.push(`❌ Auto-recovery failed: ${recoveryResponse.error.message}`);
        } else {
          status.recommendations.push('✅ Auto-recovery triggered successfully');
        }
      } catch (recoveryError: any) {
        status.recommendations.push(`❌ Auto-recovery error: ${recoveryError.message}`);
      }
    }

    const logLevel = needsRecovery ? '🚨 CRITICAL' : '✅ HEALTHY';
    console.log(`${logLevel} Health check complete:`, JSON.stringify(status, null, 2));

    return new Response(JSON.stringify(status), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: needsRecovery ? 500 : 200,
    });

  } catch (error: any) {
    console.error('💥 Health check failed:', error);
    
    return new Response(JSON.stringify({
      healthy: false,
      error: error.message,
      timestamp: new Date().toISOString(),
      recommendations: ['🚨 Health check itself failed. Manual intervention required.']
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
