import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CRON_SECRET = Deno.env.get('CRON_SECRET');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Timezone-aware date utility functions
function nyParts(d = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  
  const parts = formatter.formatToParts(d);
  const yyyy = parts.find(part => part.type === 'year')?.value || '1970';
  const mm = parts.find(part => part.type === 'month')?.value || '01';
  const dd = parts.find(part => part.type === 'day')?.value || '01';
  const hh = parts.find(part => part.type === 'hour')?.value || '00';
  const mi = parts.find(part => part.type === 'minute')?.value || '00';
  const ss = parts.find(part => part.type === 'second')?.value || '00';
  
  return { yyyy, mm, dd, hh, mi, ss };
}

function todayKeyNY(d = new Date()): string {
  const { yyyy, mm, dd } = nyParts(d);
  return `${yyyy}-${mm}-${dd}`;
}

function isInExecutionWindow(d = new Date()): boolean {
  const { hh } = nyParts(d);
  const hour = Number(hh);
  // Allow execution window: 3:00 AM - 6:00 AM ET
  return hour >= 3 && hour < 6;
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Verify cron secret for security
  const cronSecret = req.headers.get('x-cron-secret');
  
  if (!cronSecret || !CRON_SECRET || cronSecret !== CRON_SECRET) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized - Invalid cron secret' }), 
      { status: 401, headers: corsHeaders }
    );
  }

  // Get current NY time info
  const now = new Date();
  const { yyyy, mm, dd, hh, mi } = nyParts(now);
  const todayKey = todayKeyNY(now);
  const nyTimeStr = `${yyyy}-${mm}-${dd} ${hh}:${mi} ET`;
  const inWindow = isInExecutionWindow(now);

  console.log(`Daily batch trigger called at ${nyTimeStr} (key: ${todayKey})`);
  console.log(`Execution window check: ${inWindow ? '✅ In window (3-6 AM ET)' : '⚠️ Outside window'}`);

  // Execution window guard - only run during scheduled hours unless manual override
  if (!inWindow) {
    const isManualOverride = req.headers.get('x-manual-override') === 'true';
    if (!isManualOverride) {
      console.log('⏰ Outside execution window, skipping run');
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Outside execution window (3-6 AM ET), run skipped',
        currentTime: nyTimeStr,
        executionWindow: '3:00-6:00 AM ET'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } else {
      console.log('🔧 Manual override detected, proceeding despite time window');
    }
  }

  try {
    // Use the standardized RPC function for duplicate prevention
    const { data: runCheck, error: runCheckError } = await supabase
      .rpc('try_mark_daily_run', { p_today_key: todayKey });

    if (runCheckError) {
      console.error('Error checking/updating scheduler state:', runCheckError);
      throw runCheckError;
    }

    console.log('Daily run check result:', runCheck);

    // If we didn't update (already ran today), skip
    if (!runCheck.updated) {
      console.log(`Daily batch already ran for ${todayKey} (previous: ${runCheck.previous_key})`);
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Daily batch already completed today',
        date: todayKey,
        previousRun: runCheck.previous_key,
        skipped: true,
        currentTime: nyTimeStr
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }


    console.log(`Starting daily batch trigger for ${todayKey} at ${nyTimeStr}`);

    // Get all organizations with active prompts
    const { data: orgs } = await supabase
      .from('organizations')
      .select(`
        id,
        name,
        prompts!inner(id)
      `)
      .eq('prompts.active', true);

    if (!orgs || orgs.length === 0) {
      console.log('No organizations with active prompts found');
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No organizations to process',
        date: todayKey,
        currentTime: nyTimeStr
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let totalBatchJobs = 0;
    let successfulJobs = 0;
    const orgResults: any[] = [];

    // Trigger batch processor for each org
    for (const org of orgs) {
      try {
        console.log(`Triggering batch processor for org ${org.id} (${org.name})`);
        
        const { data, error } = await supabase.functions.invoke('robust-batch-processor', {
          body: { orgId: org.id }
        });

        if (error) {
          console.error(`Failed to trigger batch for org ${org.id}:`, error);
          orgResults.push({
            orgId: org.id,
            orgName: org.name,
            success: false,
            error: error.message
          });
        } else {
          console.log(`Successfully triggered batch for org ${org.id}`);
          successfulJobs++;
          orgResults.push({
            orgId: org.id,
            orgName: org.name,
            success: true,
            data
          });
        }
        
        totalBatchJobs++;

        // Small delay to avoid overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (orgError) {
        console.error(`Error processing org ${org.id}:`, orgError);
        totalBatchJobs++;
        orgResults.push({
          orgId: org.id,
          orgName: org.name,
          success: false,
          error: orgError instanceof Error ? orgError.message : String(orgError)
        });
      }
    }

    const result = {
      success: true,
      date: todayKey,
      currentTime: nyTimeStr,
      totalOrgs: totalBatchJobs,
      successfulJobs,
      message: `Triggered batch processing for ${successfulJobs}/${totalBatchJobs} organizations`,
      orgResults
    };

    console.log(`Daily batch trigger completed:`, result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Daily batch trigger error:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message,
      date: todayKey,
      currentTime: nyTimeStr
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});