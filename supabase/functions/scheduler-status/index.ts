import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get scheduler state using service role (bypasses RLS)
    const { data: state, error } = await supabase
      .from("scheduler_state")
      .select("*")
      .eq("id", "global")
      .single();

    if (error) {
      console.error('Failed to load scheduler state:', error);
      return new Response(
        JSON.stringify({ 
          error: "Failed to load scheduler state",
          details: error.message 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    // Return scheduler status for UI display
    return new Response(
      JSON.stringify({
        id: state.id,
        last_daily_run_key: state.last_daily_run_key,
        last_daily_run_at: state.last_daily_run_at,
        created_at: state.created_at,
        updated_at: state.updated_at,
        status: "active"
      }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200
      }
    );

  } catch (e) {
    console.error('Scheduler status function error:', e);
    return new Response(
      JSON.stringify({ 
        error: "Internal server error",
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