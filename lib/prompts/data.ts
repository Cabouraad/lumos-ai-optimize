/**
 * Prompts data utilities
 */

import { supabase } from '@/integrations/supabase/client';
import { getQuotasForTier } from '../tiers/quotas';

export async function getPromptsData(orgId: string, planTier: string) {
  // Get all prompts for the org
  const { data: prompts } = await supabase
    .from('prompts')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });

  // Get latest run per prompt per provider
  const { data: latestRuns } = await supabase
    .from('prompt_runs')
    .select(`
      id,
      prompt_id,
      provider_id,
      status,
      run_at,
      llm_providers (name),
      visibility_results (score)
    `)
    .in('prompt_id', prompts?.map(p => p.id) || [])
    .order('run_at', { ascending: false });

  // Group by prompt and provider to get latest
  const latestByPromptProvider: Record<string, any> = {};
  latestRuns?.forEach(run => {
    const key = `${run.prompt_id}-${run.provider_id}`;
    if (!latestByPromptProvider[key]) {
      latestByPromptProvider[key] = run;
    }
  });

  // Get today's usage
  const today = new Date().toISOString().split('T')[0];
  const { data: todayRuns } = await supabase
    .from('prompt_runs')
    .select('id')
    .in('prompt_id', prompts?.map(p => p.id) || [])
    .gte('run_at', `${today}T00:00:00Z`)
    .lt('run_at', `${today}T23:59:59Z`);

  const quotas = getQuotasForTier(planTier as any);
  const usage = todayRuns?.length || 0;

  return {
    prompts: prompts || [],
    latestRuns: latestByPromptProvider,
    usage,
    quota: quotas.promptsPerDay
  };
}

export async function runPromptNow(promptId: string, orgId: string) {
  console.log('=== runPromptNow called ===');
  console.log('promptId:', promptId);
  console.log('orgId:', orgId);
  
  try {
    console.log('Calling supabase.functions.invoke for run-prompt-now...');
    const { data, error } = await supabase.functions.invoke('run-prompt-now', {
      body: { promptId, orgId }
    });

    console.log('Edge function response:', { data, error });
    
    if (error) {
      console.error('Edge function error:', error);
      throw error;
    }
    
    console.log('Edge function success, returning data:', data);
    return data;
  } catch (err) {
    console.error('runPromptNow catch block:', err);
    throw err;
  }
}