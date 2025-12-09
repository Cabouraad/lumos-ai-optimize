/**
 * Server-side provider access policies by subscription tier
 * This is a duplicate of the client-side version for edge functions
 */

export type ProviderName = 'openai' | 'perplexity' | 'gemini' | 'google_ai_overview';
export type SubscriptionTier = 'starter' | 'growth' | 'pro' | 'free' | 'enterprise';

/**
 * Provider access policies aligned with pricing page:
 * - Starter: 2 providers (OpenAI + Perplexity)
 * - Growth: 4 providers (all including Google AIO)
 * - Pro: 4 providers (all including Google AIO)
 * - Enterprise: 4 providers (all including Google AIO)
 */
const PROVIDER_TIER_POLICIES: Record<SubscriptionTier, ProviderName[]> = {
  starter: ['openai', 'perplexity'],
  growth: ['openai', 'perplexity', 'gemini', 'google_ai_overview'],
  pro: ['openai', 'perplexity', 'gemini', 'google_ai_overview'],
  enterprise: ['openai', 'perplexity', 'gemini', 'google_ai_overview'],
  free: ['openai'] // Fallback for unsubscribed users
};

/**
 * Get allowed providers for a subscription tier
 */
export function getAllowedProviders(tier: SubscriptionTier): ProviderName[] {
  return PROVIDER_TIER_POLICIES[tier] || PROVIDER_TIER_POLICIES.free;
}

/**
 * Check if a provider is allowed for a subscription tier
 */
export function isProviderAllowed(provider: ProviderName, tier: SubscriptionTier): boolean {
  const allowedProviders = getAllowedProviders(tier);
  return allowedProviders.includes(provider);
}

/**
 * Filter provider list to only allowed providers for tier
 */
export function filterAllowedProviders(providers: ProviderName[], tier: SubscriptionTier): ProviderName[] {
  const allowedProviders = getAllowedProviders(tier);
  return providers.filter((provider: ProviderName) => allowedProviders.includes(provider));
}

/**
 * Get blocked providers for a tier (for logging/audit purposes)
 */
export function getBlockedProviders(providers: ProviderName[], tier: SubscriptionTier): ProviderName[] {
  const allowedProviders = getAllowedProviders(tier);
  return providers.filter((provider: ProviderName) => !allowedProviders.includes(provider));
}

/**
 * Get subscription tier from Supabase user data
 */
export async function getOrgSubscriptionTier(supabase: any, orgId: string): Promise<SubscriptionTier> {
  const { data: org } = await supabase
    .from('organizations')
    .select('plan_tier')
    .eq('id', orgId)
    .single();
    
  const tier = org?.plan_tier;
  
  // Map various tier names to our standardized types
  if (tier === 'starter' || tier === 'growth' || tier === 'pro') {
    return tier;
  }
  
  return 'free'; // Default fallback
}

/**
 * Tier-based run frequency policies
 * - Free: Weekly runs only
 * - All paid tiers: Daily runs
 */
const TIER_RUN_FREQUENCY: Record<SubscriptionTier, 'daily' | 'weekly'> = {
  starter: 'daily',
  growth: 'daily',
  pro: 'daily',
  enterprise: 'daily',
  free: 'weekly'
};

/**
 * Tier-based max prompts limit
 */
const TIER_MAX_PROMPTS: Record<SubscriptionTier, number | null> = {
  starter: null, // Unlimited
  growth: null,
  pro: null,
  enterprise: null,
  free: 5 // Free tier limited to 5 prompts
};

/**
 * Get run frequency for a tier
 */
export function getRunFrequency(tier: SubscriptionTier): 'daily' | 'weekly' {
  return TIER_RUN_FREQUENCY[tier] || 'weekly';
}

/**
 * Get max prompts for a tier (null = unlimited)
 */
export function getMaxPrompts(tier: SubscriptionTier): number | null {
  // IMPORTANT: Use explicit key check - null means unlimited, don't coalesce it!
  if (tier in TIER_MAX_PROMPTS) {
    return TIER_MAX_PROMPTS[tier];
  }
  // Only apply 5-prompt limit for unknown/undefined tiers
  return 5;
}

/**
 * Check if org should run prompts based on tier and current schedule
 * @param tier - The subscription tier
 * @param isWeeklyRun - Whether this is a weekly run (e.g., Sunday/Monday)
 * @returns true if org should run prompts in this batch
 */
export function shouldRunForTier(tier: SubscriptionTier, isWeeklyRun: boolean = false): boolean {
  const runFrequency = getRunFrequency(tier);
  
  // Daily tiers run every time
  if (runFrequency === 'daily') {
    return true;
  }
  
  // Weekly tiers only run on weekly runs
  return isWeeklyRun;
}

/**
 * Check if today is a weekly run day (Sunday or Monday)
 * Weekly runs happen on Monday to give the best week-start data
 */
export function isWeeklyRunDay(): boolean {
  const now = new Date();
  const dayOfWeek = now.getDay();
  // 0 = Sunday, 1 = Monday
  return dayOfWeek === 0 || dayOfWeek === 1;
}

/**
 * Log provider filtering for audit trail
 */
export function auditProviderFilter(
  orgId: string, 
  tier: SubscriptionTier, 
  requestedProviders: string[], 
  allowedProviders: string[],
  blockedProviders: string[]
) {
  console.log(`[PROVIDER_AUDIT] Org: ${orgId}, Tier: ${tier}`, {
    requested: requestedProviders,
    allowed: allowedProviders, 
    blocked: blockedProviders,
    timestamp: new Date().toISOString()
  });
}