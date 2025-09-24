import { supabase } from '@/integrations/supabase/client';

export async function generateForPrompt(promptId: string) {
  const { data, error } = await supabase.functions.invoke('generate-optimizations', {
    body: { promptId }
  });
  if (error) throw error;
  return data as { inserted: number, optimizations: any[] };
}

export async function generateForLowVisibilityBatch() {
  const { data, error } = await supabase.functions.invoke('generate-optimizations', {
    body: { batch: true }
  });
  if (error) throw error;
  return data;
}

export async function enqueueOptimizations(scope: 'org' | 'prompt', promptIds?: string[]) {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session?.access_token) {
    throw new Error('Authentication required');
  }

  const res = await supabase.functions.invoke('enqueue-optimizations', {
    body: { scope, promptIds },
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
    },
  });

  if (res.error) {
    throw new Error(res.error.message || 'Failed to enqueue optimizations');
  }

  return res.data as { jobId: string; status: string; message: string };
}

export async function listOptimizationsByPrompt(promptId: string) {
  const { data, error } = await supabase
    .from('optimizations')
    .select('*')
    .eq('prompt_id', promptId)
    .order('created_at', { ascending: false });
    
  if (error) throw error;
  return data ?? [];
}

export async function listOptimizationsByOrg(orgId: string) {
  const { data, error } = await supabase
    .from('optimizations')
    .select(`
      *,
      prompts!inner(text)
    `)
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(50);
    
  if (error) throw error;
  return data ?? [];
}

export async function getJob(jobId: string) {
  const { data, error } = await supabase
    .from('optimization_jobs')
    .select('id, status, error_text, created_at, finished_at, scope')
    .eq('id', jobId)
    .single();
    
  if (error) throw error;
  return data;
}

export async function getLowVisibilityPrompts() {
  const { data, error } = await supabase
    .from('low_visibility_prompts')
    .select('*')
    .order('presence_rate', { ascending: true })
    .limit(20);
    
  if (error) throw error;
  return data ?? [];
}