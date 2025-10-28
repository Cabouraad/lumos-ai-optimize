/**
 * Suggested prompts data utilities
 */

import { supabase } from '@/integrations/supabase/client';
import { getOrgId } from '@/lib/auth';

// Guard utils
const isValidUUID = (id: string | null | undefined) => !!id && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);


export async function getSuggestedPrompts() {
  try {
    const orgId = await getOrgId();
    if (!isValidUUID(orgId)) throw new Error('Organization not initialized yet. Please retry in a moment.');

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
    if (!isValidUUID(orgId)) throw new Error('Organization not initialized yet. Please retry.');

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
    if (!isValidUUID(orgId)) throw new Error('Organization not initialized yet. Please retry.');

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
    // Check if business context is filled before generating suggestions
    const orgId = await getOrgId();
    if (!isValidUUID(orgId)) throw new Error('Organization not initialized yet. Please complete setup and try again.');
    
    const { data: orgData, error: orgError } = await supabase
      .from('organizations')
      .select('business_description, products_services, target_audience, keywords')
      .eq('id', orgId)
      .single();

    if (orgError) {
      throw new Error('Failed to check organization data');
    }

    // Validate that required business context is filled
    const missingFields = [];
    if (!orgData.business_description?.trim()) missingFields.push('Business Description');
    if (!orgData.products_services?.trim()) missingFields.push('Products/Services');
    if (!orgData.target_audience?.trim()) missingFields.push('Target Audience');
    if (!orgData.keywords?.length) missingFields.push('Keywords');

    if (missingFields.length > 0) {
      throw new Error(`Please complete your business context first. Missing: ${missingFields.join(', ')}. Go to Settings to add this information.`);
    }

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

/**
 * Accept multiple suggestions and create custom prompts in bulk
 * Used during onboarding to activate selected prompts
 */
export async function acceptMultipleSuggestions(
  suggestionIds: string[], 
  manualPrompts: string[]
) {
  try {
    const orgId = await getOrgId();
    if (!isValidUUID(orgId)) throw new Error('Organization not initialized yet. Please complete setup and try again.');

    // Fetch selected suggestions
    const { data: suggestions, error: fetchError } = await supabase
      .from('suggested_prompts')
      .select('id, text')
      .eq('org_id', orgId)
      .in('id', suggestionIds);

    if (fetchError) throw fetchError;

    // Create prompts from suggestions
    const suggestionPrompts = suggestions?.map(s => ({
      org_id: orgId,
      text: s.text,
      active: true
    })) ?? [];

    // Create prompts from manual input
    const manualPromptsData = manualPrompts
      .filter(text => text.trim().length > 0)
      .map(text => ({
        org_id: orgId,
        text: text.trim(),
        active: true
      }));

    // Combine all prompts
    const allPrompts = [...suggestionPrompts, ...manualPromptsData];

    if (allPrompts.length > 0) {
      // Insert all prompts at once
      const { error: insertError } = await supabase
        .from('prompts')
        .insert(allPrompts);

      if (insertError) throw insertError;
    }

    // Mark all suggestions as accepted
    if (suggestionIds.length > 0) {
      const { error: updateError } = await supabase
        .from('suggested_prompts')
        .update({ accepted: true })
        .eq('org_id', orgId)
        .in('id', suggestionIds);

      if (updateError) throw updateError;
    }

    return { 
      success: true, 
      promptsCreated: allPrompts.length 
    };
  } catch (error) {
    console.error('Accept multiple suggestions error:', error);
    throw error;
  }
}