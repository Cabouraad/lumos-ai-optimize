import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PromptStatus {
  promptId: string;
  promptText: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  currentProvider?: string;
  providers: {
    openai: 'pending' | 'running' | 'success' | 'error';
    gemini: 'pending' | 'running' | 'success' | 'error';
    perplexity: 'pending' | 'running' | 'success' | 'error';
  };
  results: {
    openai?: any;
    gemini?: any;
    perplexity?: any;
  };
  errors: {
    openai?: string;
    gemini?: string;
    perplexity?: string;
  };
  startTime?: number;
  endTime?: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { orgId } = await req.json();
    console.log('=== BATCH RUN ALL PROMPTS START ===');
    console.log(`OrgId: ${orgId}`);

    if (!orgId) {
      throw new Error('Missing orgId');
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get all active prompts for the organization
    const { data: prompts, error: promptsError } = await supabase
      .from('prompts')
      .select('id, text')
      .eq('org_id', orgId)
      .eq('active', true)
      .order('created_at', { ascending: false });

    if (promptsError) {
      throw new Error(`Failed to fetch prompts: ${promptsError.message}`);
    }

    if (!prompts || prompts.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No active prompts found',
          results: []
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${prompts.length} active prompts to process`);

    const providers = ['openai', 'gemini', 'perplexity'];
    const batchResults: PromptStatus[] = [];

    // Initialize status for all prompts
    for (const prompt of prompts) {
      batchResults.push({
        promptId: prompt.id,
        promptText: prompt.text.substring(0, 100) + (prompt.text.length > 100 ? '...' : ''),
        status: 'pending',
        providers: {
          openai: 'pending',
          gemini: 'pending',
          perplexity: 'pending'
        },
        results: {},
        errors: {}
      });
    }

    let totalProcessed = 0;
    let totalSuccessful = 0;
    let totalErrors = 0;

    // Process each prompt sequentially
    for (let promptIndex = 0; promptIndex < prompts.length; promptIndex++) {
      const prompt = prompts[promptIndex];
      const promptStatus = batchResults[promptIndex];
      
      console.log(`\n--- Processing prompt ${promptIndex + 1}/${prompts.length} ---`);
      console.log(`Prompt: ${prompt.text.substring(0, 50)}...`);
      
      promptStatus.status = 'running';
      promptStatus.startTime = Date.now();

      // Run through all providers for this prompt
      for (const provider of providers) {
        try {
          console.log(`  Running on ${provider}...`);
          promptStatus.currentProvider = provider;
          promptStatus.providers[provider as keyof typeof promptStatus.providers] = 'running';

          // Call the execute-prompt function
          const { data: executeResult, error: executeError } = await supabase.functions.invoke('execute-prompt', {
            body: {
              promptText: prompt.text,
              provider,
              orgId,
              promptId: prompt.id
            }
          });

          if (executeError) {
            console.error(`  ${provider} error:`, executeError.message);
            promptStatus.providers[provider as keyof typeof promptStatus.providers] = 'error';
            promptStatus.errors[provider as keyof typeof promptStatus.errors] = executeError.message;
            totalErrors++;
          } else {
            console.log(`  ✅ ${provider} success - Score: ${executeResult.score}/10`);
            promptStatus.providers[provider as keyof typeof promptStatus.providers] = 'success';
            promptStatus.results[provider as keyof typeof promptStatus.results] = {
              score: executeResult.score,
              brandPresent: executeResult.brandPresent,
              competitors: executeResult.competitors?.length || 0,
              tokenIn: executeResult.tokenIn || 0,
              tokenOut: executeResult.tokenOut || 0
            };
            totalSuccessful++;
          }

          // Small delay between providers to prevent overwhelming APIs
          await new Promise(resolve => setTimeout(resolve, 1000));

        } catch (providerError: any) {
          console.error(`  ${provider} exception:`, providerError.message);
          promptStatus.providers[provider as keyof typeof promptStatus.providers] = 'error';
          promptStatus.errors[provider as keyof typeof promptStatus.errors] = providerError.message;
          totalErrors++;
        }
      }

      promptStatus.status = 'completed';
      promptStatus.endTime = Date.now();
      promptStatus.currentProvider = undefined;
      totalProcessed++;

      console.log(`Completed prompt ${promptIndex + 1}/${prompts.length} in ${promptStatus.endTime - promptStatus.startTime!}ms`);
    }

    const summary = {
      totalPrompts: prompts.length,
      totalProviderRuns: prompts.length * providers.length,
      successfulRuns: totalSuccessful,
      errorRuns: totalErrors,
      successRate: Math.round((totalSuccessful / (prompts.length * providers.length)) * 100)
    };

    console.log('\n=== BATCH RUN SUMMARY ===');
    console.log(`Processed: ${totalProcessed}/${prompts.length} prompts`);
    console.log(`Success rate: ${summary.successRate}%`);
    console.log(`Total provider runs: ${summary.totalProviderRuns}`);
    console.log(`Successful: ${totalSuccessful}, Errors: ${totalErrors}`);

    return new Response(
      JSON.stringify({
        success: true,
        summary,
        results: batchResults,
        timestamp: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('=== BATCH RUN ERROR ===', error.message);
    console.error('Stack trace:', error.stack);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        stack: error.stack 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});