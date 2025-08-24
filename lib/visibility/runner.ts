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
        const { data: response, error } = await supabase.functions.invoke('execute-prompt', {
          body: {
            promptText: prompt.text,
            provider: provider.name,
            orgId,
            promptId
          }
        });

        if (error || !response) {
          console.error(`Provider ${provider.name} failed:`, error);
          continue;
        }

        // Persistence handled in edge function
        if (response.runId || response.persisted) {
          runsCreated++;
        } else {
          console.warn(`Provider ${provider.name} did not persist run (no runId returned)`);
        }

      } catch (providerError) {
        console.error(`Provider ${provider.name} error:`, providerError);
        
        // Failed provider execution; persistence and error logging handled server-side.

      }
    }

    return { success: true, runsCreated };

  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Calculate visibility score based on brand analysis
 * (No longer used; keeping for reference)
 */
function calculateVisibilityScore(brands: string[], responseText: string, orgId: string) {
  const brandPresent = brands.length > 0;
  const competitorCount = Math.max(0, brands.length - 1);
  const brandPosition = brandPresent ? 0 : null;
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