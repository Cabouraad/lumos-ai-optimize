/**
 * Suggested prompts data utilities
 */

import { supabase } from '@/integrations/supabase/client';
import { getOrgId } from '@/lib/auth';

export async function getSuggestedPrompts() {
  try {
    const orgId = await getOrgId();

    const { data: suggestions, error } = await supabase
      .from('suggested_prompts')
      .select('id, text, source, created_at, accepted')
      .eq('org_id', orgId)
      .eq('accepted', false)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw error;

    return suggestions ?? [];
  } catch (error) {
    console.error('Suggested prompts data error:', error);
    throw error;
  }
}

export async function acceptSuggestion(suggestionId: string) {
  try {
    const orgId = await getOrgId();

    // Get the suggestion first
    const { data: suggestion, error: fetchError } = await supabase
      .from('suggested_prompts')
      .select('text')
      .eq('id', suggestionId)
      .eq('org_id', orgId)
      .single();

    if (fetchError) throw fetchError;

    // Create the prompt
    const { error: insertError } = await supabase
      .from('prompts')
      .insert({
        org_id: orgId,
        text: suggestion.text,
        active: true
      });

    if (insertError) throw insertError;

    // Mark suggestion as accepted
    const { error: updateError } = await supabase
      .from('suggested_prompts')
      .update({ accepted: true })
      .eq('id', suggestionId)
      .eq('org_id', orgId);

    if (updateError) throw updateError;

    return { success: true };
  } catch (error) {
    console.error('Accept suggestion error:', error);
    throw error;
  }
}

export async function dismissSuggestion(suggestionId: string) {
  try {
    const orgId = await getOrgId();

    const { error } = await supabase
      .from('suggested_prompts')
      .delete()
      .eq('id', suggestionId)
      .eq('org_id', orgId);

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error('Dismiss suggestion error:', error);
    throw error;
  }
}

export async function generateSuggestionsNow() {
  try {
    // Create timeout promise
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Request timed out - please try again')), 60000); // 60 second timeout
    });

    // Create the function call promise
    const functionPromise = supabase.functions.invoke('suggest-prompts-now', {
      body: {},
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Race between timeout and function call
    const result = await Promise.race([functionPromise, timeoutPromise]) as any;
    
    if (result.error) {
      console.error('Supabase function error:', result.error);
      throw new Error(result.error.message || 'Failed to generate suggestions');
    }

    if (!result.data) {
      throw new Error('No data returned from suggestions generator');
    }

    return result.data;
  } catch (error) {
    console.error('Generate suggestions error:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to generate suggestions');
  }
}