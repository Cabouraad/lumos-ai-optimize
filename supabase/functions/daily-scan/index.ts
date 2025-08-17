import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { todayKeyNY, isPastThreeAMNY } from "../_shared/time.ts";
import { runDailyScan } from "../_shared/visibility/runDailyScan.ts";
import { buildRecommendations } from "../_shared/reco/engine.ts";
import { upsertRecommendations } from "../_shared/reco/persist.ts";

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

    console.log('Daily scan function triggered');

    // Idempotency gate: only after 3:00 AM ET
    if (!isPastThreeAMNY()) {
      console.log('Outside time window - before 3:00 AM ET');
      return new Response(
        JSON.stringify({ status: "outside-window" }),
        { 
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200
        }
      );
    }

    // Read current state
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
        JSON.stringify({ status: "already-ran", key }),
        { 
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200
        }
      );
    }

    // Lightweight mutex: only one runner flips the key
    const { data: before } = await supabase
      .from("scheduler_state")
      .select("last_daily_run_key")
      .eq("id", "global")
      .single();

    if (before && before.last_daily_run_key === key) {
      console.log('Another instance already claimed the run');
      return new Response(
        JSON.stringify({ status: "locked" }),
        { 
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200
        }
      );
    }

    // Claim the run
    console.log('Claiming daily run...');
    const { error: upErr } = await supabase
      .from("scheduler_state")
      .update({ 
        last_daily_run_key: key, 
        last_daily_run_at: new Date().toISOString() 
      })
      .eq("id", "global");

    if (upErr) {
      console.error('Failed to claim mutex:', upErr);
      return new Response(
        JSON.stringify({ status: "mutex-failed", error: upErr.message }),
        { 
          status: 409, 
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    console.log('Running daily scan...');
    
    // Run the daily scan (respects caching/limits to minimize LLM calls)
    const result = await runDailyScan(supabase);

    console.log('Daily scan result:', result);

    // Generate recommendations after daily scan completes (ensures fresh data)
    console.log('Generating recommendations for organizations...');
    let recommendationsGenerated = 0;
    
    if (result.success) {
      try {
        // Get all organizations that need recommendations
        const { data: organizations } = await supabase
          .from('organizations')
          .select('id, name')
          .order('name');

        if (organizations && organizations.length > 0) {
          for (const org of organizations) {
            try {
              console.log(`Generating recommendations for org: ${org.name}`);
              
              // Build recommendations using fresh scan data
              const recos = await buildRecommendations(supabase, org.id);
              
              if (recos.length > 0) {
                console.log(`Generated ${recos.length} recommendations for ${org.name}`);
                
                // Persist recommendations with cooldown logic
                await upsertRecommendations(supabase, org.id, recos);
                recommendationsGenerated += recos.length;
              } else {
                console.log(`No recommendations generated for ${org.name}`);
              }
              
            } catch (orgError) {
              console.error(`Error generating recommendations for org ${org.id}:`, orgError);
            }
          }
        }
      } catch (recoError) {
        console.error('Error in recommendation generation:', recoError);
      }
    }

    console.log(`Recommendations generation completed: ${recommendationsGenerated} total`);

    return new Response(
      JSON.stringify({ 
        status: "ok", 
        key,
        result: {
          ...result,
          recommendationsGenerated
        }
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
        message: String(e) 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});