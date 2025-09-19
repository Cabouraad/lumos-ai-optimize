/**
 * Provider access policies by subscription tier
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
  return providers.filter(provider => allowedProviders.includes(provider));
}

/**
 * Get blocked providers for a tier (for logging/audit purposes)
 */
export function getBlockedProviders(providers: ProviderName[], tier: SubscriptionTier): ProviderName[] {
  const allowedProviders = getAllowedProviders(tier);
  return providers.filter(provider => !allowedProviders.includes(provider));
}