/**
 * Weekly Report Generation Edge Function
 * Handles on-demand report generation and retrieval for authenticated users
 * Also supports scheduled runs via CRON_SECRET
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';
import { collectWeeklyData } from '../_shared/report/collect.ts';
import { renderReportPDF } from '../_shared/report/pdf.ts';
import { getStrictCorsHeaders } from '../_shared/cors.ts';

interface WeekBoundaries {
  weekKey: string;
  periodStart: string;
  periodEnd: string;
}

/**
 * Calculate ISO week boundaries for the most recent complete week
 */
function getLastCompleteWeek(): WeekBoundaries {
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
  
  // Generate ISO week key (YYYY-Www)
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

/**
 * Parse ISO week string and return boundaries
 */
function parseWeekKey(weekKey: string): WeekBoundaries | null {
  const match = weekKey.match(/^(\d{4})-W(\d{2})$/);
  if (!match) return null;
  
  const year = parseInt(match[1]);
  const week = parseInt(match[2]);
  
  // Calculate first day of the year
  const jan1 = new Date(year, 0, 1);
  const daysToFirstMonday = (8 - jan1.getDay()) % 7;
  
  // Calculate the Monday of the specified week
  const firstMonday = new Date(jan1);
  firstMonday.setDate(jan1.getDate() + daysToFirstMonday + (week - 1) * 7);
  
  const monday = new Date(firstMonday);
  monday.setHours(0, 0, 0, 0);
  
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  
  return {
    weekKey,
    periodStart: monday.toISOString().split('T')[0],
    periodEnd: sunday.toISOString().split('T')[0],
  };
}

Deno.serve(async (req) => {
  const requestOrigin = req.headers.get('origin');
  const corsHeaders = getStrictCorsHeaders(requestOrigin);

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client with service role for database operations
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Authentication handling: CRON_SECRET required for all requests
    const authHeader = req.headers.get('Authorization');
    const cronSecret = Deno.env.get('CRON_SECRET');
    const isScheduledRun = authHeader === `Bearer ${cronSecret}` && cronSecret;

    if (!isScheduledRun) {
      console.log('[WEEKLY-REPORT] Unauthorized request - CRON_SECRET required');
      return new Response(
        JSON.stringify({ error: 'Unauthorized. Reports are generated automatically.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Scheduled run: process all organizations
    console.log('[WEEKLY-REPORT] Processing scheduled run for all organizations');
    
    // Log scheduler run start
    const { data: schedulerRun, error: logError } = await supabase
      .from('scheduler_runs')
      .insert({
        run_key: 'weekly-pdf-' + new Date().toISOString().split('T')[0],
        function_name: 'weekly-report',
        status: 'running'
      })
      .select()
      .single();

    if (logError) {
      console.error('[WEEKLY-REPORT] Failed to log scheduler run start:', logError);
    }
    
    const { data: orgs, error: orgsError } = await supabase
      .from('organizations')
      .select('id')
      .order('created_at');

    if (orgsError) {
      console.error('[WEEKLY-REPORT] Error fetching organizations:', orgsError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch organizations' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const targetOrgIds = orgs?.map(org => org.id) || [];
    console.log(`[WEEKLY-REPORT] Found ${targetOrgIds.length} organizations to process`);

    if (req.method === 'POST') {
      // Handle POST request - generate new report(s)
      const results: any[] = [];
      const errors: any[] = [];

      // Calculate last complete week boundaries
      const { weekKey, periodStart, periodEnd } = getLastCompleteWeek();

      console.log(`[WEEKLY-REPORT] Generating reports for week ${weekKey} (${periodStart} to ${periodEnd})`);
      console.log(`[WEEKLY-REPORT] Processing ${targetOrgIds.length} organization(s)`);

      // Process each organization
      for (const orgId of targetOrgIds) {
        try {
          console.log(`[WEEKLY-REPORT] Processing org ${orgId}`);

          // Check if report already exists
          const { data: existingReport, error: checkError } = await supabase
            .from('reports')
            .select('storage_path, week_key')
            .eq('org_id', orgId)
            .eq('week_key', weekKey)
            .maybeSingle();

          if (checkError) {
            console.error(`[WEEKLY-REPORT] Database check error for org ${orgId}:`, checkError);
            errors.push({ orgId, error: 'Database check failed', details: checkError.message });
            continue;
          }

          if (existingReport) {
            console.log(`[WEEKLY-REPORT] Report already exists for org ${orgId}, week ${weekKey}`);
            results.push({
              orgId,
              week_key: weekKey,
              storage_path: existingReport.storage_path,
              status: 'exists',
            });
            continue;
          }

          // Collect weekly data
          console.log(`[WEEKLY-REPORT] Collecting weekly data for org ${orgId}...`);
          const reportData = await collectWeeklyData(supabase, orgId, periodStart + 'T00:00:00Z', periodEnd + 'T23:59:59Z');

          // Generate PDF
          console.log(`[WEEKLY-REPORT] Rendering PDF for org ${orgId}...`);
          const pdfBytes = await renderReportPDF(reportData);

          // Calculate storage path and metadata
          const storagePath = `reports/${orgId}/${weekKey}.pdf`;
          const fileSize = pdfBytes.length;
          const sha256Hash = await generateSHA256(pdfBytes);

          // Upload to storage
          console.log(`[WEEKLY-REPORT] Uploading to storage: ${storagePath}`);
          const { error: uploadError } = await supabase.storage
            .from('reports')
            .upload(storagePath.replace('reports/', ''), pdfBytes, {
              contentType: 'application/pdf',
              upsert: true,
            });

          if (uploadError) {
            console.error(`[WEEKLY-REPORT] Storage upload error for org ${orgId}:`, uploadError);
            errors.push({ orgId, error: 'Storage upload failed', details: uploadError.message });
            continue;
          }

          // Insert record into reports table
          const { error: insertError } = await supabase
            .from('reports')
            .insert({
              org_id: orgId,
              week_key: weekKey,
              period_start: periodStart,
              period_end: periodEnd,
              storage_path: storagePath,
              byte_size: fileSize,
              sha256: sha256Hash,
            });

          if (insertError) {
            console.error(`[WEEKLY-REPORT] Database insert error for org ${orgId}:`, insertError);
            // Try to clean up uploaded file
            await supabase.storage.from('reports').remove([storagePath.replace('reports/', '')]);
            errors.push({ orgId, error: 'Database insert failed', details: insertError.message });
            continue;
          }

          console.log(`[WEEKLY-REPORT] Report generation completed for org ${orgId}, week ${weekKey}`);
          
          results.push({
            orgId,
            week_key: weekKey,
            storage_path: storagePath,
            period_start: periodStart,
            period_end: periodEnd,
            file_size: fileSize,
            sha256: sha256Hash,
            status: 'created',
          });

        } catch (orgError) {
          console.error(`[WEEKLY-REPORT] Unexpected error for org ${orgId}:`, orgError);
          errors.push({ orgId, error: 'Unexpected error', details: orgError.message });
        }
      }

      // Return summary of all operations
      const successCount = results.length;
      const errorCount = errors.length;
      
      console.log(`[WEEKLY-REPORT] Scheduled run completed: ${successCount} successful, ${errorCount} errors`);
      
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
          ok: true,
          scheduled_run: true,
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
      JSON.stringify({ error: 'Only scheduled POST requests allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[WEEKLY-REPORT] Unexpected error:', error);
    
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
    
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});