/**
 * Billing bypass utilities for test accounts
 * Only active when FEATURE_BILLING_BYPASS is enabled
 */

import { isFeatureEnabled } from '@/lib/config/feature-flags';
import { supabase } from '@/integrations/supabase/client';

const BYPASS_TEST_EMAILS = [
  'starter@test.app',
  'test@example.com',
  // Add more test emails as needed
];

/**
 * Check if user is eligible for billing bypass
 */
export function isBillingBypassEligible(userEmail?: string | null): boolean {
  if (!isFeatureEnabled('FEATURE_BILLING_BYPASS')) {
    return false;
  }
  
  if (!userEmail) {
    return false;
  }

  return BYPASS_TEST_EMAILS.includes(userEmail.toLowerCase());
}

/**
 * Grant starter bypass for eligible test accounts
 */
export async function grantStarterBypass(userEmail: string) {
  if (!isBillingBypassEligible(userEmail)) {
    throw new Error('User not eligible for billing bypass');
  }

  console.log(`[BILLING_BYPASS] Granting starter access to test user: ${userEmail}`);
  
  const { data, error } = await supabase.functions.invoke('grant-starter-bypass', { 
    body: { 
      bypass_mode: true,
      user_email: userEmail 
    } 
  });
  
  if (error) throw error;
  
  if (!data?.success) {
    throw new Error(data?.error || 'Failed to grant starter bypass');
  }
  
  console.log(`[BILLING_BYPASS] Successfully granted starter access to ${userEmail}`);
  return data;
}