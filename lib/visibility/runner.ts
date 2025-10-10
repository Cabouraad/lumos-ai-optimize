
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
    // Delegate execution to robust edge function that handles provider filtering, quotas, and persistence
    const { data, error } = await supabase.functions.invoke('run-prompt-now', {
      body: { promptId }
    });

    if (error) {
      console.error('[visibility/runner] run-prompt-now error:', error);
      return { success: false, error: error.message, runsCreated: 0 };
    }

    // Standardized response shape: { success: boolean, data?: { successfulRuns, totalRuns, ... } }
    const successfulRuns = (data?.data?.successfulRuns ?? data?.successfulRuns ?? 0) as number;
    return { success: true, runsCreated: successfulRuns };

  } catch (error: any) {
    return { success: false, error: error.message, runsCreated: 0 };
  }
}
