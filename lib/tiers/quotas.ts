/**
 * Tier-based quota management
 */

export type PlanTier = 'starter' | 'growth' | 'pro' | 'free';

export interface TierQuotas {
  promptsPerDay: number;
  providersPerPrompt: number;
  maxUsers: number;
  /** Maximum number of prompts the user can track (for free tier) */
  maxPrompts?: number;
  /** Run frequency: 'daily' | 'weekly' */
  runFrequency?: 'daily' | 'weekly';
}

export function getQuotasForTier(planTier: PlanTier): TierQuotas {
  switch (planTier) {
    case 'starter':
      return { promptsPerDay: 25, providersPerPrompt: 2, maxUsers: 1, runFrequency: 'daily' };
    case 'growth':
      return { promptsPerDay: 100, providersPerPrompt: 4, maxUsers: 3, runFrequency: 'daily' };
    case 'pro':
      return { promptsPerDay: 300, providersPerPrompt: 4, maxUsers: 10, runFrequency: 'daily' };
    case 'free':
      return { 
        promptsPerDay: 5, 
        providersPerPrompt: 1, 
        maxUsers: 1, 
        maxPrompts: 5, 
        runFrequency: 'weekly' 
      };
    default:
      return { 
        promptsPerDay: 5, 
        providersPerPrompt: 1, 
        maxUsers: 1, 
        maxPrompts: 5, 
        runFrequency: 'weekly' 
      };
  }
}