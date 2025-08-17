import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { buildRecommendations } from '../_shared/reco/engine.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { accountId } = await req.json();

    if (!accountId) {
      return new Response(JSON.stringify({ error: 'Missing accountId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Generating recommendations for account ${accountId}`);
    
    // Use the sophisticated recommendation engine
    const recommendations = await buildRecommendations(supabase, accountId);
    
    if (recommendations.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        created: 0, 
        message: 'No actionable insights found in recent data' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Store recommendations using the reco_upsert function
    let created = 0;
    for (const reco of recommendations) {
      try {
        const { error } = await supabase.rpc('reco_upsert', {
          p_org_id: accountId,
          p_kind: reco.kind,
          p_title: reco.title,
          p_rationale: reco.rationale,
          p_steps: reco.steps,
          p_est_lift: reco.estLift,
          p_source_prompt_ids: reco.sourcePromptIds,
          p_source_run_ids: reco.sourceRunIds,
          p_citations: reco.citations,
          p_cooldown_days: reco.cooldownDays || 14
        });

        if (error) {
          console.error('Error upserting recommendation:', error);
        } else {
          created++;
        }
      } catch (error) {
        console.error('Error processing recommendation:', error);
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      created,
      total: recommendations.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in reco-refresh:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message,
      created: 0
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});