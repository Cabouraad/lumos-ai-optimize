"use client";
import { invokeEdge } from "@/lib/supabase/invoke";
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';
import type { ContentStudioItem, GenerateContentStudioRequest, GenerateContentStudioResponse } from './types';

/**
 * Generate a Content Studio item from a recommendation or prompt
 */
export async function generateContentStudioItem(
  request: GenerateContentStudioRequest
): Promise<GenerateContentStudioResponse> {
  const { data, error } = await invokeEdge('content-studio-generate', {
    body: request,
  });

  if (error) {
    const errResponse = (error as any).response;
    return {
      success: false,
      error: errResponse?.error || error.message || 'Failed to generate content blueprint',
      upgradeRequired: errResponse?.upgradeRequired,
      currentTier: errResponse?.currentTier,
    };
  }

  return data as GenerateContentStudioResponse;
}

/**
 * Fetch Content Studio items for the current organization (filtered by brand via prompts)
 */
export async function listContentStudioItems(limit = 20, brandId?: string | null): Promise<ContentStudioItem[]> {
  const sb = getSupabaseBrowserClient();
  
  // If brandId is provided, we need to filter via prompts table
  if (brandId) {
    // First get prompt_ids for this brand
    const { data: brandPrompts, error: promptsError } = await sb
      .from('prompts')
      .select('id')
      .eq('brand_id', brandId);
    
    if (promptsError) {
      console.error('Error fetching brand prompts:', promptsError);
      throw promptsError;
    }
    
    const promptIds = brandPrompts?.map(p => p.id) || [];
    
    // Build query to include items matching brand's prompts OR items with null prompt_id
    let query = sb
      .from('content_studio_items')
      .select('*');
    
    if (promptIds.length > 0) {
      // Items that match this brand's prompts OR have no prompt association
      query = query.or(`prompt_id.in.(${promptIds.join(',')}),prompt_id.is.null`);
    } else {
      // No prompts for this brand yet, only show items without prompt association
      query = query.is('prompt_id', null);
    }
    
    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching content studio items:', error);
      throw error;
    }

    return (data ?? []) as unknown as ContentStudioItem[];
  }
  
  // No brand filter - return all items for org
  const { data, error } = await sb
    .from('content_studio_items')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching content studio items:', error);
    throw error;
  }

  return (data ?? []) as unknown as ContentStudioItem[];
}

/**
 * Fetch a single Content Studio item by ID
 */
export async function getContentStudioItem(id: string): Promise<ContentStudioItem | null> {
  const sb = getSupabaseBrowserClient();
  
  const { data, error } = await sb
    .from('content_studio_items')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    console.error('Error fetching content studio item:', error);
    throw error;
  }

  return data as unknown as ContentStudioItem;
}

/**
 * Update Content Studio item status
 */
export async function updateContentStudioItemStatus(
  id: string,
  status: 'draft' | 'in_progress' | 'completed'
): Promise<void> {
  const sb = getSupabaseBrowserClient();
  
  const { error } = await sb
    .from('content_studio_items')
    .update({ status })
    .eq('id', id);

  if (error) {
    console.error('Error updating content studio item:', error);
    throw error;
  }
}
