/**
 * Weekly Report Generation Edge Function  
 * Generates comprehensive PDF and CSV reports for AI visibility analytics
 * Supports both scheduled runs (all orgs) and user requests (single org)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';
import { getLastCompleteWeekUTC } from '../_shared/report/week.ts';
import { renderReportPDF } from '../_shared/report/pdf-enhanced.ts';
import type { WeeklyReportData } from '../_shared/report/types.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

/**
 * Generate SHA256 hash of Uint8Array data
 */
async function generateSHA256(data: Uint8Array): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[WEEKLY-REPORT] ${step}${detailsStr}`);
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep('Weekly report generation started');

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Authentication handling: Support both x-cron-secret header and CRON bearer, or user JWT
    const cronHeaderRaw = req.headers.get('x-cron-secret');
    const authHeader = req.headers.get('Authorization');
    const cronSecretEnv = (Deno.env.get('CRON_SECRET') || '').trim();

    const cronHeader = cronHeaderRaw?.trim() || null;
    const bearerToken = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : null;

    // Accept either x-cron-secret or Authorization: Bearer <CRON_SECRET>
    const isScheduledRun = !!cronSecretEnv && (
      (cronHeader !== null && cronHeader === cronSecretEnv) ||
      (bearerToken !== null && bearerToken === cronSecretEnv)
    );

    logStep('Auth check', {
      hasCronHeader: !!cronHeader,
      hasAuthHeader: !!authHeader,
      used: isScheduledRun ? 'cron' : 'jwt_or_none'
    });
    
    let authenticatedUser = null;
    let isUserRequest = false;
    
    if (!isScheduledRun) {
      // Check for user JWT authentication (real JWT, not CRON secret)
      if (bearerToken) {
        const supabaseAuth = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!);
        const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(bearerToken);
        if (authError || !user) {
          logStep('Invalid user authentication', { error: authError?.message });
          return new Response(
            JSON.stringify({ error: 'Authentication required' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        authenticatedUser = user;
        isUserRequest = true;
      } else {
        logStep('No valid authentication provided');
        return new Response(
          JSON.stringify({ error: 'Authentication required' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    let schedulerRun = null;
    let targetOrgIds: string[] = [];
    
    if (isScheduledRun) {
      // Scheduled run: process all organizations with recent activity
      logStep('Processing scheduled run for all organizations');
      
      // Log scheduler run start
      const { data: runData, error: logError } = await supabase
        .from('scheduler_runs')
        .insert({
          run_key: 'weekly-pdf-csv-' + new Date().toISOString().split('T')[0],
          function_name: 'weekly-report',
          status: 'running'
        })
        .select()
        .single();

      if (logError) {
        logStep('Failed to log scheduler run start', { error: logError.message });
      } else {
        schedulerRun = runData;
      }
      
      // Get organizations that have recent activity (last 14 days)
      const { data: activeOrgs, error: orgsError } = await supabase
        .from('prompt_provider_responses')
        .select('org_id')
        .gte('run_at', new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString())
        .eq('status', 'success');

      if (orgsError) {
        logStep('Error fetching active organizations', { error: orgsError.message });
        return new Response(
          JSON.stringify({ error: 'Failed to fetch organizations' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      targetOrgIds = [...new Set(activeOrgs?.map(org => org.org_id) || [])];
      logStep('Found active organizations', { count: targetOrgIds.length });
    } else if (isUserRequest && authenticatedUser) {
      // User request: process only user's organization
      logStep('Processing user request', { userId: authenticatedUser.id });
      
      // Get user's organization
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('org_id')
        .eq('id', authenticatedUser.id)
        .single();

      if (userError || !userData?.org_id) {
        logStep('Error fetching user organization', { error: userError?.message });
        return new Response(
          JSON.stringify({ error: 'User organization not found' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      targetOrgIds = [userData.org_id];
      logStep('Processing user organization', { orgId: userData.org_id });
    }

    if (req.method === 'POST') {
      // Handle POST request - generate new report(s)
      const results: any[] = [];
      const errors: any[] = [];

      // Calculate last complete week boundaries using shared utility
      const { weekKey, startISO, endISO } = getLastCompleteWeekUTC();
      const periodStart = startISO.split('T')[0];
      const periodEnd = endISO.split('T')[0];

      logStep('Generating reports for week', { weekKey, periodStart, periodEnd, targetOrgs: targetOrgIds.length });

      // Process each organization
      for (const orgId of targetOrgIds) {
        try {
          logStep('Processing organization', { orgId });

          // Check if reports already exist and delete them
          const { data: existingPdf } = await supabase
            .from('reports')
            .select('id, storage_path, week_key')
            .eq('org_id', orgId)
            .eq('week_key', weekKey)
            .maybeSingle();

          const { data: existingCsv } = await supabase
            .from('weekly_reports')
            .select('id, file_path, status')
            .eq('org_id', orgId)
            .eq('week_start_date', periodStart)
            .maybeSingle();

          if (existingPdf || existingCsv) {
            logStep('Existing reports found - replacing', { orgId, weekKey });
            
            // Delete existing PDF file and record
            if (existingPdf) {
              const pdfStoragePath = existingPdf.storage_path.replace('reports/', '');
              const { error: pdfDeleteError } = await supabase.storage
                .from('reports')
                .remove([pdfStoragePath]);
              
              if (pdfDeleteError) {
                logStep('Failed to delete existing PDF file', { error: pdfDeleteError.message });
              }
              
              await supabase
                .from('reports')
                .delete()
                .eq('id', existingPdf.id);
            }
            
            // Delete existing CSV file and record
            if (existingCsv) {
              const { error: csvDeleteError } = await supabase.storage
                .from('weekly-reports')
                .remove([existingCsv.file_path]);
              
              if (csvDeleteError) {
                logStep('Failed to delete existing CSV file', { error: csvDeleteError.message });
              }
              
              await supabase
                .from('weekly_reports')
                .delete()
                .eq('id', existingCsv.id);
            }
            
            logStep('Old reports deleted, generating new reports', { orgId });
          }

          // Collect weekly data
          logStep('Collecting weekly data', { orgId });
          const reportData = await generateReportData(supabase, orgId, periodStart, periodEnd);

          // Generate both PDF and CSV reports
          logStep('Generating PDF report', { orgId });
          const pdfBytes = await generatePDFReport(reportData, weekKey);
          
          logStep('Generating CSV report', { orgId });
          const csvContent = generateCSVContent(reportData);

          // Upload PDF to reports storage
          const pdfPath = `${orgId}/${weekKey}.pdf`;
          const { error: pdfUploadError } = await supabase.storage
            .from('reports')
            .upload(pdfPath, pdfBytes, {
              contentType: 'application/pdf',
              upsert: true,
            });

          if (pdfUploadError) {
            logStep('PDF upload error', { orgId, error: pdfUploadError.message });
            errors.push({ orgId, error: 'PDF upload failed', details: pdfUploadError.message });
            continue;
          }

          // Upload CSV to weekly-reports storage  
          const csvPath = `${orgId}/${periodStart}_${periodEnd}_weekly_report.csv`;
          const { error: csvUploadError } = await supabase.storage
            .from('weekly-reports')
            .upload(csvPath, csvContent, {
              contentType: 'text/csv',
              upsert: true,
            });

          if (csvUploadError) {
            logStep('CSV upload error', { orgId, error: csvUploadError.message });
            errors.push({ orgId, error: 'CSV upload failed', details: csvUploadError.message });
            continue;
          }

          // Insert PDF record into reports table
          const pdfSize = pdfBytes.length;
          const sha256Hash = await generateSHA256(pdfBytes);
          
          const { error: pdfInsertError } = await supabase
            .from('reports')
            .insert({
              org_id: orgId,
              week_key: weekKey,
              period_start: periodStart,
              period_end: periodEnd,
              storage_path: `reports/${pdfPath}`,
              byte_size: pdfSize,
              sha256: sha256Hash,
            });

          // Insert CSV record into weekly_reports table
          const csvSize = new TextEncoder().encode(csvContent).length;
          
          const { error: csvInsertError } = await supabase
            .from('weekly_reports')
            .insert({
              org_id: orgId,
              week_start_date: periodStart,
              week_end_date: periodEnd,
              status: 'completed',
              file_path: csvPath,
              file_size_bytes: csvSize,
              generated_at: new Date().toISOString(),
              metadata: {
                prompts_analyzed: reportData.prompts.length,
                total_responses: reportData.totalResponses,
                generated_by: isScheduledRun ? 'scheduler' : 'user'
              }
            });

          if (pdfInsertError && csvInsertError) {
            logStep('Database insert errors', { orgId, pdfError: pdfInsertError.message, csvError: csvInsertError.message });
            errors.push({ orgId, error: 'Database insert failed', details: 'Both PDF and CSV inserts failed' });
            continue;
          }

          logStep('Report generation completed', { orgId, weekKey });
          
          results.push({
            orgId,
            week_key: weekKey,
            pdf_path: `reports/${pdfPath}`,
            csv_path: csvPath,
            period_start: periodStart,
            period_end: periodEnd,
            pdf_size: pdfSize,
            csv_size: csvSize,
            sha256: sha256Hash,
            status: 'created',
          });

        } catch (orgError: unknown) {
          logStep('Unexpected error for org', { orgId, error: orgError.message });
          errors.push({ orgId, error: 'Unexpected error', details: orgError.message });
        }
      }

      // Return summary of all operations
      const successCount = results.length;
      const errorCount = errors.length;
      
      logStep('Report generation completed', { successCount, errorCount });
      
      // Update scheduler run log with completion
      if (schedulerRun) {
        await supabase
          .from('scheduler_runs')
          .update({
            status: successCount > 0 ? 'completed' : 'failed',
            completed_at: new Date().toISOString(),
            result: {
              week_key: weekKey,
              total_orgs: targetOrgIds.length,
              successful: successCount,
              errors: errorCount
            }
          })
          .eq('id', schedulerRun.id);
      }
      
      return new Response(
        JSON.stringify({
          success: true,
          scheduled_run: isScheduledRun,
          user_request: isUserRequest,
          week_key: weekKey,
          total_orgs: targetOrgIds.length,
          successful: successCount,
          errors: errorCount,
          results: results.length > 0 ? results : undefined,
          error_details: errors.length > 0 ? errors : undefined,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Method not allowed for non-POST requests
    return new Response(
      JSON.stringify({ error: 'Only POST requests allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    logStep('Unexpected error', { error: error instanceof Error ? error.message : String(error) });
    
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Enhanced data collection function
async function generateReportData(supabase: any, orgId: string, weekStart: string, weekEnd: string): Promise<WeeklyReportData> {
  logStep('Collecting report data', { orgId, weekStart, weekEnd });

  // Get organization details
  const { data: org } = await supabase
    .from('organizations')
    .select('name, domain')
    .eq('id', orgId)
    .single();

  // Get all successful responses for the week
  const { data: responses, error: responsesError } = await supabase
    .from('prompt_provider_responses')
    .select(`
      id,
      prompt_id,
      provider,
      model,
      score,
      org_brand_present,
      org_brand_prominence,
      competitors_count,
      competitors_json,
      brands_json,
      run_at,
      status,
      prompts!inner(text, id)
    `)
    .eq('org_id', orgId)
    .gte('run_at', weekStart + 'T00:00:00Z')
    .lte('run_at', weekEnd + 'T23:59:59Z')
    .eq('status', 'success')
    .order('run_at', { ascending: false });

  if (responsesError) {
    throw new Error(`Failed to fetch responses: ${responsesError.message}`);
  }

  // Get historical data (last 8 weeks for trends)
  const eightWeeksAgo = new Date(new Date(weekStart).getTime() - 56 * 24 * 60 * 60 * 1000);
  const { data: historicalResponses } = await supabase
    .from('prompt_provider_responses')
    .select('run_at, score, org_brand_present')
    .eq('org_id', orgId)
    .gte('run_at', eightWeeksAgo.toISOString())
    .lt('run_at', weekStart + 'T00:00:00Z')
    .eq('status', 'success');

  // Process historical data by week
  const weeklyData = new Map<string, { scores: number[]; brandPresent: number; total: number }>();
  
  for (const resp of historicalResponses || []) {
    const weekKey = getWeekKey(new Date(resp.run_at));
    if (!weeklyData.has(weekKey)) {
      weeklyData.set(weekKey, { scores: [], brandPresent: 0, total: 0 });
    }
    const week = weeklyData.get(weekKey)!;
    week.scores.push(parseFloat(resp.score || 0));
    week.total++;
    if (resp.org_brand_present) week.brandPresent++;
  }

  const historicalTrend = Array.from(weeklyData.entries())
    .map(([weekStart, data]) => ({
      weekStart,
      avgScore: data.scores.length > 0 ? data.scores.reduce((a, b) => a + b, 0) / data.scores.length : 0,
      brandPresentRate: data.total > 0 ? (data.brandPresent / data.total) * 100 : 0,
      totalRuns: data.total
    }))
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart))
    .slice(-8);

  // Process current week data
  const promptMap = new Map();
  const competitorMap = new Map<string, { count: number; isNew: boolean }>();
  const providerMap = new Map<string, { responses: number; scores: number[]; brandMentions: number }>();
  const dailyMap = new Map<string, { responses: number; scores: number[] }>();
  let totalResponses = 0;
  let totalBrandPresent = 0;
  let totalScore = 0;

  for (const response of responses || []) {
    totalResponses++;
    totalScore += parseFloat(response.score || 0);
    if (response.org_brand_present) totalBrandPresent++;
    
    // Track competitors
    if (response.competitors_json) {
      const competitors = Array.isArray(response.competitors_json) 
        ? response.competitors_json 
        : [];
      
      for (const comp of competitors) {
        if (!competitorMap.has(comp)) {
          competitorMap.set(comp, { count: 0, isNew: true });
        }
        const compData = competitorMap.get(comp)!;
        compData.count++;
      }
    }

    // Track by provider
    if (!providerMap.has(response.provider)) {
      providerMap.set(response.provider, { responses: 0, scores: [], brandMentions: 0 });
    }
    const provData = providerMap.get(response.provider)!;
    provData.responses++;
    provData.scores.push(parseFloat(response.score || 0));
    if (response.org_brand_present) provData.brandMentions++;

    // Track daily
    const dateKey = response.run_at.split('T')[0];
    if (!dailyMap.has(dateKey)) {
      dailyMap.set(dateKey, { responses: 0, scores: [] });
    }
    const dayData = dailyMap.get(dateKey)!;
    dayData.responses++;
    dayData.scores.push(parseFloat(response.score || 0));

    // Track by prompt
    const promptId = response.prompt_id;
    if (!promptMap.has(promptId)) {
      promptMap.set(promptId, {
        id: promptId,
        text: response.prompts.text,
        responses: [],
        totalRuns: 0,
        brandPresentCount: 0,
        totalScore: 0,
        totalCompetitors: 0,
        providers: new Set()
      });
    }

    const promptData = promptMap.get(promptId);
    promptData.responses.push(response);
    promptData.totalRuns++;
    promptData.totalScore += parseFloat(response.score || 0);
    promptData.totalCompetitors += parseInt(response.competitors_count || 0);
    promptData.providers.add(response.provider);
    
    if (response.org_brand_present) {
      promptData.brandPresentCount++;
    }
  }

  // Categorize prompts
  const categorizePrompt = (text: string) => {
    const lower = text.toLowerCase();
    if (lower.includes('crm') || lower.includes('customer relationship') || lower.includes('salesforce') || lower.includes('hubspot')) {
      return 'crm';
    }
    if (lower.includes('competitor') || lower.includes('alternative') || lower.includes('vs ') || lower.includes('compare')) {
      return 'competitorTools';
    }
    if (lower.includes('ai') || lower.includes('automation') || lower.includes('machine learning') || lower.includes('intelligent')) {
      return 'aiFeatures';
    }
    return 'other';
  };

  const categories = { crm: [], competitorTools: [], aiFeatures: [], other: [] };
  const allPrompts: any[] = [];

  for (const [_, prompt] of promptMap) {
    const avgScore = prompt.totalRuns > 0 ? prompt.totalScore / prompt.totalRuns : 0;
    const brandPresentRate = prompt.totalRuns > 0 ? (prompt.brandPresentCount / prompt.totalRuns) * 100 : 0;
    
    const promptData = {
      id: prompt.id,
      text: prompt.text.substring(0, 100) + (prompt.text.length > 100 ? '...' : ''),
      avgScore,
      totalRuns: prompt.totalRuns,
      brandPresentRate,
      category: categorizePrompt(prompt.text)
    };

    allPrompts.push(promptData);
    categories[promptData.category as keyof typeof categories].push(promptData);
  }

  // Top performers
  const topPerformers = allPrompts
    .sort((a, b) => b.avgScore - a.avgScore)
    .slice(0, 10);

  // Zero presence prompts
  const zeroPresence = allPrompts
    .filter(p => p.brandPresentRate === 0)
    .slice(0, 5);

  // Competitor analysis
  const topCompetitors = Array.from(competitorMap.entries())
    .map(([name, data]) => ({
      name,
      appearances: data.count,
      sharePercent: totalResponses > 0 ? (data.count / totalResponses) * 100 : 0,
      isNew: data.isNew
    }))
    .sort((a, b) => b.appearances - a.appearances)
    .slice(0, 10);

  const newCompetitors = topCompetitors.filter(c => c.isNew).slice(0, 5);

  const competitorsByProvider = Array.from(providerMap.entries()).map(([provider, data]) => ({
    provider,
    totalMentions: data.responses,
    uniqueCompetitors: competitorMap.size,
    avgScore: data.scores.length > 0 ? data.scores.reduce((a, b) => a + b, 0) / data.scores.length : 0
  }));

  // Volume analysis
  const providersUsed = Array.from(providerMap.entries()).map(([provider, data]) => ({
    provider,
    responseCount: data.responses,
    avgScore: data.scores.length > 0 ? data.scores.reduce((a, b) => a + b, 0) / data.scores.length : 0,
    brandMentions: data.brandMentions
  }));

  const dailyBreakdown = Array.from(dailyMap.entries())
    .map(([date, data]) => ({
      date,
      responses: data.responses,
      avgScore: data.scores.length > 0 ? data.scores.reduce((a, b) => a + b, 0) / data.scores.length : 0
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Calculate KPIs and trends
  const avgVisibilityScore = totalResponses > 0 ? totalScore / totalResponses : 0;
  const brandPresentRate = totalResponses > 0 ? (totalBrandPresent / totalResponses) * 100 : 0;
  
  const priorWeek = historicalTrend[historicalTrend.length - 1];
  const scoreTrend = priorWeek ? avgVisibilityScore - priorWeek.avgScore : 0;
  const presenceTrend = priorWeek ? brandPresentRate - priorWeek.brandPresentRate : 0;

  // Generate insights
  const insights = generateInsights(avgVisibilityScore, brandPresentRate, scoreTrend, topCompetitors, zeroPresence, topPerformers);

  logStep('Data collection completed', { 
    totalPrompts: allPrompts.length, 
    totalResponses, 
    brandPresenceRate: brandPresentRate.toFixed(1) + '%'
  });

  return {
    header: {
      orgId,
      orgName: org?.name || 'Organization',
      periodStart: weekStart,
      periodEnd: weekEnd,
      generatedAt: new Date().toISOString()
    },
    kpis: {
      avgVisibilityScore,
      overallScore: avgVisibilityScore,
      scoreTrend,
      totalRuns: totalResponses,
      brandPresentRate,
      avgCompetitors: totalResponses > 0 ? Array.from(competitorMap.values()).reduce((sum, c) => sum + c.count, 0) / totalResponses : 0,
      deltaVsPriorWeek: priorWeek ? {
        avgVisibilityScore: scoreTrend,
        totalRuns: totalResponses - priorWeek.totalRuns,
        brandPresentRate: presenceTrend
      } : undefined,
      trendProjection: {
        brandPresenceNext4Weeks: brandPresentRate + (presenceTrend * 4),
        confidenceLevel: historicalTrend.length >= 4 ? 'high' : 'medium'
      }
    },
    historicalTrend: { weeklyScores: historicalTrend },
    prompts: {
      totalActive: allPrompts.length,
      categories,
      topPerformers,
      zeroPresence
    },
    competitors: {
      totalDetected: competitorMap.size,
      newThisWeek: newCompetitors,
      topCompetitors,
      avgCompetitorsPerResponse: totalResponses > 0 ? Array.from(competitorMap.values()).reduce((sum, c) => sum + c.count, 0) / totalResponses : 0,
      byProvider: competitorsByProvider
    },
    recommendations: {
      totalCount: 0,
      byType: {},
      byStatus: {},
      highlights: [],
      fallbackMessage: 'Recommendations will be available in future updates.'
    },
    volume: {
      totalResponsesAnalyzed: totalResponses,
      providersUsed,
      dailyBreakdown
    },
    insights
  };
}

// Helper function to get week key (YYYY-Www format)
function getWeekKey(date: Date): string {
  const year = date.getFullYear();
  const firstDayOfYear = new Date(year, 0, 1);
  const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
  const weekNumber = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
  return `${year}-W${weekNumber.toString().padStart(2, '0')}`;
}

// Generate smart insights
function generateInsights(avgScore: number, brandRate: number, scoreTrend: number, competitors: any[], zeroPresence: any[], topPerformers: any[]) {
  const highlights: string[] = [];
  const keyFindings: string[] = [];
  const recommendations: string[] = [];

  // Safe defaults for all numeric values
  const safeBrandRate = brandRate ?? 0;
  const safeScoreTrend = scoreTrend ?? 0;

  // Highlights
  if (safeBrandRate >= 75) {
    highlights.push(`Excellent brand visibility at ${safeBrandRate.toFixed(1)}% presence rate`);
  } else if (safeBrandRate >= 50) {
    highlights.push(`Good brand visibility at ${safeBrandRate.toFixed(1)}% presence rate`);
  } else {
    highlights.push(`Brand visibility needs improvement at ${safeBrandRate.toFixed(1)}% presence rate`);
  }

  if (safeScoreTrend > 0.5) {
    highlights.push(`Strong upward trend with ${safeScoreTrend.toFixed(1)} point improvement`);
  } else if (safeScoreTrend < -0.5) {
    highlights.push(`Visibility declining by ${Math.abs(safeScoreTrend).toFixed(1)} points`);
  }

  if (topPerformers && topPerformers.length > 0 && topPerformers[0]?.avgScore !== undefined) {
    highlights.push(`Top prompt achieving ${(topPerformers[0].avgScore ?? 0).toFixed(1)}/10 average score`);
  }

  // Key findings
  if (competitors && competitors.length > 0 && competitors[0]) {
    keyFindings.push(`${competitors.length} competitors detected, led by ${competitors[0].name || 'Unknown'} (${(competitors[0].sharePercent ?? 0).toFixed(1)}%)`);
  }

  if (zeroPresence.length > 0) {
    keyFindings.push(`${zeroPresence.length} prompts showing zero brand presence require attention`);
  }

  const avgPerformerScore = topPerformers.length > 0 
    ? topPerformers.reduce((sum, p) => sum + p.avgScore, 0) / topPerformers.length 
    : 0;
  
  if (avgPerformerScore < 5) {
    keyFindings.push('Overall prompt performance below target - content optimization needed');
  }

  // Recommendations
  if (zeroPresence.length > 0) {
    recommendations.push('Create targeted content addressing zero-visibility prompts');
  }

  if (brandRate < 60) {
    recommendations.push('Increase content production and SEO optimization to improve brand mentions');
  }

  if (competitors.length > 5 && competitors[0].sharePercent > brandRate) {
    recommendations.push(`Focus on competitive differentiation against ${competitors[0].name}`);
  }

  if (topPerformers.length > 0 && topPerformers[0].avgScore >= 8) {
    recommendations.push(`Replicate success patterns from top-performing prompts in ${topPerformers[0].category} category`);
  }

  return { highlights, keyFindings, recommendations };
}

/**
 * Generate PDF report using enhanced renderer
 */
async function generatePDFReport(reportData: WeeklyReportData, weekKey: string): Promise<Uint8Array> {
  logStep('Using enhanced PDF renderer');
  const pdfBytes = await renderReportPDF(reportData);
  return pdfBytes;
}

// Enhanced CSV generation for new report structure
function generateCSVContent(reportData: any) {
  const headers = [
    'Prompt ID',
    'Prompt Text',
    'Category',
    'Total Runs',
    'Average Score',
    'Brand Present Rate (%)'
  ];

  const rows: any[] = [];
  
  // Collect all prompts from categories and topPerformers
  const allPrompts: any[] = [];
  
  // Add from categories if available
  if (reportData.prompts?.categories) {
    const { crm = [], competitorTools = [], aiFeatures = [], other = [] } = reportData.prompts.categories;
    allPrompts.push(...crm, ...competitorTools, ...aiFeatures, ...other);
  }
  
  // If no category data, use topPerformers
  if (allPrompts.length === 0 && reportData.prompts?.topPerformers) {
    allPrompts.push(...reportData.prompts.topPerformers);
  }

  logStep('CSV generation', { promptsFound: allPrompts.length, hasCategories: !!reportData.prompts?.categories });

  // Generate rows from prompts
  allPrompts.forEach((prompt: any) => {
    rows.push([
      prompt.id || '',
      `"${(prompt.text || '').replace(/"/g, '""')}"`,
      prompt.category || 'other',
      prompt.totalRuns || 0,
      (prompt.avgScore ?? 0).toFixed(2),
      (prompt.brandPresentRate ?? 0).toFixed(1)
    ]);
  });

  // Add summary row
  const totalRuns = reportData.kpis?.totalRuns ?? reportData.volume?.totalResponsesAnalyzed ?? 0;
  const avgScore = reportData.kpis?.avgVisibilityScore ?? reportData.kpis?.overallScore ?? 0;
  const brandRate = reportData.kpis?.brandPresentRate ?? 0;
  
  rows.push([
    'SUMMARY',
    `"Week Summary (${allPrompts.length} prompts analyzed)"`,
    'all',
    totalRuns,
    (avgScore ?? 0).toFixed(2),
    (brandRate ?? 0).toFixed(1)
  ]);

  const csvLines = [headers.join(','), ...rows.map(row => row.map(cell => cell?.toString() || '').join(','))];
  return csvLines.join('\n');
}