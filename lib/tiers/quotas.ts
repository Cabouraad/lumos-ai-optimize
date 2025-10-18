/**
 * Tier-based quota management
 */

export type PlanTier = 'starter' | 'growth' | 'pro' | 'free';

export interface TierQuotas {
  promptsPerDay: number;
  providersPerPrompt: number;
}

export function getQuotasForTier(planTier: PlanTier): TierQuotas {
  switch (planTier) {
    case 'starter':
      return { promptsPerDay: 25, providersPerPrompt: 2 };
    case 'growth':
      return { promptsPerDay: 100, providersPerPrompt: 4 };
    case 'pro':
      return { promptsPerDay: 300, providersPerPrompt: 4 };
    case 'free':
      return { promptsPerDay: 5, providersPerPrompt: 1 };
    default:
      return { promptsPerDay: 5, providersPerPrompt: 1 }; // Default to free tier
  }
}