
/**
 * Simplified Visibility Runner - Executes prompts using new denormalized storage
 */

import { supabase } from '@/integrations/supabase/client';

export interface RunPromptResult {
  success: boolean;
  error?: string;
  runsCreated: number;
}

/**
 * Run a single prompt across all enabled providers and store results in prompt_provider_responses
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

        // Check persistence was successful - now using responseId instead of runId
        if (response.responseId || response.persisted) {
          runsCreated++;
        } else {
          console.warn(`Provider ${provider.name} did not persist response (no responseId returned)`);
        }

      } catch (providerError) {
        console.error(`Provider ${provider.name} error:`, providerError);
        // Error logging handled in execute-prompt function
      }
    }

    return { success: true, runsCreated };

  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
