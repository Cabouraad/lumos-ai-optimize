import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { runDailyScan } from "../_shared/visibility/runDailyScan.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Get current date in America/New_York timezone
function todayKeyNY(d = new Date()): string {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  const parts = fmt.formatToParts(d);
  const year = parts.find(p => p.type === 'year')?.value;
  const month = parts.find(p => p.type === 'month')?.value;
  const day = parts.find(p => p.type === 'day')?.value;
  return `${year}-${month}-${day}`;
}

// Check if it's past 3 AM in America/New_York timezone
function isPastThreeAMNY(d = new Date()): boolean {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    hour12: false
  });
  const hour = parseInt(fmt.format(d));
  return hour >= 3;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Parse request body for test overrides
  let requestBody: any = {};
  try {
    if (req.method === 'POST' && req.headers.get('content-type')?.includes('application/json')) {
      requestBody = await req.json();
    }
  } catch (e) {
    // Ignore JSON parsing errors for non-JSON requests
  }

  // Check for test override or manual admin run
  const isTestMode = requestBody?.test === true;
  const isManualRun = requestBody?.manualRun === true;
  const testOrganizationId = requestBody?.organizationId;

  console.log(`Daily scan function invoked ${isTestMode ? '(TEST MODE)' : isManualRun ? '(MANUAL RUN)' : 'by scheduler'} at`, new Date().toISOString());

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Ensure scheduler_state 'global' row exists to avoid lockout on first run
    try {
      const { error: ensureErr } = await supabase
        .from("scheduler_state")
        .upsert({ id: "global" }, { onConflict: "id", ignoreDuplicates: true });
      if (ensureErr) {
        console.warn("Could not ensure scheduler_state row:", ensureErr.message);
      }
    } catch (e) {
      console.warn("Error ensuring scheduler_state row:", e);
    }

    // Skip time gate in test mode or manual admin runs
    if (!isTestMode && !isManualRun && !isPastThreeAMNY()) {
      const currentTime = new Date().toLocaleString("en-US", {
        timeZone: "America/New_York",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true
      });
      console.log(`Outside time window - before 3:00 AM ET (current: ${currentTime})`);
      return new Response(
        JSON.stringify({ 
          status: "outside-window", 
          currentTimeET: currentTime,
          message: "Runs only after 3:00 AM Eastern Time" 
        }),
        { 
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200
        }
      );
    }

    // Read current state for idempotency (skip in test mode and manual runs)
    const key = isTestMode ? `test-${Date.now()}` : isManualRun ? `manual-${Date.now()}` : todayKeyNY();
    console.log(`Checking for key: ${key}${isTestMode ? ' (TEST MODE)' : isManualRun ? ' (MANUAL RUN)' : ''}`);
    
    if (!isTestMode && !isManualRun) {
      const { data: state } = await supabase
        .from("scheduler_state")
        .select("*")
        .eq("id", "global")
        .single();

      if (state && state.last_daily_run_key === key) {
        console.log(`Already ran today: ${key}`);
        return new Response(
          JSON.stringify({ 
            status: "already-ran", 
            key,
            lastRun: state.last_daily_run_at 
          }),
          { 
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200
          }
        );
      }
    }

    // Update scheduler state (skip mutex logic in test mode and manual runs)
    if (!isTestMode && !isManualRun) {
      const { data: updateResult, error: updateError } = await supabase
        .from("scheduler_state")
        .update({ 
          last_daily_run_key: key, 
          last_daily_run_at: new Date().toISOString() 
        })
        .eq("id", "global")
        .neq("last_daily_run_key", key) // Only update if different day
        .select();

      if (updateError) {
        console.error('Failed to claim mutex:', updateError);
        return new Response(
          JSON.stringify({ status: "mutex-failed", error: updateError.message }),
          { 
            status: 409, 
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          }
        );
      }

      // If no rows were updated, check actual state to disambiguate
      if (!updateResult || updateResult.length === 0) {
        const { data: refreshed } = await supabase
          .from("scheduler_state")
          .select("last_daily_run_key, last_daily_run_at")
          .eq("id", "global")
          .single();
        if (refreshed?.last_daily_run_key === key) {
          console.log(`Already ran today (post-check): ${key}`);
          return new Response(
            JSON.stringify({ status: "already-ran", key, lastRun: refreshed.last_daily_run_at }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
          );
        }
        console.log('Another instance already claimed the run (locked)');
        return new Response(
          JSON.stringify({ status: "locked", key }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
      }
    }

    console.log(`${isTestMode ? 'Test mode:' : isManualRun ? 'Manual run:' : 'Successfully claimed daily run,'} starting scan...`);
    
    // Use the existing runDailyScan function with optional organization filter
    const result = await runDailyScan(supabase, testOrganizationId);

    console.log('Daily scan completed:', result);

    return new Response(
      JSON.stringify({ 
        status: "success", 
        testMode: isTestMode,
        manualRun: isManualRun,
        organizationId: testOrganizationId,
        key,
        timestamp: new Date().toISOString(),
        result
      }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200
      }
    );

  } catch (e) {
    console.error('Daily scan function error:', e);
    return new Response(
      JSON.stringify({ 
        status: "error", 
        message: String(e),
        timestamp: new Date().toISOString()
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});