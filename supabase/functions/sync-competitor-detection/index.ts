import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client with service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    console.log('Starting competitor detection sync...');

    // Get all recent responses with competitors that haven't been synced
    const { data: responses, error: responsesError } = await supabase
      .from('prompt_provider_responses')
      .select(`
        id,
        org_id,
        competitors_json,
        score,
        run_at
      `)
      .not('competitors_json', 'is', null)
      .gte('run_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()) // Last 7 days
      .eq('status', 'success');

    if (responsesError) {
      console.error('Error fetching responses:', responsesError);
      throw responsesError;
    }

    console.log(`Found ${responses?.length || 0} responses to process`);

    let totalCompetitorsProcessed = 0;
    let competitorsAdded = 0;
    let competitorsUpdated = 0;

    // Process each response
    for (const response of responses || []) {
      if (!response.competitors_json || !Array.isArray(response.competitors_json)) {
        continue;
      }

      for (const competitor of response.competitors_json) {
        if (typeof competitor !== 'string' || competitor.trim().length < 2) {
          continue;
        }

        const competitorName = competitor.trim();
        totalCompetitorsProcessed++;

        try {
          // Check if competitor already exists in brand catalog
          const { data: existingBrand, error: checkError } = await supabase
            .from('brand_catalog')
            .select('id, total_appearances, average_score')
            .eq('org_id', response.org_id)
            .ilike('name', competitorName)
            .eq('is_org_brand', false)
            .single();

          if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = not found
            console.error('Error checking existing brand:', checkError);
            continue;
          }

          if (existingBrand) {
            // Update existing competitor
            const newAppearances = (existingBrand.total_appearances || 0) + 1;
            const currentAvgScore = existingBrand.average_score || 0;
            const newAvgScore = ((currentAvgScore * (existingBrand.total_appearances || 0)) + (response.score || 0)) / newAppearances;

            const { error: updateError } = await supabase
              .from('brand_catalog')
              .update({
                last_seen_at: response.run_at,
                total_appearances: newAppearances,
                average_score: newAvgScore
              })
              .eq('id', existingBrand.id);

            if (updateError) {
              console.error('Error updating brand:', updateError);
            } else {
              competitorsUpdated++;
              console.log(`Updated competitor: ${competitorName} (appearances: ${newAppearances})`);
            }
          } else {
            // Add new competitor
            const { error: insertError } = await supabase
              .from('brand_catalog')
              .insert({
                org_id: response.org_id,
                name: competitorName,
                is_org_brand: false,
                variants_json: [competitorName.toLowerCase()],
                first_detected_at: response.run_at,
                last_seen_at: response.run_at,
                total_appearances: 1,
                average_score: response.score || 0
              });

            if (insertError) {
              console.error('Error inserting brand:', insertError);
            } else {
              competitorsAdded++;
              console.log(`Added new competitor: ${competitorName}`);
            }
          }
        } catch (error) {
          console.error(`Error processing competitor ${competitorName}:`, error);
        }
      }
    }

    const result = {
      message: 'Competitor detection sync completed',
      totalCompetitorsProcessed,
      competitorsAdded,
      competitorsUpdated,
      responsesProcessed: responses?.length || 0,
      timestamp: new Date().toISOString()
    };

    console.log('Sync completed:', result);

    return new Response(
      JSON.stringify(result),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Competitor sync error:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Competitor sync failed',
        message: error.message,
        timestamp: new Date().toISOString()
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});