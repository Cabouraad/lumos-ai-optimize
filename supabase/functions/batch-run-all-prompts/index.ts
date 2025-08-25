import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PromptResult {
  promptId: string;
  promptText: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  providers: {
    openai: 'pending' | 'running' | 'success' | 'error';
    gemini: 'pending' | 'running' | 'success' | 'error';
    perplexity: 'pending' | 'running' | 'success' | 'error';
  };
  results: {
    openai?: { score: number; brandPresent: boolean; competitors: number; tokens: number };
    gemini?: { score: number; brandPresent: boolean; competitors: number; tokens: number };
    perplexity?: { score: number; brandPresent: boolean; competitors: number; tokens: number };
  };
  errors: {
    openai?: string;
    gemini?: string;
    perplexity?: string;
  };
  startTime?: number;
  endTime?: number;
}

interface BatchSummary {
  totalPrompts: number;
  totalProviderRuns: number;
  successfulRuns: number;
  errorRuns: number;
  successRate: number;
  successfulPrompts: number; // Prompts with all 3 providers successful
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { orgId } = await req.json();
    
    console.log('=== BATCH RUN START ===');
    console.log(`Org ID: ${orgId}`);

    if (!orgId) {
      throw new Error('Missing orgId parameter');
    }

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase environment variables');
    }
    
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
      console.log('No active prompts found');
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No active prompts found',
          results: [],
          summary: {
            totalPrompts: 0,
            totalProviderRuns: 0,
            successfulRuns: 0,
            errorRuns: 0,
            successRate: 0,
            successfulPrompts: 0
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${prompts.length} active prompts to process`);

    const providers = ['openai', 'gemini', 'perplexity'];
    const results: PromptResult[] = [];

    // Initialize all prompt results
    for (const prompt of prompts) {
      results.push({
        promptId: prompt.id,
        promptText: prompt.text.length > 100 ? prompt.text.substring(0, 100) + '...' : prompt.text,
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

    let totalSuccessful = 0;
    let totalErrors = 0;
    let successfulPrompts = 0;

    console.log('\n=== STARTING BATCH PROCESSING ===');

    // Set a timeout for the entire batch operation (90 seconds)
    const BATCH_TIMEOUT = 90000; // 90 seconds
    const batchStartTime = Date.now();

    // Process each prompt sequentially with timeout protection
    for (let promptIndex = 0; promptIndex < prompts.length; promptIndex++) {
      const prompt = prompts[promptIndex];
      const promptResult = results[promptIndex];
      
      // Check if we're approaching timeout
      if (Date.now() - batchStartTime > BATCH_TIMEOUT - 30000) { // Stop 30s before timeout
        console.log(`⏰ Approaching timeout, stopping batch processing at prompt ${promptIndex + 1}`);
        break;
      }
      
      console.log(`\n--- Processing Prompt ${promptIndex + 1}/${prompts.length} ---`);
      console.log(`Text: ${prompt.text.substring(0, 50)}...`);
      
      promptResult.status = 'running';
      promptResult.startTime = Date.now();

      let promptSuccessCount = 0;

      // Process all providers for this prompt with improved error handling
      for (const provider of providers) {
        try {
          console.log(`  🚀 Running ${provider}...`);
          promptResult.providers[provider as keyof typeof promptResult.providers] = 'running';

          // Add timeout for individual provider calls
          const PROVIDER_TIMEOUT = 15000; // 15 seconds per provider
          
          const providerPromise = supabase.functions.invoke('execute-prompt', {
            body: {
              promptText: prompt.text,
              provider,
              orgId,
              promptId: prompt.id
            }
          });

          // Race the provider call against timeout
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error(`${provider} timeout after ${PROVIDER_TIMEOUT}ms`)), PROVIDER_TIMEOUT)
          );

          const { data: executeResult, error: executeError } = await Promise.race([
            providerPromise,
            timeoutPromise
          ]) as any;

          if (executeError) {
            console.error(`  ❌ ${provider} error:`, executeError.message);
            promptResult.providers[provider as keyof typeof promptResult.providers] = 'error';
            promptResult.errors[provider as keyof typeof promptResult.errors] = executeError.message;
            totalErrors++;
          } else if (executeResult && executeResult.success) {
            console.log(`  ✅ ${provider} success - Score: ${executeResult.score}/10, Brand: ${executeResult.orgBrandPresent ? 'Yes' : 'No'}`);
            promptResult.providers[provider as keyof typeof promptResult.providers] = 'success';
            promptResult.results[provider as keyof typeof promptResult.results] = {
              score: executeResult.score || 0,
              brandPresent: executeResult.orgBrandPresent || false,
              competitors: executeResult.competitorCount || 0,
              tokens: (executeResult.tokenIn || 0) + (executeResult.tokenOut || 0)
            };
            totalSuccessful++;
            promptSuccessCount++;
          } else {
            console.error(`  ❌ ${provider} returned no valid data`);
            promptResult.providers[provider as keyof typeof promptResult.providers] = 'error';
            promptResult.errors[provider as keyof typeof promptResult.errors] = 'No valid response data';
            totalErrors++;
          }

          // Reduced delay between providers
          if (provider !== providers[providers.length - 1]) {
            console.log(`  ⏱️  Waiting 1 second before next provider...`);
            await new Promise(resolve => setTimeout(resolve, 1000));
          }

        } catch (providerError: any) {
          console.error(`  💥 ${provider} exception:`, providerError.message);
          promptResult.providers[provider as keyof typeof promptResult.providers] = 'error';
          promptResult.errors[provider as keyof typeof promptResult.errors] = providerError.message;
          totalErrors++;
        }
      }

      promptResult.status = 'completed';
      promptResult.endTime = Date.now();
      
      // Count as successful prompt if all 3 providers succeeded
      if (promptSuccessCount === 3) {
        successfulPrompts++;
        console.log(`  🎉 Prompt fully successful (3/3 providers)`);
      } else {
        console.log(`  ⚠️  Prompt partially successful (${promptSuccessCount}/3 providers)`);
      }

      const duration = promptResult.endTime - promptResult.startTime!;
      console.log(`Completed prompt ${promptIndex + 1}/${prompts.length} in ${duration}ms`);

      // Reduced delay between prompts
      if (promptIndex < prompts.length - 1) {
        console.log(`⏱️  Waiting 2 seconds before next prompt...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // Calculate final summary
    const totalProviderRuns = prompts.length * providers.length;
    const summary: BatchSummary = {
      totalPrompts: prompts.length,
      totalProviderRuns,
      successfulRuns: totalSuccessful,
      errorRuns: totalErrors,
      successRate: totalProviderRuns > 0 ? Math.round((totalSuccessful / totalProviderRuns) * 100) : 0,
      successfulPrompts
    };

    console.log('\n=== BATCH RUN COMPLETE ===');
    console.log(`Prompts processed: ${prompts.length}`);
    console.log(`Total provider runs: ${totalProviderRuns}`);
    console.log(`Successful runs: ${totalSuccessful}`);
    console.log(`Failed runs: ${totalErrors}`);
    console.log(`Success rate: ${summary.successRate}%`);
    console.log(`Fully successful prompts: ${successfulPrompts}/${prompts.length}`);

    // Record batch run history in the database
    try {
      const { error: historyError } = await supabase
        .from('batch_run_history')
        .insert({
          org_id: orgId,
          prompts_processed: prompts.length,
          successful_prompts: successfulPrompts,
          success_rate: summary.successRate,
          total_provider_runs: totalProviderRuns,
          successful_runs: totalSuccessful,
          failed_runs: totalErrors,
          run_timestamp: new Date().toISOString()
        });

      if (historyError) {
        console.error('Failed to record batch history:', historyError);
        // Don't fail the entire operation for history recording issues
      } else {
        console.log('✅ Batch run history recorded');
      }
    } catch (historyErr) {
      console.error('Exception recording batch history:', historyErr);
      // Continue without failing
    }

    return new Response(
      JSON.stringify({
        success: true,
        summary,
        results,
        timestamp: new Date().toISOString(),
        message: `Processed ${prompts.length} prompts with ${summary.successRate}% success rate. ${successfulPrompts} prompts fully successful.`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('=== BATCH RUN ERROR ===', error.message);
    console.error('Stack trace:', error.stack);
    
    // Always return a proper JSON response, even on error
    const errorResponse = {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
      summary: {
        totalPrompts: 0,
        totalProviderRuns: 0,
        successfulRuns: 0,
        errorRuns: 0,
        successRate: 0,
        successfulPrompts: 0
      },
      results: []
    };
    
    return new Response(
      JSON.stringify(errorResponse),
      { 
        status: 200, // Return 200 so the client can parse the error properly
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});