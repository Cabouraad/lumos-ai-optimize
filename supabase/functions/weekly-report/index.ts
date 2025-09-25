/**
 * Weekly Report Generation Edge Function  
 * Generates comprehensive PDF and CSV reports for AI visibility analytics
 * Supports both scheduled runs (all orgs) and user requests (single org)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WeekBoundaries {
  weekKey: string;
  periodStart: string;
  periodEnd: string;
}

/**
 * Calculate ISO week boundaries for the most recent complete week (Monday to Sunday)
 */
function getLastCompleteWeek(): WeekBoundaries {
  const now = new Date();
  const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
  
  // Calculate the most recent complete week (Monday to Sunday)
  let daysToLastSunday: number;
  if (currentDay === 0) {
    daysToLastSunday = 1;
  } else {
    daysToLastSunday = currentDay;
  }
  
  // Get the end of the most recent complete week (last Sunday at 23:59:59)
  const lastSunday = new Date(now);
  lastSunday.setDate(now.getDate() - daysToLastSunday);
  lastSunday.setHours(23, 59, 59, 999);
  
  // Get the start of that week (Monday at 00:00:00)
  const lastMonday = new Date(lastSunday);
  lastMonday.setDate(lastSunday.getDate() - 6);
  lastMonday.setHours(0, 0, 0, 0);
  
  // Generate ISO week key using the Monday date
  const year = lastMonday.getFullYear();
  const weekNumber = getISOWeek(lastMonday);
  const weekKey = `${year}-W${weekNumber.toString().padStart(2, '0')}`;
  
  return {
    weekKey,
    periodStart: lastMonday.toISOString().split('T')[0], // YYYY-MM-DD format
    periodEnd: lastSunday.toISOString().split('T')[0],
  };
}

/**
 * Get ISO week number for a given date
 */
