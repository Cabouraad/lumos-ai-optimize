import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { buildRecommendations } from '../_shared/reco/engine.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

    // Store recommendations directly (bypassing problematic reco_upsert function)
    let created = 0;
    for (const reco of recommendations) {
      try {
        // Check for existing recommendation within cooldown period
        const cooldownDate = new Date();
        cooldownDate.setDate(cooldownDate.getDate() - (reco.cooldownDays || 14));
        
        const { data: existing } = await supabase
          .from('recommendations')
          .select('id')
          .eq('org_id', accountId)
          .eq('type', reco.kind)
          .eq('title', reco.title)
          .in('status', ['open', 'snoozed'])
          .gte('created_at', cooldownDate.toISOString())
          .limit(1);

        if (!existing || existing.length === 0) {
          // Insert new recommendation directly
          const { error: insertError } = await supabase
            .from('recommendations')
            .insert({
              org_id: accountId,
              type: reco.kind,
              title: reco.title,
              rationale: reco.rationale,
              status: 'open',
              metadata: {
                steps: reco.steps,
                estLift: reco.estLift,
                sourcePromptIds: reco.sourcePromptIds,
                sourceRunIds: reco.sourceRunIds,
                citations: reco.citations,
                cooldownDays: reco.cooldownDays || 14
              }
            });

          if (insertError) {
            console.error('Error inserting recommendation:', insertError);
          } else {
            created++;
            console.log(`Created recommendation: ${reco.title}`);
          }
        } else {
          console.log(`Skipping duplicate recommendation: ${reco.title}`);
        }
      } catch (error: unknown) {
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

  } catch (error: unknown) {
    console.error('Error in reco-refresh:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error instanceof Error ? error.message : String(error),
      created: 0
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});