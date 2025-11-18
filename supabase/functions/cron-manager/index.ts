import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret, x-admin-key',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

// Fixed cron job configurations - aligned with execution window and reduced frequency
const CRON_JOBS = [
  {
    jobname: 'daily-batch-trigger-est',
    schedule: '5 8 * * *', // 8:05 AM UTC = 3:05 AM EST (winter) - aligned with execution window
    command: `SELECT net.http_post(
      url := 'https://cgocsffxqyhojtyzniyz.supabase.co/functions/v1/daily-batch-trigger',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', (SELECT value FROM app_settings WHERE key = 'cron_secret')
      ),
      body := jsonb_build_object(
        'triggered_by', 'pg_cron_est',
        'schedule_type', 'standard_est',
        'timestamp', now()::text
      )
    ) as request_id;`
  },
  {
    jobname: 'daily-batch-trigger-edt',  
    schedule: '5 7 * * *', // 7:05 AM UTC = 3:05 AM EDT (summer) - aligned with execution window
    command: `SELECT net.http_post(
      url := 'https://cgocsffxqyhojtyzniyz.supabase.co/functions/v1/daily-batch-trigger',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', (SELECT value FROM app_settings WHERE key = 'cron_secret')
      ),
      body := jsonb_build_object(
        'triggered_by', 'pg_cron_edt',
        'schedule_type', 'daylight_edt',
        'timestamp', now()::text
      )
    ) as request_id;`
  },
  {
    jobname: 'batch-reconciler-every-10min',
    schedule: '*/10 * * * *', // Every 10 minutes (reduced from every 30 seconds)
    command: `SELECT net.http_post(
      url := 'https://cgocsffxqyhojtyzniyz.supabase.co/functions/v1/batch-reconciler',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', (SELECT value FROM app_settings WHERE key = 'cron_secret')
      ),
      body := jsonb_build_object(
        'triggered_by', 'pg_cron_reconciler',
        'timestamp', now()::text
      )
    ) as request_id;`
  }
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const adminKey = req.headers.get('x-admin-key');
  const cronSecret = req.headers.get('x-cron-secret');
  
  if (!adminKey && !cronSecret) {
    return new Response(JSON.stringify({ error: 'Missing authentication' }), {
      status: 401,
      headers: corsHeaders
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify admin access for configuration changes
    if (adminKey) {
      const { data: adminKeyData } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'admin_key')
        .single();

      if (!adminKeyData?.value || adminKeyData.value !== adminKey) {
        return new Response(JSON.stringify({ error: 'Invalid admin key' }), {
          status: 403,
          headers: corsHeaders
        });
      }
    }

    const url = new URL(req.url);
    const action = url.searchParams.get('action') || 'status';

    switch (action) {
      case 'status':
        // Get current cron job status
        const { data: cronStatus, error: cronError } = await supabase
          .rpc('get_cron_jobs_status');

        return new Response(JSON.stringify({
          success: true,
          action: 'status',
          cronJobs: cronStatus || [],
          timestamp: new Date().toISOString()
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      case 'cleanup':
        // Remove all existing cron jobs to start fresh
        const { data: existingJobs } = await supabase.rpc('get_cron_jobs_status');

        let removedJobs = 0;
        const removalResults = [];

        if (existingJobs && existingJobs.length > 0) {
          console.log(`🧹 Found ${existingJobs.length} existing cron jobs to remove`);
          
          for (const job of existingJobs) {
            try {
              const { error: unscheduleError } = await supabase.rpc('cron_unschedule', { 
                job_name: job.jobname 
              });
              
              if (unscheduleError) {
                console.warn(`⚠️ Could not remove job ${job.jobname}:`, unscheduleError.message);
                removalResults.push({ job: job.jobname, success: false, error: unscheduleError.message });
              } else {
                removedJobs++;
                console.log(`✅ Removed job: ${job.jobname} (ID: ${job.jobid})`);
                removalResults.push({ job: job.jobname, success: true, jobid: job.jobid });
              }
            } catch (err: unknown) {
              console.warn(`💥 Exception removing job ${job.jobname}:`, err);
              removalResults.push({ job: job.jobname, success: false, error: err.message });
            }
          }
        } else {
          console.log('🧹 No existing cron jobs found to remove');
        }

        return new Response(JSON.stringify({
          success: true,
          action: 'cleanup',
          removedJobs,
          totalJobs: existingJobs?.length || 0,
          results: removalResults,
          message: `Successfully removed ${removedJobs}/${existingJobs?.length || 0} cron jobs`
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      case 'setup':
        // Install hardened cron jobs
        let installedJobs = 0;
        const results = [];

        for (const job of CRON_JOBS) {
          try {
            const { data, error } = await supabase.rpc('cron_schedule', {
              job_name: job.jobname,
              cron_schedule: job.schedule,
              sql_command: job.command
            });

            if (error) {
              console.error(`❌ Failed to install ${job.jobname}:`, error);
              results.push({ job: job.jobname, success: false, error: error.message });
            } else {
              console.log(`✅ Installed job: ${job.jobname}`);
              results.push({ job: job.jobname, success: true });
              installedJobs++;
            }
          } catch (err: unknown) {
            console.error(`💥 Exception installing ${job.jobname}:`, err);
            results.push({ job: job.jobname, success: false, error: err.message });
          }
        }

        return new Response(JSON.stringify({
          success: installedJobs > 0,
          action: 'setup',
          installedJobs,
          totalJobs: CRON_JOBS.length,
          results,
          message: `Installed ${installedJobs}/${CRON_JOBS.length} cron jobs`
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      case 'health':
        // Comprehensive health check
        const healthChecks = {
          cronExtension: false,
          netExtension: false,
          cronSecret: false,
          activeJobs: 0,
          recentRuns: 0
        };

        // Check extensions
        const { data: extensions } = await supabase
          .from('pg_extension')
          .select('extname')
          .in('extname', ['pg_cron', 'pg_net']);

        if (extensions) {
          healthChecks.cronExtension = extensions.some(ext => ext.extname === 'pg_cron');
          healthChecks.netExtension = extensions.some(ext => ext.extname === 'pg_net');
        }

        // Check cron secret
        const { data: secretData } = await supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'cron_secret')
          .single();

        healthChecks.cronSecret = !!secretData?.value;

        // Count active jobs
        const { data: activeJobs } = await supabase
          .from('cron.job')
          .select('jobid', { count: 'exact' });

        healthChecks.activeJobs = activeJobs?.length || 0;

        // Count recent scheduler runs (last 24h)
        const { data: recentRuns } = await supabase
          .from('scheduler_runs')
          .select('id', { count: 'exact' })
          .gte('started_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

        healthChecks.recentRuns = recentRuns?.length || 0;

        return new Response(JSON.stringify({
          success: true,
          action: 'health',
          health: healthChecks,
          isHealthy: healthChecks.cronExtension && healthChecks.netExtension && 
                    healthChecks.cronSecret && healthChecks.activeJobs > 0,
          timestamp: new Date().toISOString()
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      default:
        return new Response(JSON.stringify({
          error: 'Invalid action',
          validActions: ['status', 'cleanup', 'setup', 'health']
        }), {
          status: 400,
          headers: corsHeaders
        });
    }

  } catch (error: unknown) {
    console.error('💥 Cron manager error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      action: 'error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});