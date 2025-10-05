import { getSupabaseBrowserClient } from '@/lib/supabase/browser';

export type GenerateRecsResponse = {
  inserted?: number;
  items?: any[];
  jobId?: string;
  message?: string;
  error?: string;
  detail?: string;
};

export async function generateVisibilityRecommendations(promptId: string): Promise<GenerateRecsResponse> {
  const sb = getSupabaseBrowserClient();

  // Ensure we have a session before invoking
  const { data: sess } = await sb.auth.getSession();
  const token = sess?.session?.access_token;
  if (!token) {
    return { error: 'unauthenticated', detail: 'You must be signed in to generate recommendations.' };
  }

  // IMPORTANT: Pass Authorization header explicitly
  const { data, error } = await sb.functions.invoke('generate-visibility-recommendations', {
    body: { promptId },
    headers: { Authorization: `Bearer ${token}` }
  });

  if (error) {
    // Bubble a consistent error shape to the UI
    return { error: 'invoke_failed', detail: error.message || String(error) };
  }

  // Edge function already returns structured JSON; pass it through
  return (data ?? {}) as GenerateRecsResponse;
}

export async function listVisibilityRecommendations(promptId: string) {
  const sb = getSupabaseBrowserClient();
  const { data, error } = await sb
    .from('ai_visibility_recommendations')
    .select('*')
    .eq('prompt_id', promptId)
    .order('created_at', { ascending: false });
    
  if (error) throw error;
  return data ?? [];
}

export async function listAllOrgRecommendations() {
  const sb = getSupabaseBrowserClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: userData } = await sb
    .from('users')
    .select('org_id')
    .eq('id', user.id)
    .single();

  if (!userData?.org_id) throw new Error('No organization found');

  const { data, error } = await sb
    .from('ai_visibility_recommendations')
    .select(`
      *,
      prompts!inner(text)
    `)
    .eq('org_id', userData.org_id)
    .order('created_at', { ascending: false })
    .limit(50);
    
  if (error) throw error;
  return data ?? [];
}
