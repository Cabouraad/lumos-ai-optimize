/**
 * Simplified Visibility Runner - Executes prompts and stores results
 */

import { supabase } from '@/integrations/supabase/client';

export interface RunPromptResult {
  success: boolean;
  error?: string;
  runsCreated: number;
}

export interface ProviderResponse {
  provider: string;
  responseText: string;
  brands: string[];
  tokenIn: number;
  tokenOut: number;
  success: boolean;
  error?: string;
}

/**
 * Run a single prompt across all enabled providers and store results
 */
export async function runPrompt(promptId: string, orgId: string): Promise<RunPromptResult> {
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
        // Execute prompt via edge function
        const { data: response, error } = await supabase.functions.invoke('execute-prompt', {
          body: {
            promptText: prompt.text,
            provider: provider.name,
            orgId
          }
        });

        if (error || !response) {
          console.error(`Provider ${provider.name} failed:`, error);
          continue;
        }

        // Store successful run
        const { data: run } = await supabase
          .from('prompt_runs')
          .insert({
            prompt_id: promptId,
            provider_id: provider.id,
            status: 'success',
            token_in: response.tokenIn || 0,
            token_out: response.tokenOut || 0,
            cost_est: 0
          })
          .select()
          .single();

        if (run) {
          // Calculate and store visibility results
          const visibilityScore = calculateVisibilityScore(response.brands, response.responseText, orgId);
          
          await supabase
            .from('visibility_results')
            .insert({
              prompt_run_id: run.id,
              org_brand_present: visibilityScore.brandPresent,
              org_brand_prominence: visibilityScore.brandPosition,
              competitors_count: visibilityScore.competitorCount,
              brands_json: response.brands,
              score: visibilityScore.score,
              raw_ai_response: response.responseText,
              raw_evidence: JSON.stringify({
                brands: response.brands,
                analysis: visibilityScore.analysis
              })
            });

          runsCreated++;
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

/**
 * Calculate visibility score based on brand analysis
 */
function calculateVisibilityScore(brands: string[], responseText: string, orgId: string) {
  // Simple scoring logic - will be enhanced
  const brandPresent = brands.length > 0;
  const competitorCount = Math.max(0, brands.length - 1); // Assume first brand is user's
  const brandPosition = brandPresent ? 0 : null; // First position if present
  
  // Basic scoring: 10 if brand present in first position, decreasing based on competitors
  let score = 0;
  if (brandPresent) {
    score = Math.max(1, 10 - competitorCount);
  }

  return {
    brandPresent,
    brandPosition,
    competitorCount,
    score,
    analysis: {
      totalBrands: brands.length,
      responseLength: responseText.length
    }
  };
}