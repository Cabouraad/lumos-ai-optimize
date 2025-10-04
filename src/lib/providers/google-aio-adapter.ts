/**
 * Google AI Overviews provider adapter
 */

import { supabase } from '@/integrations/supabase/client';
import type { AioResult, AioRequest } from '@/types/aio';

/**
 * Execute Google AI Overview query through edge function
 */
export async function runGoogleAio(
  prompt: string, 
  opts: { gl?: string; hl?: string } = {}
): Promise<AioResult | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.access_token) {
      throw new Error('Authentication required for Google AIO');
    }

    const request: AioRequest = {
      query: prompt,
      gl: opts.gl || 'us',
      hl: opts.hl || 'en'
    };

    const response = await supabase.functions.invoke('fetch-google-aio', {
      body: request,
      headers: {
        'Authorization': `Bearer ${session.access_token}`
      }
    });

    if (response.error) {
      console.error('Google AIO function error:', response.error);
      return null;
    }

    // Handle 204 (disabled) response
    if (!response.data) {
      console.log('Google AIO is disabled or not configured');
      return null;
    }

    return response.data as AioResult;
    
  } catch (error) {
    console.error('Google AIO adapter error:', error);
    return null;
  }
}

/**
 * Check if Google AI Overviews is available for the current user
 */
export async function isGoogleAioAvailable(): Promise<boolean> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.access_token) {
      return false;
    }

    // Make a dry_run call to check availability without burning SerpApi quota
    const response = await supabase.functions.invoke('fetch-google-aio', {
      body: { dry_run: true },
      headers: {
        'Authorization': `Bearer ${session.access_token}`
      }
    });

    // Check if enabled field is true in response data
    return !response.error && !!response.data?.enabled;
    
  } catch {
    return false;
  }
}