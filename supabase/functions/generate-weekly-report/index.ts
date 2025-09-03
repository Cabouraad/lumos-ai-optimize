import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[WEEKLY-REPORT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    logStep('Weekly report generation started');

    // Get authenticated user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Authorization header required');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) {
      throw new Error('Authentication failed');
    }

    const user = userData.user;
    
    // Get user's organization
    const { data: userOrgData, error: userOrgError } = await supabase
      .from('users')
      .select('org_id')
      .eq('id', user.id)
      .single();

    if (userOrgError || !userOrgData) {
      throw new Error('Could not find user organization');
    }

    const orgId = userOrgData.org_id;
    logStep('Found user organization', { orgId });

    // Calculate week dates (Monday to Sunday)
    const { weekStart, weekEnd } = req.method === 'POST' ? 
      await req.json() : 
      getCurrentWeekDates();

    logStep('Processing week', { weekStart, weekEnd });

    // Check if report already exists for this week
    const { data: existingReport } = await supabase
      .from('weekly_reports')
      .select('id, status, file_path')
      .eq('org_id', orgId)
      .eq('week_start_date', weekStart)
      .single();

    if (existingReport) {
      if (existingReport.status === 'completed' && existingReport.file_path) {
        logStep('Report already exists', { reportId: existingReport.id });
        
        // Get signed URL for existing report
        const { data: signedUrl } = await supabase.storage
          .from('weekly-reports')
          .createSignedUrl(existingReport.file_path, 3600); // 1 hour expiry

        return new Response(JSON.stringify({
          success: true,
          status: 'completed',
          reportId: existingReport.id,
          downloadUrl: signedUrl?.signedUrl
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } else if (existingReport.status === 'generating') {
        return new Response(JSON.stringify({
          success: true,
          status: 'generating',
          reportId: existingReport.id
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Create new report record
    const { data: reportRecord, error: reportError } = await supabase
      .from('weekly_reports')
      .upsert({
        org_id: orgId,
        week_start_date: weekStart,
        week_end_date: weekEnd,
        status: 'generating'
      }, { onConflict: 'org_id, week_start_date' })
      .select()
      .single();

    if (reportError) {
      throw new Error(`Failed to create report record: ${reportError.message}`);
    }

    logStep('Created report record', { reportId: reportRecord.id });

    // Generate report data
    const reportData = await generateReportData(supabase, orgId, weekStart, weekEnd);
    
    // Create CSV content
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
      throw new Error(`Failed to upload report: ${uploadError.message}`);
    }

    // Update report record with completion
    const { error: updateError } = await supabase
      .from('weekly_reports')
      .update({
        status: 'completed',
        file_path: fileName,
        file_size_bytes: new TextEncoder().encode(csvContent).length,
        generated_at: new Date().toISOString(),
        metadata: {
          prompts_analyzed: reportData.prompts.length,
          total_responses: reportData.totalResponses,
          generation_duration_ms: Date.now() - new Date(reportRecord.created_at).getTime()
        }
      })
      .eq('id', reportRecord.id);

    if (updateError) {
      logStep('Warning: Failed to update report status', { error: updateError.message });
    }

    // Get signed URL for download
    const { data: signedUrl } = await supabase.storage
      .from('weekly-reports')
      .createSignedUrl(fileName, 3600); // 1 hour expiry

    logStep('Report generated successfully', { 
      reportId: reportRecord.id, 
      fileName,
      totalPrompts: reportData.prompts.length
    });

    return new Response(JSON.stringify({
      success: true,
      status: 'completed',
      reportId: reportRecord.id,
      downloadUrl: signedUrl?.signedUrl,
      metadata: {
        prompts_analyzed: reportData.prompts.length,
        total_responses: reportData.totalResponses
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    logStep('Error generating report', { error: error.message });
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function getCurrentWeekDates() {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Get Monday
  
  const monday = new Date(now);
  monday.setDate(now.getDate() + mondayOffset);
  monday.setHours(0, 0, 0, 0);
  
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  
  return {
    weekStart: monday.toISOString().split('T')[0],
    weekEnd: sunday.toISOString().split('T')[0]
  };
}

async function generateReportData(supabase: any, orgId: string, weekStart: string, weekEnd: string) {
  logStep('Generating report data', { orgId, weekStart, weekEnd });

  // Get prompts and their responses for the week
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

  // Aggregate data by prompt
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
        avgScore: 0,
        totalRuns: 0,
        brandPresentCount: 0,
        avgCompetitors: 0
      });
    }

    const promptData = promptMap.get(promptId);
    promptData.responses.push(response);
    promptData.totalRuns++;
    if (response.org_brand_present) {
      promptData.brandPresentCount++;
    }
  }

  // Calculate aggregations
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
    `"${prompt.text.replace(/"/g, '""')}"`, // Escape quotes in CSV
    prompt.totalRuns,
    prompt.avgScore.toFixed(2),
    prompt.brandPresentRate.toFixed(1),
    prompt.avgCompetitors.toFixed(1),
    prompt.brandPresentCount
  ]);

  // Add summary row
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