function getISOWeek(date: Date): number {
  const target = new Date(date.valueOf());
  const dayNumber = (date.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNumber + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
  }
  return 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
}

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

    // Authentication handling: Support both CRON_SECRET and user JWT
    const authHeader = req.headers.get('Authorization');
    const cronSecret = Deno.env.get('CRON_SECRET');
    const isScheduledRun = authHeader === `Bearer ${cronSecret}` && cronSecret;
    
    let authenticatedUser = null;
    let isUserRequest = false;
    
    if (!isScheduledRun) {
      // Check for user JWT authentication
      if (authHeader?.startsWith('Bearer ')) {
        const jwt = authHeader.replace('Bearer ', '');
        const supabaseAuth = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!);
        
        const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(jwt);
        
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

      // Calculate last complete week boundaries
      const { weekKey, periodStart, periodEnd } = getLastCompleteWeek();

      logStep('Generating reports for week', { weekKey, periodStart, periodEnd, targetOrgs: targetOrgIds.length });

      // Process each organization
      for (const orgId of targetOrgIds) {
        try {
          logStep('Processing organization', { orgId });

          // Check if reports already exist
          const { data: existingPdf } = await supabase
            .from('reports')
            .select('storage_path, week_key')
            .eq('org_id', orgId)
            .eq('week_key', weekKey)
            .maybeSingle();

          const { data: existingCsv } = await supabase
            .from('weekly_reports')
            .select('file_path, status')
            .eq('org_id', orgId)
            .eq('week_start_date', periodStart)
            .maybeSingle();

          if (existingPdf && existingCsv) {
            logStep('Both reports already exist', { orgId, weekKey });
            results.push({
              orgId,
              week_key: weekKey,
              pdf_path: existingPdf.storage_path,
              csv_path: existingCsv.file_path,
              status: 'exists',
            });
            continue;
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

        } catch (orgError) {
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
async function generateReportData(supabase: any, orgId: string, weekStart: string, weekEnd: string) {
  logStep('Collecting report data', { orgId, weekStart, weekEnd });

  // Get all successful responses for the week
  const { data: responses, error: responsesError } = await supabase
    .from('prompt_provider_responses')
    .select(`
      id,
      prompt_id,
      provider,
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

  // Process data by prompt
  const promptMap = new Map();
  let totalResponses = 0;
  let totalBrandPresent = 0;
  const allCompetitors = new Set();

  for (const response of responses || []) {
    totalResponses++;
    if (response.org_brand_present) totalBrandPresent++;
    
    // Collect unique competitors
    if (response.competitors_json) {
      const competitors = Array.isArray(response.competitors_json) 
        ? response.competitors_json 
        : JSON.parse(response.competitors_json || '[]');
      competitors.forEach((comp: string) => allCompetitors.add(comp));
    }

    const promptId = response.prompt_id;
    
    if (!promptMap.has(promptId)) {
      promptMap.set(promptId, {
        id: promptId,
        text: response.prompts.text.substring(0, 100) + (response.prompts.text.length > 100 ? '...' : ''),
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

  // Process prompts with enhanced metrics
  const prompts = Array.from(promptMap.values()).map(prompt => ({
    ...prompt,
    avgScore: prompt.totalRuns > 0 ? (prompt.totalScore / prompt.totalRuns) : 0,
    avgCompetitors: prompt.totalRuns > 0 ? (prompt.totalCompetitors / prompt.totalRuns) : 0,
    brandPresentRate: prompt.totalRuns > 0 ? (prompt.brandPresentCount / prompt.totalRuns) * 100 : 0,
    providersCount: prompt.providers.size,
    providersList: Array.from(prompt.providers)
  }));

  // Calculate summary metrics
  const summary = {
    totalPrompts: prompts.length,
    totalResponses,
    overallBrandPresenceRate: totalResponses > 0 ? (totalBrandPresent / totalResponses) * 100 : 0,
    avgScoreAcrossAll: prompts.length > 0 ? prompts.reduce((sum, p) => sum + p.avgScore, 0) / prompts.length : 0,
    topCompetitors: Array.from(allCompetitors).slice(0, 5),
    weekStart,
    weekEnd
  };

  logStep('Data collection completed', { 
    totalPrompts: prompts.length, 
    totalResponses, 
    brandPresenceRate: summary.overallBrandPresenceRate.toFixed(1) + '%'
  });

  return { prompts, totalResponses, summary };
}

// Simple PDF generation (placeholder - can be enhanced)
async function generatePDFReport(reportData: any, weekKey: string): Promise<Uint8Array> {
  // For now, generate a simple text-based "PDF" (should be replaced with proper PDF generation)
  const content = `
AI VISIBILITY WEEKLY REPORT
Week: ${weekKey}
Generated: ${new Date().toISOString()}

=== SUMMARY ===
Total Prompts Analyzed: ${reportData.summary.totalPrompts}
Total Responses: ${reportData.summary.totalResponses}
Overall Brand Presence Rate: ${reportData.summary.overallBrandPresenceRate.toFixed(1)}%
Average Visibility Score: ${reportData.summary.avgScoreAcrossAll.toFixed(2)}

=== TOP PERFORMING PROMPTS ===
${reportData.prompts
  .sort((a, b) => b.avgScore - a.avgScore)
  .slice(0, 5)
  .map((p, i) => `${i+1}. Score: ${p.avgScore.toFixed(2)} | Brand Present: ${p.brandPresentRate.toFixed(1)}% | "${p.text}"`)
  .join('\n')}

=== IMPROVEMENT OPPORTUNITIES ===
${reportData.prompts
  .filter(p => p.brandPresentRate < 50)
  .slice(0, 3)
  .map(p => `- "${p.text}" (${p.brandPresentRate.toFixed(1)}% brand presence)`)
  .join('\n')}

Report generated automatically by AI Visibility Analytics Platform.
  `;
  
  return new TextEncoder().encode(content);
}

// Enhanced CSV generation
function generateCSVContent(reportData: any) {
  const headers = [
    'Prompt ID',
    'Prompt Text',
    'Total Runs',
    'Average Score',
    'Brand Present Rate (%)',
    'Average Competitors',
    'Brand Present Count',
    'Providers Used',
    'Best Score',
    'Worst Score'
  ];

  const rows = reportData.prompts.map((prompt: any) => {
    const scores = prompt.responses.map((r: any) => parseFloat(r.score || 0));
    const bestScore = scores.length > 0 ? Math.max(...scores) : 0;
    const worstScore = scores.length > 0 ? Math.min(...scores) : 0;
    
    return [
      prompt.id,
      `"${prompt.text.replace(/"/g, '""')}"`,
      prompt.totalRuns,
      prompt.avgScore.toFixed(2),
      prompt.brandPresentRate.toFixed(1),
      prompt.avgCompetitors.toFixed(1),
      prompt.brandPresentCount,
      `"${prompt.providersList.join(', ')}"`,
      bestScore.toFixed(2),
      worstScore.toFixed(2)
    ];
  });

  // Add summary row
  rows.push([
    'SUMMARY',
    `"Week Summary (${reportData.summary.totalPrompts} prompts analyzed)"`,
    reportData.summary.totalResponses,
    reportData.summary.avgScoreAcrossAll.toFixed(2),
    reportData.summary.overallBrandPresenceRate.toFixed(1),
    '',
    '', 
    `"Period: ${reportData.summary.weekStart} to ${reportData.summary.weekEnd}"`,
    '',
    ''
  ]);

  const csvLines = [headers.join(','), ...rows.map(row => row.map(cell => cell?.toString() || '').join(','))];
  return csvLines.join('\n');
}