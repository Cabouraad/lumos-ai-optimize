import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { manualRun, organizationId } = await req.json();

    console.log('Starting prompt execution run...');

    // Get all organizations (or specific one if provided)
    let orgQuery = supabase.from('organizations').select('id, name');
    if (organizationId) {
      orgQuery = orgQuery.eq('id', organizationId);
    }

    const { data: organizations, error: orgError } = await orgQuery;
    
    if (orgError) {
      throw new Error(`Failed to fetch organizations: ${orgError.message}`);
    }

    if (!organizations || organizations.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No organizations found',
          organizations: 0,
          totalRuns: 0,
          successfulRuns: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let totalRuns = 0;
    let successfulRuns = 0;

    // Process each organization
    for (const org of organizations) {
      console.log(`Processing org: ${org.name}`);

      // Get active prompts for this org
      const { data: prompts } = await supabase
        .from('prompts')
        .select('id, text')
        .eq('org_id', org.id)
        .eq('active', true);

      if (!prompts || prompts.length === 0) {
        console.log(`No active prompts for ${org.name}`);
        continue;
      }

      console.log(`Found ${prompts.length} active prompts for ${org.name}`);

      // Run each prompt
      for (const prompt of prompts) {
        try {
          const result = await runPrompt(prompt.id, org.id, supabase);
          totalRuns++;
          if (result.success) {
            successfulRuns += result.runsCreated;
            console.log(`Successfully processed prompt ${prompt.id}`);
          } else {
            console.error(`Failed to process prompt ${prompt.id}: ${result.error}`);
          }
        } catch (error) {
          console.error(`Error processing prompt ${prompt.id}:`, error);
          totalRuns++;
        }

        // Small delay between prompts
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    const result = {
      success: true,
      organizations: organizations.length,
      totalRuns,
      successfulRuns,
      timestamp: new Date().toISOString()
    };

    console.log('Run completed:', result);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Run all prompts error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Run a single prompt across all enabled providers
 */
async function runPrompt(promptId: string, orgId: string, supabase: any) {
  try {
    // Get prompt text
    const { data: prompt } = await supabase
      .from('prompts')
      .select('text')
      .eq('id', promptId)
      .single();

    if (!prompt) {
      return { success: false, error: 'Prompt not found' };
    }

    // Get enabled providers
    const { data: providers } = await supabase
      .from('llm_providers')
      .select('id, name')
      .eq('enabled', true);

    if (!providers || providers.length === 0) {
      return { success: false, error: 'No enabled providers' };
    }

    let runsCreated = 0;

    // Run prompt on each provider
    for (const provider of providers) {
        try {
          // Call the execute-prompt edge function for each provider
          const { data: executeResult, error } = await supabase.functions.invoke('execute-prompt', {
            body: {
              promptText: prompt.text,
              provider: provider.name,
              orgId,
              promptId
            }
          });

          if (error || !executeResult) {
            console.error(`${provider.name} execution error:`, error);
            continue;
          }

          console.log(`${provider.name} execution successful:`, {
            brandCount: executeResult.brands?.length || 0,
            orgBrandCount: executeResult.orgBrands?.length || 0,
            competitorCount: executeResult.competitorCount,
            score: executeResult.score
          });

          // Persistence now handled inside execute-prompt
          if (executeResult.runId) {
            runsCreated++;
          } else {
            console.warn(`${provider.name} did not persist run (no runId returned)`);
          }

        } catch (providerError) {
          console.error(`Provider ${provider.name} error:`, providerError);
          
          // Log failed run
          await supabase
            .from('prompt_runs')
            .insert({
              prompt_id: promptId,
              provider_id: provider.id,
              status: 'error',
              token_in: 0,
              token_out: 0,
              cost_est: 0
            });
        }
    }

    return { success: true, runsCreated };

  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
