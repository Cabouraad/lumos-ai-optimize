/**
 * Billing bypass utilities for test accounts
 * Uses environment variables for dynamic control
 */

import { EdgeFunctionClient } from '@/lib/edge-functions/client';

/**
 * Check if user is eligible for billing bypass
 * This is a client-side check - the server will do the final validation
 */
export function isBillingBypassEligible(userEmail?: string | null): boolean {
  // Client-side basic check - server will validate against environment variables
  if (!userEmail) {
    return false;
  }

  // Basic eligibility check - test accounts for development
  const commonTestEmails = ['starter@test.app', 'test@example.com', 'aj@test.com'];
  return commonTestEmails.includes(userEmail.toLowerCase());
}

/**
 * Grant starter bypass for eligible test accounts
 * The actual eligibility is validated server-side using environment variables
 */
export async function grantStarterBypass(userEmail: string) {
  console.log(`[BILLING_BYPASS] Attempting to grant starter access to: ${userEmail}`);
  
  const { data, error } = await EdgeFunctionClient.grantStarterBypass();
  
  if (error) throw error;
  
  if (!data?.success) {
    throw new Error(data?.error || 'Failed to grant starter bypass');
  }
  
  console.log(`[BILLING_BYPASS] Successfully granted starter access to ${userEmail}`);
  return data;
}