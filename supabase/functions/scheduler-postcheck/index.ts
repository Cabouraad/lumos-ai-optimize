import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from "../_shared/cors.ts";

// Helper logging function  
const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[POSTCHECK] ${step}${detailsStr}`);
};

// New York timezone utility
function getTodayKeyNY(d = new Date()): string {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit", 
    day: "2-digit"
  });
  
  const parts = formatter.formatToParts(d);
  const yyyy = parts.find(part => part.type === 'year')?.value || '1970';
  const mm = parts.find(part => part.type === 'month')?.value || '01';
  const dd = parts.find(part => part.type === 'day')?.value || '01';
  
  return `${yyyy}-${mm}-${dd}`;
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const runId = crypto.randomUUID();
    const todayKey = getTodayKeyNY();
    
    logStep('Postcheck started', { runId, todayKey });

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Log the scheduler run start
    const { data: schedulerRun, error: logError } = await supabase
      .from('scheduler_runs')
      .insert({
        function_name: 'scheduler-postcheck',
        run_key: `postcheck-${todayKey}`,
        status: 'running',
        result: { runId, action: 'postcheck_started', todayKey }
      })
      .select()
      .single();

    if (logError) {
      console.error('⚠️ Failed to log scheduler run:', logError);
    }

    // Validate CRON secret for scheduled calls
    const cronSecret = req.headers.get('x-cron-secret');
    const isManualCall = !cronSecret;

    if (cronSecret) {
      const { data: secretData } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'cron_secret')
        .single();

      if (!secretData || secretData.value !== cronSecret) {
        logStep('Invalid CRON secret provided');
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Invalid or missing CRON secret',
          runId 
        }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    logStep('Postcheck authorized', { isManualCall });

    // 1. Find all organizations with active prompts
    const { data: orgsWithPrompts, error: orgsError } = await supabase
      .from('organizations')
      .select(`
        id,
        name,
        prompts!inner(id)
      `)
      .eq('prompts.active', true);

    if (orgsError) {
      throw new Error(`Failed to fetch organizations: ${orgsError.message}`);
    }

    const orgIds = orgsWithPrompts?.map(org => org.id) || [];
    logStep('Organizations with active prompts found', { count: orgIds.length });

    if (orgIds.length === 0) {
      const result = {
        success: true,
        action: 'postcheck_completed',
        runId,
        todayKey,
        message: 'No organizations with active prompts found',
        coverage: { expected: 0, found: 0, missing: 0 },
        summary: { totalOrgs: 0, jobsFound: 0, gaps: 0, healingAttempted: 0 }
      };

      // Update scheduler run
      if (schedulerRun) {
        await supabase
          .from('scheduler_runs')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            result
          })
          .eq('id', schedulerRun.id);
      }

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 2. Check for completed batch jobs for today for each org
    const { data: todayJobs, error: jobsError } = await supabase
      .from('batch_jobs')
      .select('org_id, status, completed_at, total_tasks, completed_tasks, failed_tasks')
      .in('org_id', orgIds)
      .gte('created_at', `${todayKey}T00:00:00`)
      .lt('created_at', `${todayKey}T23:59:59`);

    if (jobsError) {
      throw new Error(`Failed to fetch batch jobs: ${jobsError.message}`);
    }

    const completedOrgIds = new Set(
      todayJobs?.filter(job => job.status === 'completed')?.map(job => job.org_id) || []
    );

    const missingOrgs = orgIds.filter(orgId => !completedOrgIds.has(orgId));
    
    logStep('Coverage analysis', {
      expectedOrgs: orgIds.length,
      orgsWithCompletedJobs: completedOrgIds.size,
      missingOrgs: missingOrgs.length
    });

    // 3. Optional self-healing: trigger batch processing for missing orgs
    let healingAttempted = 0;
    const healingResults = [];

    if (missingOrgs.length > 0) {
      logStep('Attempting self-healing for missing organizations', { count: missingOrgs.length });

      for (const orgId of missingOrgs) {
        try {
          // Get the CRON secret for healing calls
          const { data: cronSecretData } = await supabase
            .from('app_settings')
            .select('value')
            .eq('key', 'cron_secret')
            .single();

          if (cronSecretData?.value) {
            const healingResponse = await supabase.functions.invoke('robust-batch-processor', {
              body: {
                action: 'create',
                orgId,
                correlationId: `healing-${runId}`,
                healedBy: 'postcheck'
              },
              headers: {
                'x-cron-secret': cronSecretData.value
              }
            });

            if (healingResponse.error) {
              logStep('Healing failed for org', { orgId, error: healingResponse.error.message });
              healingResults.push({ orgId, success: false, error: healingResponse.error.message });
            } else {
              logStep('Healing triggered for org', { orgId, jobId: healingResponse.data?.batchJobId });
              healingResults.push({ orgId, success: true, jobId: healingResponse.data?.batchJobId });
              healingAttempted++;
            }
          }
        } catch (healingError) {
          logStep('Healing exception for org', { orgId, error: healingError.message });
          healingResults.push({ orgId, success: false, error: healingError.message });
        }
      }
    }

    // 4. Aggregate metrics
    const jobMetrics = todayJobs?.reduce((acc, job) => {
      acc.totalJobs++;
      acc.totalTasks += job.total_tasks || 0;
      acc.completedTasks += job.completed_tasks || 0;
      acc.failedTasks += job.failed_tasks || 0;
      if (job.status === 'completed') acc.completedJobs++;
      return acc;
    }, {
      totalJobs: 0,
      completedJobs: 0,
      totalTasks: 0,
      completedTasks: 0,
      failedTasks: 0
    }) || {
      totalJobs: 0,
      completedJobs: 0,
      totalTasks: 0,
      completedTasks: 0,
      failedTasks: 0
    };

    const result = {
      success: true,
      action: 'postcheck_completed',
      runId,
      todayKey,
      coverage: {
        expected: orgIds.length,
        found: completedOrgIds.size,
        missing: missingOrgs.length,
        missingOrgIds: missingOrgs
      },
      metrics: jobMetrics,
      healing: {
        attempted: healingAttempted,
        results: healingResults
      },
      summary: {
        totalOrgs: orgIds.length,
        jobsFound: completedOrgIds.size,
        gaps: missingOrgs.length,
        healingAttempted,
        successRate: orgIds.length > 0 ? Math.round((completedOrgIds.size / orgIds.length) * 100) : 100
      },
      timestamp: new Date().toISOString()
    };

    logStep('Postcheck completed', result.summary);

    // Update scheduler run with final results
    if (schedulerRun) {
      await supabase
        .from('scheduler_runs')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          result
        })
        .eq('id', schedulerRun.id);
    }

    // Alert if coverage is poor (< 95%)
    if (result.summary.successRate < 95) {
      console.warn(`🚨 COVERAGE ALERT: Only ${result.summary.successRate}% of organizations processed today (${completedOrgIds.size}/${orgIds.length})`);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('❌ Postcheck error:', error.message);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Unknown error occurred',
      action: 'postcheck_failed',
      timestamp: new Date().toISOString()
    }), {
      status: 200, // Return 200 to avoid edge function errors
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});