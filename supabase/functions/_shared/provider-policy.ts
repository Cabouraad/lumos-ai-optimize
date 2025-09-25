/**
 * Server-side provider access policies by subscription tier
 * This is a duplicate of the client-side version for edge functions
 */

export type ProviderName = 'openai' | 'perplexity' | 'gemini' | 'google_ai_overview';
export type SubscriptionTier = 'starter' | 'growth' | 'pro' | 'free';

const PROVIDER_TIER_POLICIES: Record<SubscriptionTier, ProviderName[]> = {
  starter: ['openai', 'perplexity'],
  growth: ['openai', 'perplexity', 'gemini'], 
  pro: ['openai', 'perplexity', 'gemini', 'google_ai_overview'],
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
  return providers.filter((provider: any) => allowedProviders.includes(provider));
}

/**
 * Get blocked providers for a tier (for logging/audit purposes)
 */
export function getBlockedProviders(providers: ProviderName[], tier: SubscriptionTier): ProviderName[] {
  const allowedProviders = getAllowedProviders(tier);
  return providers.filter((provider: any) => !allowedProviders.includes(provider));
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