import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CRON_SECRET = Deno.env.get('CRON_SECRET');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[WEEKLY-SCHEDULER] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Verify cron secret for security
  const cronSecret = req.headers.get('x-cron-secret');
  if (!cronSecret || !CRON_SECRET || cronSecret !== CRON_SECRET) {
    logStep('Unauthorized request - invalid cron secret');
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }), 
      { status: 401, headers: corsHeaders }
    );
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    logStep('Weekly report scheduler started');

    // Log scheduler run start
    const { data: schedulerRun, error: logError } = await supabase
      .from('scheduler_runs')
      .insert({
        run_key: 'weekly-csv-' + new Date().toISOString().split('T')[0],
        function_name: 'weekly-report-scheduler',
        status: 'running'
      })
      .select()
      .single();

    if (logError) {
      logStep('Failed to log scheduler run start', { error: logError.message });
    }

    // Calculate last complete week's dates (Monday to Sunday) - matching PDF function logic
    const now = new Date();
    const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
    
    // Calculate days to subtract to get to last Monday
    const daysToLastMonday = currentDay === 0 ? 7 : currentDay; // If Sunday, go back 7 days
    const lastMonday = new Date(now);
    lastMonday.setDate(now.getDate() - daysToLastMonday - 7); // Go to previous week's Monday
    lastMonday.setHours(0, 0, 0, 0);
    
    // Calculate last Sunday (end of week)
    const lastSunday = new Date(lastMonday);
    lastSunday.setDate(lastMonday.getDate() + 6);
    lastSunday.setHours(23, 59, 59, 999);

    const weekStart = lastMonday.toISOString().split('T')[0];
    const weekEnd = lastSunday.toISOString().split('T')[0];

    logStep('Processing week', { weekStart, weekEnd });

    // Get all organizations that have prompt activity in the past week
    const { data: orgsWithActivity, error: orgsError } = await supabase
      .from('prompt_provider_responses')
      .select('org_id')
      .gte('run_at', weekStart)
      .lte('run_at', weekEnd + 'T23:59:59.999Z')
      .eq('status', 'success');

    if (orgsError) {
      throw new Error(`Failed to fetch organizations: ${orgsError.message}`);
    }

    // Get unique org IDs
    const uniqueOrgIds = [...new Set(orgsWithActivity?.map(row => row.org_id) || [])];
    logStep('Found organizations with activity', { count: uniqueOrgIds.length });

    let reportsGenerated = 0;
    let reportsSkipped = 0;
    let reportsFailed = 0;

    for (const orgId of uniqueOrgIds) {
      try {
        // Check if report already exists for this org and week (idempotent)
        const { data: existingReport } = await supabase
          .from('weekly_reports')
          .select('id, status')
          .eq('org_id', orgId)
          .eq('week_start_date', weekStart)
          .single();

        if (existingReport) {
          logStep('Report already exists for org', { orgId, status: existingReport.status });
          reportsSkipped++;
          continue;
        }

        // Generate report for this organization
        logStep('Generating report for org', { orgId });
        
        // Create report record
        const { data: reportRecord, error: reportError } = await supabase
          .from('weekly_reports')
          .insert({
            org_id: orgId,
            week_start_date: weekStart,
            week_end_date: weekEnd,
            status: 'generating'
          })
          .select()
          .single();

        if (reportError) {
          logStep('Failed to create report record', { orgId, error: reportError.message });
          reportsFailed++;
          continue;
        }

        // Generate the actual report (reuse logic from generate-weekly-report function)
        const reportData = await generateReportData(supabase, orgId, weekStart, weekEnd);
        const csvContent = generateCSVContent(reportData);
        
        // Upload to storage
        const fileName = `${orgId}/${weekStart}_${weekEnd}_weekly_report.csv`;
        const { error: uploadError } = await supabase.storage
          .from('weekly-reports')
          .upload(fileName, csvContent, {
            contentType: 'text/csv',
            upsert: true
          });

        if (uploadError) {
          await supabase
            .from('weekly_reports')
            .update({
              status: 'failed',
              error_message: `Upload failed: ${uploadError.message}`
            })
            .eq('id', reportRecord.id);
          
          logStep('Failed to upload report', { orgId, error: uploadError.message });
          reportsFailed++;
          continue;
        }

        // Update report record with completion
        await supabase
          .from('weekly_reports')
          .update({
            status: 'completed',
            file_path: fileName,
            file_size_bytes: new TextEncoder().encode(csvContent).length,
            generated_at: new Date().toISOString(),
            metadata: {
              prompts_analyzed: reportData.prompts.length,
              total_responses: reportData.totalResponses,
              generated_by: 'scheduler'
            }
          })
          .eq('id', reportRecord.id);

        logStep('Successfully generated report', { orgId, fileName });
        reportsGenerated++;

      } catch (orgError: unknown) {
        logStep('Error processing org', { orgId, error: orgError.message });
        reportsFailed++;
      }
    }

    logStep('Weekly report scheduler completed', {
      totalOrgs: uniqueOrgIds.length,
      reportsGenerated,
      reportsSkipped,
      reportsFailed
    });

    // Update scheduler run log with completion
    if (schedulerRun) {
      await supabase
        .from('scheduler_runs')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          result: {
            totalOrgs: uniqueOrgIds.length,
            reportsGenerated,
            reportsSkipped,
            reportsFailed,
            weekProcessed: `${weekStart} to ${weekEnd}`
          }
        })
        .eq('id', schedulerRun.id);
    }

    return new Response(JSON.stringify({
      success: true,
      summary: {
        totalOrgs: uniqueOrgIds.length,
        reportsGenerated,
        reportsSkipped,
        reportsFailed,
        weekProcessed: `${weekStart} to ${weekEnd}`
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    logStep('Error in weekly scheduler', { error: error instanceof Error ? error.message : String(error) });
    
    // Update scheduler run log with error
    if (schedulerRun) {
      await supabase
        .from('scheduler_runs')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          error_message: error.message
        })
        .eq('id', schedulerRun.id);
    }
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Reuse report generation logic
async function generateReportData(supabase: any, orgId: string, weekStart: string, weekEnd: string) {
  const { data: responses, error: responsesError } = await supabase
    .from('prompt_provider_responses')
    .select(`
      id,
      prompt_id,
      provider,
      score,
      org_brand_present,
      competitors_count,
      run_at,
      status,
      prompts!inner(text, id)
    `)
    .eq('org_id', orgId)
    .gte('run_at', weekStart)
    .lte('run_at', weekEnd + 'T23:59:59.999Z')
    .eq('status', 'success');

  if (responsesError) {
    throw new Error(`Failed to fetch responses: ${responsesError.message}`);
  }

  const promptMap = new Map();
  let totalResponses = 0;

  for (const response of responses || []) {
    totalResponses++;
    const promptId = response.prompt_id;
    
    if (!promptMap.has(promptId)) {
      promptMap.set(promptId, {
        id: promptId,
        text: response.prompts.text,
        responses: [],
        totalRuns: 0,
        brandPresentCount: 0
      });
    }

    const promptData = promptMap.get(promptId);
    promptData.responses.push(response);
    promptData.totalRuns++;
    if (response.org_brand_present) {
      promptData.brandPresentCount++;
    }
  }

  const prompts = Array.from(promptMap.values()).map(prompt => {
    const scores = prompt.responses.map((r: any) => r.score);
    const competitors = prompt.responses.map((r: any) => r.competitors_count);
    
    return {
      ...prompt,
      avgScore: scores.length > 0 ? scores.reduce((a: number, b: number) => a + b, 0) / scores.length : 0,
      avgCompetitors: competitors.length > 0 ? competitors.reduce((a: number, b: number) => a + b, 0) / competitors.length : 0,
      brandPresentRate: prompt.totalRuns > 0 ? (prompt.brandPresentCount / prompt.totalRuns) * 100 : 0
    };
  });

  return { prompts, totalResponses };
}

function generateCSVContent(reportData: any) {
  const headers = [
    'Prompt ID',
    'Prompt Text',
    'Total Runs',
    'Average Score',
    'Brand Present Rate (%)',
    'Average Competitors',
    'Brand Present Count'
  ];

  const rows = reportData.prompts.map((prompt: any) => [
    prompt.id,
    `"${prompt.text.replace(/"/g, '""')}"`,
    prompt.totalRuns,
    prompt.avgScore.toFixed(2),
    prompt.brandPresentRate.toFixed(1),
    prompt.avgCompetitors.toFixed(1),
    prompt.brandPresentCount
  ]);

  const totalRuns = reportData.prompts.reduce((sum: number, p: any) => sum + p.totalRuns, 0);
  const avgScoreOverall = totalRuns > 0 ? 
    reportData.prompts.reduce((sum: number, p: any) => sum + (p.avgScore * p.totalRuns), 0) / totalRuns : 0;

  rows.push([
    'SUMMARY',
    `"Week Summary (${reportData.prompts.length} prompts)"`,
    totalRuns,
    avgScoreOverall.toFixed(2),
    '',
    '',
    ''
  ]);

  const csvLines = [headers.join(','), ...rows.map(row => row.join(','))];
  return csvLines.join('\n');
}