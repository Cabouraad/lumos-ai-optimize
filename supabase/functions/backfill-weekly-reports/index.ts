import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[BACKFILL-WEEKLY] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Verify authorization - require service role for backfill
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    logStep('Unauthorized request - Bearer token required');
    return new Response(JSON.stringify({
      success: false,
      error: 'Unauthorized - Bearer token required'
    }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    logStep('Starting weekly reports backfill');

    // Get request body to see if specific week requested
    const body = await req.json().catch(() => ({}));
    const forceWeek = body.week; // Optional: YYYY-MM-DD format for specific week start

    // Calculate last week's dates if no specific week provided
    let weekStart, weekEnd, weekKey;
    
    if (forceWeek) {
      const startDate = new Date(forceWeek);
      weekStart = startDate.toISOString().split('T')[0];
      const endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 6);
      weekEnd = endDate.toISOString().split('T')[0];
      
      const year = startDate.getFullYear();
      const weekNumber = getISOWeek(startDate);
      weekKey = `${year}-W${weekNumber.toString().padStart(2, '0')}`;
    } else {
      // Use last complete week
      const now = new Date();
      const currentDay = now.getDay();
      const daysToLastMonday = currentDay === 0 ? 7 : currentDay;
      const lastMonday = new Date(now);
      lastMonday.setDate(now.getDate() - daysToLastMonday - 7);
      lastMonday.setHours(0, 0, 0, 0);
      
      const lastSunday = new Date(lastMonday);
      lastSunday.setDate(lastMonday.getDate() + 6);
      lastSunday.setHours(23, 59, 59, 999);

      weekStart = lastMonday.toISOString().split('T')[0];
      weekEnd = lastSunday.toISOString().split('T')[0];
      
      const year = lastMonday.getFullYear();
      const weekNumber = getISOWeek(lastMonday);
      weekKey = `${year}-W${weekNumber.toString().padStart(2, '0')}`;
    }

    logStep('Backfilling for week', { weekStart, weekEnd, weekKey });

    // Trigger both weekly report functions
    const results = [];

    // 1. Trigger CSV reports (weekly-report-scheduler)
    logStep('Triggering CSV report generation');
    const csvResponse = await supabase.functions.invoke('weekly-report-scheduler', {
      body: { 
        backfill: true, 
        weekStart, 
        weekEnd,
        timestamp: new Date().toISOString()
      },
      headers: {
        'x-cron-secret': Deno.env.get('CRON_SECRET')
      }
    });

    if (csvResponse.error) {
      logStep('CSV generation failed', csvResponse.error);
      results.push({ type: 'CSV', success: false, error: csvResponse.error.message });
    } else {
      logStep('CSV generation completed', csvResponse.data);
      results.push({ type: 'CSV', success: true, data: csvResponse.data });
    }

    // 2. Trigger PDF reports (weekly-report)
    logStep('Triggering PDF report generation');
    const pdfResponse = await supabase.functions.invoke('weekly-report', {
      method: 'POST',
      body: {
        backfill: true,
        weekStart,
        weekEnd,
        timestamp: new Date().toISOString()
      },
      headers: {
        'Authorization': `Bearer ${Deno.env.get('CRON_SECRET')}`
      }
    });

    if (pdfResponse.error) {
      logStep('PDF generation failed', pdfResponse.error);
      results.push({ type: 'PDF', success: false, error: pdfResponse.error.message });
    } else {
      logStep('PDF generation completed', pdfResponse.data);
      results.push({ type: 'PDF', success: true, data: pdfResponse.data });
    }

    const successCount = results.filter((r: any) => r.success).length;
    const failureCount = results.filter((r: any) => !r.success).length;

    logStep('Backfill completed', { 
      weekKey,
      successCount, 
      failureCount,
      results: results.map(r => ({ type: r.type, success: r.success }))
    });

    return new Response(JSON.stringify({
      success: successCount > 0,
      week_key: weekKey,
      week_start: weekStart,
      week_end: weekEnd,
      results,
      summary: {
        successful: successCount,
        failed: failureCount,
        total: results.length
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    logStep('Error in backfill', { error: error.message });
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Helper function to calculate ISO week number
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