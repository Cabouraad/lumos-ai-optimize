import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Organization {
  id: string;
  name: string;
}

interface Prompt {
  id: string;
  text: string;
  org_id: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Daily scheduler started at:', new Date().toISOString());

    // Get current date in America/New_York timezone
    const nyTime = new Date().toLocaleString('en-US', { 
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    const todayKey = nyTime.replace(/(\d+)\/(\d+)\/(\d+)/, '$3-$1-$2'); // Convert MM/DD/YYYY to YYYY-MM-DD

    console.log('Today key (NY timezone):', todayKey);

    // Check if we've already run today
    const { data: schedulerState, error: stateError } = await supabase
      .from('scheduler_state')
      .select('*')
      .eq('id', 'global')
      .single();

    if (stateError) {
      console.error('Error fetching scheduler state:', stateError);
      throw stateError;
    }

    if (schedulerState?.last_daily_run_key === todayKey) {
      console.log('Already ran today, skipping...');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Already ran today',
          last_run_key: todayKey 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );
    }

    // Use a transaction-like approach to prevent double execution
    const { data: updateResult, error: updateError } = await supabase
      .from('scheduler_state')
      .update({
        last_daily_run_key: todayKey,
        last_daily_run_at: new Date().toISOString()
      })
      .eq('id', 'global')
      .neq('last_daily_run_key', todayKey) // Only update if we haven't run today
      .select();

    if (updateError || !updateResult || updateResult.length === 0) {
      console.log('Another instance is running or already completed today');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Another instance handled today\'s run' 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );
    }

    console.log('Starting daily prompt runs...');

    // Get all organizations
    const { data: organizations, error: orgError } = await supabase
      .from('organizations')
      .select('id, name');

    if (orgError) {
      console.error('Error fetching organizations:', orgError);
      throw orgError;
    }

    console.log(`Found ${organizations?.length || 0} organizations`);

    let totalRuns = 0;
    const results = [];

    // Process each organization
    for (const org of organizations || []) {
      try {
        console.log(`Processing organization: ${org.name} (${org.id})`);

        // Get active prompts for this org
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

        // Run each prompt with each enabled provider
        for (const prompt of prompts || []) {
          for (const provider of providers || []) {
            try {
              console.log(`Running prompt "${prompt.text}" with ${provider.name}`);

              // Call the existing run-prompt-now function for each combination
              const { data: runResult, error: runError } = await supabase.functions.invoke(
                'run-prompt-now',
                {
                  body: {
                    promptId: prompt.id,
                    providerId: provider.id
                  }
                }
              );

              if (runError) {
                console.error(`Error running prompt ${prompt.id} with provider ${provider.id}:`, runError);
              } else {
                totalRuns++;
                console.log(`Successfully ran prompt ${prompt.id} with ${provider.name}`);
              }
            } catch (error) {
              console.error(`Exception running prompt ${prompt.id}:`, error);
            }
          }
        }

        results.push({
          org_id: org.id,
          org_name: org.name,
          prompts_count: prompts?.length || 0
        });

      } catch (error) {
        console.error(`Error processing organization ${org.id}:`, error);
      }
    }

    console.log(`Daily scheduler completed. Total runs: ${totalRuns}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Daily scheduler completed successfully`,
        date: todayKey,
        total_runs: totalRuns,
        organizations_processed: results.length,
        results
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error) {
    console.error('Daily scheduler error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});