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

  // Authenticate with CRON_SECRET
  const cronSecret = Deno.env.get("CRON_SECRET");
  const auth = req.headers.get("authorization");
  
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }), 
      { 
        status: 401, 
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Daily scan function triggered at', new Date().toISOString());

    // Idempotency gate using Eastern Time
    if (!isPastThreeAMNY()) {
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

    // Read current state for idempotency
    const key = todayKeyNY();
    console.log(`Checking for today's key: ${key}`);
    
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

    // Lightweight mutex: atomic update to claim the run
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

    // If no rows were updated, another instance already claimed it
    if (!updateResult || updateResult.length === 0) {
      console.log('Another instance already claimed the run');
      return new Response(
        JSON.stringify({ status: "locked", key }),
        { 
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200
        }
      );
    }

    console.log('Successfully claimed daily run, starting scan...');
    
    // Use the existing runDailyScan function
    const result = await runDailyScan(supabase);

    console.log('Daily scan completed:', result);

    return new Response(
      JSON.stringify({ 
        status: "success", 
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