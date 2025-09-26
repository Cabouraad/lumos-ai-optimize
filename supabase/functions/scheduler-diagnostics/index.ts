import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

// Get today's date in NY timezone
function getTodayKeyNY(): string {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit", 
    day: "2-digit"
  });
  
  const parts = formatter.formatToParts(new Date());
  const yyyy = parts.find((part: any) => part.type === 'year')?.value || '1970';
  const mm = parts.find((part: any) => part.type === 'month')?.value || '01';
  const dd = parts.find((part: any) => part.type === 'day')?.value || '01';
  
  return `${yyyy}-${mm}-${dd}`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const todayKey = getTodayKeyNY();
    const runId = crypto.randomUUID();

    console.log('🔍 Scheduler diagnostics started', { runId, todayKey });

    // 1. Check scheduler state
    const { data: schedulerState } = await supabase
      .from('scheduler_state')
      .select('*')
      .eq('id', 'global')
      .single();

    // 2. Recent scheduler runs (last 7 days)
    const { data: recentRuns } = await supabase
      .from('scheduler_runs')
      .select('*')
      .gte('started_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .order('started_at', { ascending: false })
      .limit(50);

    // 3. Active batch jobs
    const { data: activeBatchJobs } = await supabase
      .from('batch_jobs')
      .select('*')
      .in('status', ['pending', 'processing'])
      .order('created_at', { ascending: false });

    // 4. Today's batch jobs
    const { data: todayJobs } = await supabase
      .from('batch_jobs')
      .select('*')
      .gte('created_at', `${todayKey}T00:00:00`)
      .lt('created_at', `${todayKey}T23:59:59`)
      .order('created_at', { ascending: false });

    // 5. Organizations with active prompts
    const { data: orgsWithPrompts } = await supabase
      .from('organizations')
      .select(`
        id,
        name,
        prompts!inner(id)
      `)
      .eq('prompts.active', true);

    // 6. Cron job status (if accessible)
    let cronJobs = [];
    try {
      const { data: cronData } = await supabase
        .from('cron.job')
        .select('*');
      cronJobs = cronData || [];
    } catch (cronError: unknown) {
      console.warn('Could not fetch cron jobs:', cronError);
    }

    // 7. Recent function execution logs
    const { data: functionLogs } = await supabase
      .from('scheduler_runs')
      .select('function_name, status, started_at, completed_at, error_message')
      .gte('started_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('started_at', { ascending: false })
      .limit(20);

    // Analysis
    const analysis = {
      lastDailyRun: schedulerState?.last_daily_run_key || 'Never',
      lastDailyRunTime: schedulerState?.last_daily_run_at || 'Never',
      todayRunCompleted: schedulerState?.last_daily_run_key === todayKey,
      
      recentRunsCount: recentRuns?.length || 0,
      successfulRuns: recentRuns?.filter(run => run.status === 'completed').length || 0,
      failedRuns: recentRuns?.filter(run => run.status === 'failed').length || 0,
      
      activeBatchJobsCount: activeBatchJobs?.length || 0,
      todayJobsCount: todayJobs?.length || 0,
      todayCompletedJobs: todayJobs?.filter(job => job.status === 'completed').length || 0,
      
      orgsWithActivePrompts: orgsWithPrompts?.length || 0,
      
      cronJobsCount: cronJobs.length,
      
      systemHealth: 'unknown'
    };

    // Determine system health
    if (analysis.todayRunCompleted && analysis.todayCompletedJobs > 0) {
      analysis.systemHealth = 'healthy';
    } else if (analysis.failedRuns > analysis.successfulRuns) {
      analysis.systemHealth = 'unhealthy';
    } else if (!analysis.todayRunCompleted) {
      analysis.systemHealth = 'pending';
    } else {
      analysis.systemHealth = 'degraded';
    }

    // Recommendations
    const recommendations = [];

    if (!analysis.todayRunCompleted) {
      recommendations.push({
        priority: 'high',
        message: 'Daily run has not completed for today',
        action: 'Trigger manual daily run or check cron jobs'
      });
    }

    if (analysis.activeBatchJobsCount > 10) {
      recommendations.push({
        priority: 'medium',
        message: `${analysis.activeBatchJobsCount} batch jobs are currently active`,
        action: 'Check for stuck jobs and run reconciler'
      });
    }

    if (analysis.failedRuns > 3) {
      recommendations.push({
        priority: 'high',
        message: `${analysis.failedRuns} scheduler runs have failed recently`,
        action: 'Review error messages and fix underlying issues'
      });
    }

    if (cronJobs.length === 0) {
      recommendations.push({
        priority: 'critical',
        message: 'No cron jobs found - scheduler may not be running',
        action: 'Set up cron jobs using the cron-manager function'
      });
    }

    const diagnostics = {
      success: true,
      runId,
      todayKey,
      timestamp: new Date().toISOString(),
      
      analysis,
      recommendations,
      
      data: {
        schedulerState,
        recentRuns: recentRuns?.slice(0, 10), // Latest 10 only
        activeBatchJobs: activeBatchJobs?.slice(0, 5), // Latest 5 only
        todayJobs,
        orgsWithPrompts: orgsWithPrompts?.map(org => ({ 
          id: org.id, 
          name: org.name, 
          promptCount: org.prompts?.length || 0 
        })),
        cronJobs: cronJobs.map(job => ({
          jobid: job.jobid,
          jobname: job.jobname,
          schedule: job.schedule,
          active: job.active
        })),
        functionLogs
      }
    };

    return new Response(JSON.stringify(diagnostics), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    console.error('💥 Diagnostics error:', error);
    
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({
      success: false,
      error: errorMessage,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});