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
  const yyyy = parts.find((part: any) => part.type === 'year')?.value || '1970';
  const mm = parts.find((part: any) => part.type === 'month')?.value || '01';
  const dd = parts.find((part: any) => part.type === 'day')?.value || '01';
  
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

    // Check for repair mode
    const url = new URL(req.url);
    const repairMode = url.searchParams.get('repair') === 'true';
    
    // 1. Find ALL active prompts across all organizations for prompt-level tracking
    const { data: activePrompts, error: promptsError } = await supabase
      .from('prompts')
      .select(`
        id,
        text,
        org_id,
        organizations!inner(id, name, domain)
      `)
      .eq('active', true);

    if (promptsError) {
      throw new Error(`Failed to fetch active prompts: ${promptsError.message}`);
    }

    const totalActivePrompts = activePrompts?.length || 0;
    const orgIds = [...new Set(activePrompts?.map(p => p.org_id) || [])];
    
    logStep('Active prompts found across all organizations', { 
      totalPrompts: totalActivePrompts, 
      organizations: orgIds.length 
    });

    if (totalActivePrompts === 0) {
      const result = {
        success: true,
        action: 'postcheck_completed',
        runId,
        todayKey,
        message: 'No active prompts found across all organizations',
        promptCoverage: { expectedActivePrompts: 0, promptsRunToday: 0, coveragePercent: 100 },
        orgCoverage: { expected: 0, found: 0, missing: 0 },
        summary: { totalOrgs: 0, totalPrompts: 0, jobsFound: 0, gaps: 0, healingAttempted: 0 }
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

    // 2. Check PROMPT-LEVEL coverage for today
    const { data: todayResponses, error: responsesError } = await supabase
      .from('prompt_provider_responses')
      .select('prompt_id, provider, org_id, status')
      .in('org_id', orgIds)
      .gte('run_at', `${todayKey}T00:00:00`)
      .lt('run_at', `${todayKey}T23:59:59`)
      .eq('status', 'success');

    if (responsesError) {
      throw new Error(`Failed to fetch today's responses: ${responsesError.message}`);
    }

    // Calculate prompt-level coverage
    const promptsRunToday = new Set(todayResponses?.map(r => r.prompt_id) || []).size;
    const promptCoveragePercent = totalActivePrompts > 0 ? Math.round((promptsRunToday / totalActivePrompts) * 100) : 100;
    
    // Find missing prompts (per organization)
    const promptsRunTodaySet = new Set(todayResponses?.map(r => r.prompt_id) || []);
    const missingPrompts = activePrompts?.filter(p => !promptsRunTodaySet.has(p.id)) || [];
    const missingPromptsByOrg = missingPrompts.reduce((acc, prompt) => {
      if (!acc[prompt.org_id]) acc[prompt.org_id] = [];
      acc[prompt.org_id].push({
        id: prompt.id,
        text: prompt.text.substring(0, 80) + (prompt.text.length > 80 ? '...' : ''),
        org_name: prompt.organizations.name
      });
      return acc;
    }, {} as Record<string, any[]>);

    // 3. Check organization-level batch job completion 
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
    
    logStep('Comprehensive coverage analysis', {
      expectedPrompts: totalActivePrompts,
      promptsRunToday,
      promptCoveragePercent,
      expectedOrgs: orgIds.length,
      orgsWithCompletedJobs: completedOrgIds.size,
      missingOrgs: missingOrgs.length,
      missingPromptsCount: missingPrompts.length
    });

    // 4. Enhanced self-healing: trigger batch processing for missing orgs
    let healingAttempted = 0;
    const healingResults = [];

    // Only attempt healing if repair mode is enabled and we have coverage gaps
    if (repairMode && (missingOrgs.length > 0 || promptCoveragePercent < 95)) {
      logStep('Repair mode enabled - attempting self-healing', { 
        missingOrgs: missingOrgs.length,
        promptCoverage: promptCoveragePercent,
        totalMissingPrompts: missingPrompts.length,
        repairThreshold: '95% coverage'
      });

      // Get the CRON secret once for all healing calls
      const { data: cronSecretData } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'cron_secret')
        .single();

      if (!cronSecretData?.value) {
        logStep('Cannot perform healing - missing cron secret');
        healingResults.push({ error: 'Missing cron secret for healing operations' });
      } else {
        // Process missing organizations with enhanced error handling
        for (const orgId of missingOrgs) {
          try {
            // Check if healing is needed (avoid duplicate healing)
            const { data: recentHealingJobs } = await supabase
              .from('batch_jobs')
              .select('id, status, created_at')
              .eq('org_id', orgId)
              .gte('created_at', `${todayKey}T00:00:00`)
              .eq('metadata->source', 'scheduler-postcheck-repair');

            const hasRecentHealingJob = recentHealingJobs?.some(job => 
              job.status === 'processing' || 
              (job.status === 'completed' && new Date(job.created_at) > new Date(Date.now() - 60 * 60 * 1000))
            );

            if (hasRecentHealingJob) {
              logStep('Skipping healing for org - recent job exists', { orgId });
              healingResults.push({ orgId, success: true, action: 'skipped', reason: 'Recent healing job exists' });
              continue;
            }

            const healingResponse = await supabase.functions.invoke('robust-batch-processor', {
              body: {
                action: 'create',
                orgId,
                correlationId: `repair-${runId}`,
                healedBy: 'postcheck-repair',
                source: 'scheduler-postcheck-repair',
                repairContext: {
                  todayKey,
                  missingPrompts: missingPromptsByOrg[orgId]?.length || 0
                }
              },
              headers: {
                'x-cron-secret': cronSecretData.value
              }
            });

            if (healingResponse.error) {
              logStep('Repair failed for org', { orgId, error: healingResponse.error.message });
              healingResults.push({ orgId, success: false, error: healingResponse.error.message });
            } else {
              logStep('Repair triggered for org', { orgId, jobId: healingResponse.data?.batchJobId });
              healingResults.push({ 
                orgId, 
                success: true, 
                jobId: healingResponse.data?.batchJobId,
                action: healingResponse.data?.action
              });
              healingAttempted++;
            }
          } catch (healingError: unknown) {
            logStep('Repair exception for org', { orgId, error: healingError.message });
            healingResults.push({ orgId, success: false, error: healingError.message });
          }

          // Small delay to avoid overwhelming the system
          if (missingOrgs.length > 1) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }
      }
    } else if (missingOrgs.length > 0 || promptCoveragePercent < 95) {
      logStep('Coverage gaps detected but repair mode not enabled', {
        repairMode,
        missingOrgs: missingOrgs.length,
        promptCoverage: promptCoveragePercent,
        hint: 'Add ?repair=true to enable automatic healing',
        coverageThreshold: 95
      });
    } else {
      logStep('No healing required - coverage is satisfactory', {
        orgCoverage: Math.round((completedOrgIds.size / orgIds.length) * 100),
        promptCoverage: promptCoveragePercent
      });
    }

    // 5. Aggregate comprehensive metrics
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

    // Enhanced result with prompt-level tracking
    const result = {
      success: true,
      action: 'postcheck_completed',
      runId,
      todayKey,
      repairMode,
      
      // NEW: Prompt-level coverage tracking
      promptCoverage: {
        expectedActivePrompts: totalActivePrompts,
        promptsRunToday,
        coveragePercent: promptCoveragePercent,
        missingPromptsCount: missingPrompts.length,
        missingPromptsByOrg: Object.keys(missingPromptsByOrg).length > 0 ? missingPromptsByOrg : undefined
      },
      
      // EXISTING: Organization-level coverage
      orgCoverage: {
        expected: orgIds.length,
        found: completedOrgIds.size,
        missing: missingOrgs.length,
        missingOrgIds: missingOrgs.length > 0 ? missingOrgs : undefined
      },
      
      // Job metrics
      metrics: jobMetrics,
      
      // Healing/repair results
      healing: {
        attempted: healingAttempted,
        results: healingResults.length > 0 ? healingResults : undefined
      },
      
      // Summary for quick assessment
      summary: {
        totalOrgs: orgIds.length,
        totalPrompts: totalActivePrompts,
        jobsFound: completedOrgIds.size,
        promptsRun: promptsRunToday,
        orgCoveragePercent: orgIds.length > 0 ? Math.round((completedOrgIds.size / orgIds.length) * 100) : 100,
        promptCoveragePercent,
        gaps: missingOrgs.length,
        missingPrompts: missingPrompts.length,
        healingAttempted,
        overallHealth: promptCoveragePercent >= 95 && (orgIds.length === 0 || completedOrgIds.size >= orgIds.length * 0.95) ? 'HEALTHY' : 'NEEDS_ATTENTION'
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

    // Enhanced coverage alerts
    if (result.summary.overallHealth === 'NEEDS_ATTENTION') {
      console.warn(`🚨 COVERAGE ALERT: System needs attention`);
      console.warn(`   Org Coverage: ${result.summary.orgCoveragePercent}% (${completedOrgIds.size}/${orgIds.length})`);
      console.warn(`   Prompt Coverage: ${promptCoveragePercent}% (${promptsRunToday}/${totalActivePrompts})`);
      console.warn(`   Missing Prompts: ${missingPrompts.length}`);
      if (!repairMode && (missingOrgs.length > 0 || promptCoveragePercent < 95)) {
        console.warn(`   💡 Suggestion: Run with ?repair=true to attempt automatic healing`);
      }
    } else {
      console.log(`✅ COVERAGE HEALTHY: ${promptCoveragePercent}% prompts run, ${result.summary.orgCoveragePercent}% orgs completed`);
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