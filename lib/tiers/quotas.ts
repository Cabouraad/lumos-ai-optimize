/**
 * Tier-based quota management
 */

export type PlanTier = 'starter' | 'pro' | 'scale';

export interface TierQuotas {
  promptsPerDay: number;
  providersPerPrompt: number;
}

export function getQuotasForTier(planTier: PlanTier): TierQuotas {
  switch (planTier) {
    case 'starter':
      return { promptsPerDay: 25, providersPerPrompt: 2 };
    case 'pro':
      return { promptsPerDay: 100, providersPerPrompt: 3 };
    case 'scale':
      return { promptsPerDay: 300, providersPerPrompt: 3 };
    default:
      return { promptsPerDay: 25, providersPerPrompt: 2 };
  }
}