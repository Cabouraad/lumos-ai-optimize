/**
 * Optimizations V2 API Layer
 * Clean, simple interface for the new optimizations system
 */

import { supabase } from '@/integrations/supabase/client';

export interface OptimizationV2 {
  id: string;
  org_id: string;
  prompt_id: string | null;
  title: string;
  description: string;
  content_type: string;
  optimization_category: string;
  status: 'open' | 'in_progress' | 'completed' | 'dismissed';
  priority_score: number;
  difficulty_level: 'easy' | 'medium' | 'hard';
  estimated_hours: number | null;
  content_specs: Record<string, any>;
  distribution_channels: any[];
  implementation_steps: any[];
  success_metrics: Record<string, any>;
  citations_used: any[];
  prompt_context: Record<string, any>;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface LowVisibilityPrompt {
  prompt_id: string;
  prompt_text: string;
  total_runs: number;
  presence_rate: number;
  avg_score_when_present: number | null;
  last_checked_at: string;
  top_citations: any[];
}

/**
 * Generate recommendations (simplified, synchronous)
 */
export async function generateRecommendations(params?: {
  limit?: number;
}) {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session?.access_token) {
    throw new Error('Authentication required');
  }

  const { data, error } = await supabase.functions.invoke('generate-recommendations', {
    body: { limit: params?.limit || 10 },
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
    },
  });

  if (error) {
    throw new Error(error.message || 'Failed to generate recommendations');
  }

  return data as {
    success: boolean;
    count: number;
    processed: number;
    errors?: string[];
    message?: string;
  };
}

/**
 * List optimizations for the current organization
 */
export async function listOptimizations(params?: {
  category?: string;
  status?: string;
  limit?: number;
}) {
  let query = supabase
    .from('optimizations_v2')
    .select('*')
    .is('deleted_at', null)
    .order('priority_score', { ascending: false })
    .order('created_at', { ascending: false });

  if (params?.category) {
    query = query.eq('optimization_category', params.category);
  }

  if (params?.status) {
    query = query.eq('status', params.status);
  }

  if (params?.limit) {
    query = query.limit(params.limit);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data as OptimizationV2[];
}

/**
 * Get a single optimization by ID
 */
export async function getOptimization(id: string) {
  const { data, error } = await supabase
    .from('optimizations_v2')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (error) throw error;
  return data as OptimizationV2;
}

/**
 * Update optimization status
 */
export async function updateOptimizationStatus(
  id: string,
  status: 'open' | 'in_progress' | 'completed' | 'dismissed'
) {
  const updates: any = { status };
  
  if (status === 'completed') {
    updates.completed_at = new Date().toISOString();
  } else if (status === 'dismissed') {
    updates.dismissed_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from('optimizations_v2')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as OptimizationV2;
}

/**
 * Get low visibility prompts
 */
export async function getLowVisibilityPrompts(limit = 20) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: userData } = await supabase
    .from('users')
    .select('org_id')
    .eq('id', user.id)
    .single();

  if (!userData?.org_id) throw new Error('No organization found');

  const { data, error } = await supabase.rpc('get_low_visibility_prompts', {
    p_org_id: userData.org_id,
    p_limit: limit
  });

  if (error) throw error;
  return data as LowVisibilityPrompt[];
}

// Job tracking functions removed - now using synchronous generation