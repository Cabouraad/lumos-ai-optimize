import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret, x-admin-key',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

// Hardened cron job configurations with safe JSON
const CRON_JOBS = [
  {
    jobname: 'daily-batch-trigger-est',
    schedule: '0 8 * * *', // 8 AM EST = 3 AM during EDT transition
    command: `SELECT net.http_post(url := 'https://cgocsffxqyhojtyzniyz.supabase.co/functions/v1/daily-batch-trigger', headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', (SELECT value FROM app_settings WHERE key = 'cron_secret')), body := jsonb_build_object('triggered_by', 'pg_cron_est', 'timestamp', now()::text)) as request_id;`
  },
  {
    jobname: 'daily-batch-trigger-edt', 
    schedule: '0 7 * * *', // 7 AM EDT = 3 AM during EDT
    command: `SELECT net.http_post(url := 'https://cgocsffxqyhojtyzniyz.supabase.co/functions/v1/daily-batch-trigger', headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', (SELECT value FROM app_settings WHERE key = 'cron_secret')), body := jsonb_build_object('triggered_by', 'pg_cron_edt', 'timestamp', now()::text)) as request_id;`
  },
  {
    jobname: 'batch-reconciler-every-5min',
    schedule: '*/5 * * * *', // Every 5 minutes
    command: `SELECT net.http_post(url := 'https://cgocsffxqyhojtyzniyz.supabase.co/functions/v1/batch-reconciler', headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', (SELECT value FROM app_settings WHERE key = 'cron_secret')), body := jsonb_build_object('triggered_by', 'pg_cron_reconciler', 'timestamp', now()::text)) as request_id;`
  },
  {
    jobname: 'scheduler-postcheck-hourly',
    schedule: '0 * * * *', // Every hour
    command: `SELECT net.http_post(url := 'https://cgocsffxqyhojtyzniyz.supabase.co/functions/v1/scheduler-postcheck', headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', (SELECT value FROM app_settings WHERE key = 'cron_secret')), body := jsonb_build_object('triggered_by', 'pg_cron_postcheck', 'timestamp', now()::text)) as request_id;`
  }
];

serve(async (req) => {
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
        const { data: existingJobs } = await supabase
          .from('cron.job')
          .select('jobid, jobname');

        let removedJobs = 0;
        if (existingJobs) {
          for (const job of existingJobs) {
            try {
              await supabase.rpc('cron_unschedule', { job_name: job.jobname });
              removedJobs++;
              console.log(`✅ Removed job: ${job.jobname}`);
            } catch (err) {
              console.warn(`⚠️ Could not remove job ${job.jobname}:`, err);
            }
          }
        }

        return new Response(JSON.stringify({
          success: true,
          action: 'cleanup',
          removedJobs,
          message: `Removed ${removedJobs} existing cron jobs`
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
          } catch (err) {
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

  } catch (error: any) {
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