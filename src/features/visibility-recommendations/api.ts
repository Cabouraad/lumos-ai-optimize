"use client";
import { invokeEdge } from "@/lib/supabase/invoke";
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';

export type GenerateRecsResponse = {
  inserted?: number;
  items?: any[];
  jobId?: string;
  message?: string;
  error?: string;
  detail?: string;
};

export async function generateVisibilityRecommendations(promptId?: string) {
  // Call the suggest-prompts-now edge function
  return await invokeEdge("suggest-prompts-now", { 
    body: {} 
  });
}

export async function listVisibilityRecommendations(promptId: string) {
  const sb = getSupabaseBrowserClient();
  const { data, error } = await sb
    .from('optimizations_v2')
    .select('*')
    .eq('prompt_id', promptId)
    .is('deleted_at', null)
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
    .from('optimizations_v2')
    .select(`
      *,
      prompts!inner(text)
    `)
    .eq('org_id', userData.org_id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(50);
    
  if (error) throw error;
  return data ?? [];
}
