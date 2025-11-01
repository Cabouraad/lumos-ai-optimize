/**
 * Tier-based quota management for edge functions
 * ALIGNED WITH PRICING PAGE
 */

export type PlanTier = 'starter' | 'growth' | 'pro' | 'free';

export interface TierQuotas {
  promptsPerDay: number;
  providersPerPrompt: number;
  maxUsers: number;
}

export function getQuotasForTier(planTier: PlanTier): TierQuotas {
  switch (planTier) {
    case 'starter':
      return { promptsPerDay: 25, providersPerPrompt: 2, maxUsers: 1 };
    case 'growth':
      return { promptsPerDay: 100, providersPerPrompt: 4, maxUsers: 3 };
    case 'pro':
      return { promptsPerDay: 300, providersPerPrompt: 4, maxUsers: 10 };
    case 'free':
      return { promptsPerDay: 5, providersPerPrompt: 1, maxUsers: 1 };
    default:
      return { promptsPerDay: 5, providersPerPrompt: 1, maxUsers: 1 };
  }
}