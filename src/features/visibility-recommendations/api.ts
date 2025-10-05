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
  // Try batch queue first (org scope), then direct generator (prompt scope),
  // then the recommendations generator as a final fallback.
  // This keeps compatibility with your existing dual-path architecture.
  const bodyOrg = { scope: "org" as const, category: "low_visibility" as const, diag: true };
  const bodyPrompt = { promptId, batch: false, category: "low_visibility" as const, diag: true };

  // 1) Enqueue (primary)
  const a = await invokeEdge("enqueue-optimizations", { body: bodyOrg });
  if (!a.error && a.data) return a;

  // 2) Direct generation (prompt)
  if (promptId) {
    const b = await invokeEdge("generate-optimizations", { body: bodyPrompt });
    if (!b.error && b.data) return b;
  }

  // 3) Visibility recs (fallback)
  const c = await invokeEdge("generate-visibility-recommendations", { body: { promptId, diag: true } });
  return c;
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
