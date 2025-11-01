/**
 * User limit validation for tier-based user management
 */

import { getQuotasForTier, PlanTier } from './quotas.ts';

export interface UserLimitCheckResult {
  allowed: boolean;
  reason?: string;
  currentCount: number;
  limit: number;
}

/**
 * Check if organization can add more users based on their subscription tier
 */
export async function canAddUser(
  supabase: any,
  orgId: string,
  subscriptionTier: PlanTier
): Promise<UserLimitCheckResult> {
  // Get tier limits
  const quotas = getQuotasForTier(subscriptionTier);
  const userLimit = quotas.maxUsers;

  // Count current users in the organization
  const { count, error } = await supabase
    .from('users')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', orgId);

  if (error) {
    console.error('Error counting users:', error);
    return {
      allowed: false,
      reason: 'Failed to check current user count',
      currentCount: 0,
      limit: userLimit,
    };
  }

  const currentCount = count || 0;

  if (currentCount >= userLimit) {
    return {
      allowed: false,
      reason: `Your ${subscriptionTier} plan allows ${userLimit} user${userLimit > 1 ? 's' : ''}. Upgrade to add more team members.`,
      currentCount,
      limit: userLimit,
    };
  }

  return {
    allowed: true,
    currentCount,
    limit: userLimit,
  };
}

/**
 * Get current user count and limit for an organization
 */
export async function getUserCountInfo(
  supabase: any,
  orgId: string,
  subscriptionTier: PlanTier
): Promise<{ currentCount: number; limit: number; error?: string }> {
  const quotas = getQuotasForTier(subscriptionTier);
  const userLimit = quotas.maxUsers;

  const { count, error } = await supabase
    .from('users')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', orgId);

  if (error) {
    console.error('Error counting users:', error);
    return {
      currentCount: 0,
      limit: userLimit,
      error: 'Failed to fetch user count',
    };
  }

  return {
    currentCount: count || 0,
    limit: userLimit,
  };
}
