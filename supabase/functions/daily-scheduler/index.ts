import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SchedulerState {
  id: string;
  last_daily_run_key: string | null;
  last_daily_run_at: string | null;
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

    // Get current date in America/New_York timezone
    const nyTime = new Date().toLocaleString("en-US", {
      timeZone: "America/New_York",
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    
    const todayKey = nyTime.split(',')[0].split('/').reverse().join('-'); // Convert MM/DD/YYYY to YYYY-MM-DD
    
    console.log(`Daily scheduler triggered for ${todayKey} (NY time: ${nyTime})`);

    // Check if we've already run today - use atomic update for concurrency safety
    const { data: updateResult, error: updateError } = await supabase
      .from('scheduler_state')
      .update({
        last_daily_run_key: todayKey,
        last_daily_run_at: new Date().toISOString()
      })
      .eq('id', 'global')
      .neq('last_daily_run_key', todayKey) // Only update if different day
      .select();

    if (updateError) {
      console.error('Error updating scheduler state:', updateError);
      throw updateError;
    }

    // If no rows were updated, we already ran today
    if (!updateResult || updateResult.length === 0) {
      console.log('Daily run already completed for', todayKey);
      return new Response(
        JSON.stringify({ 
          message: 'Daily run already completed',
          date: todayKey,
          skipped: true
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );
    }

    console.log('Starting daily prompt runs for', todayKey);

    // Get all organizations
    const { data: organizations, error: orgError } = await supabase
      .from('organizations')
      .select('id, name');

    if (orgError) {
      console.error('Error fetching organizations:', orgError);
      throw orgError;
    }

    console.log(`Found ${organizations?.length || 0} organizations to process`);

    let totalRuns = 0;
    let successfulRuns = 0;

    // Process each organization
    for (const org of organizations || []) {
      try {
        console.log(`Processing organization: ${org.name} (${org.id})`);

        // Get active prompts for this organization
        const { data: prompts, error: promptsError } = await supabase
          .from('prompts')
          .select('id, text, org_id')
          .eq('org_id', org.id)
          .eq('active', true);

        if (promptsError) {
          console.error(`Error fetching prompts for org ${org.id}:`, promptsError);
          continue;
        }

        console.log(`Found ${prompts?.length || 0} active prompts for ${org.name}`);

        // Get enabled providers
        const { data: providers, error: providersError } = await supabase
          .from('llm_providers')
          .select('id, name')
          .eq('enabled', true);

        if (providersError) {
          console.error('Error fetching providers:', providersError);
          continue;
        }

        // Run each prompt on each provider
        for (const prompt of prompts || []) {
          for (const provider of providers || []) {
            try {
              totalRuns++;

              // Call the existing run-prompt-now function for each prompt/provider combination
              const { data: runResult, error: runError } = await supabase.functions.invoke('run-prompt-now', {
                body: {
                  promptId: prompt.id,
                  providerId: provider.id
                }
              });

              if (runError) {
                console.error(`Failed to run prompt ${prompt.id} on ${provider.name}:`, runError);
              } else {
                successfulRuns++;
                console.log(`Successfully ran prompt "${prompt.text}" on ${provider.name}`);
              }

              // Small delay to prevent overwhelming the providers
              await new Promise(resolve => setTimeout(resolve, 1000));

            } catch (error) {
              console.error(`Error running prompt ${prompt.id} on provider ${provider.name}:`, error);
            }
          }
        }

      } catch (error) {
        console.error(`Error processing organization ${org.id}:`, error);
      }
    }

    const result = {
      message: 'Daily run completed',
      date: todayKey,
      totalRuns,
      successfulRuns,
      organizations: organizations?.length || 0,
      timestamp: new Date().toISOString()
    };

    console.log('Daily scheduler completed:', result);

    return new Response(
      JSON.stringify(result),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Daily scheduler error:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Daily scheduler failed',
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