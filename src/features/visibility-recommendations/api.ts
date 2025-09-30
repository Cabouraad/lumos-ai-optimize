import { supabase } from '@/integrations/supabase/client';

export async function generateVisibilityRecommendations(promptId: string) {
  const { data, error } = await supabase.functions.invoke('generate-visibility-recommendations', {
    body: { promptId }
  });
  if (error) throw error;
  if ((data as any)?.error) {
    throw new Error(`${(data as any).error}${(data as any).detail ? ': ' + (data as any).detail : ''}`);
  }
  return data as { inserted: number; recommendations: any[] };
}

export async function listVisibilityRecommendations(promptId: string) {
  const { data, error } = await supabase
    .from('ai_visibility_recommendations')
    .select('*')
    .eq('prompt_id', promptId)
    .order('created_at', { ascending: false });
    
  if (error) throw error;
  return data ?? [];
}

export async function listAllOrgRecommendations() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: userData } = await supabase
    .from('users')
    .select('org_id')
    .eq('id', user.id)
    .single();

  if (!userData?.org_id) throw new Error('No organization found');

  const { data, error } = await supabase
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
