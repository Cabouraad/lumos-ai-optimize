import { useSubscription } from '@/contexts/SubscriptionProvider';
import { useUser } from '@/contexts/UserProvider';

/**
 * @deprecated Use useSubscription from SubscriptionProvider instead
 * This hook is maintained for backward compatibility
 */
export function useSubscriptionGate() {
  const { hasAccess, subscriptionData } = useSubscription();
  const { userData } = useUser();
  
  // Calculate trial information
  const isOnTrial = !!(subscriptionData?.trial_expires_at && !subscriptionData?.subscribed);
  const trialExpiresAt = subscriptionData?.trial_expires_at ? new Date(subscriptionData.trial_expires_at) : null;
  const now = new Date();
  const trialExpired = isOnTrial && trialExpiresAt ? trialExpiresAt <= now : false;
  const daysRemainingInTrial = isOnTrial && trialExpiresAt ? Math.max(0, Math.ceil((trialExpiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))) : 0;
  
  // Determine current tier
  const currentTier = subscriptionData?.subscription_tier || 'starter';
  
  // Check if user is a bypass user (owner or test user)
  const isBypassUser = userData?.role === 'owner' || userData?.email?.includes('@test.app') || false;
  
  // Tier limits with all required properties
  const limits = {
    promptsPerDay: currentTier === 'starter' ? 10 : currentTier === 'growth' ? 100 : 1000,
    reportsPerMonth: currentTier === 'starter' ? 1 : currentTier === 'growth' ? 10 : 100,
    competitorTracking: currentTier === 'starter' ? 5 : currentTier === 'growth' ? 25 : 100,
    providersPerPrompt: currentTier === 'starter' ? 2 : currentTier === 'growth' ? 5 : 10,
    // Use canonical provider policies
    allowedProviders: (() => {
      try {
        // Lazy import to avoid circular deps at module init
        const { getAllowedProviders } = require('@/lib/providers/tier-policy');
        return getAllowedProviders((currentTier as any) || 'free');
      } catch (_e) {
        // Safe fallback
        if (currentTier === 'starter') return ['openai'];
        if (currentTier === 'growth') return ['openai', 'perplexity', 'gemini'];
        if (currentTier === 'pro' || currentTier === 'enterprise') return ['openai', 'perplexity', 'gemini', 'google_ai_overview'];
        return ['openai'];
      }
    })(),
    hasRecommendations: currentTier === 'growth' || currentTier === 'enterprise' || currentTier === 'pro',
    hasCompetitorAnalysis: currentTier === 'growth' || currentTier === 'enterprise' || currentTier === 'pro',
    hasPrioritySupport: currentTier === 'enterprise'
  };

  // Feature access permissions based on subscription tier - as functions for backward compatibility
  // These functions can accept optional parameters but ignore them for backward compatibility
  const canAccessRecommendations = (..._args: any[]) => ({
    hasAccess: hasAccess || currentTier === 'growth' || currentTier === 'enterprise',
    reason: hasAccess || currentTier === 'growth' || currentTier === 'enterprise' ? null : 'Growth plan required',
    upgradeRequired: !(hasAccess || currentTier === 'growth' || currentTier === 'enterprise'),
    isTrialExpired: trialExpired,
    daysRemainingInTrial
  });
  
  const canAccessCompetitorAnalysis = (..._args: any[]) => ({
    hasAccess: hasAccess || currentTier === 'growth' || currentTier === 'enterprise',
    reason: hasAccess || currentTier === 'growth' || currentTier === 'enterprise' ? null : 'Growth plan required',
    upgradeRequired: !(hasAccess || currentTier === 'growth' || currentTier === 'enterprise'),
    isTrialExpired: trialExpired,
    daysRemainingInTrial
  });
  
  const canAccessAdvancedScoring = (..._args: any[]) => ({
    hasAccess: hasAccess || currentTier === 'growth' || currentTier === 'enterprise',
    reason: hasAccess || currentTier === 'growth' || currentTier === 'enterprise' ? null : 'Growth plan required',
    upgradeRequired: !(hasAccess || currentTier === 'growth' || currentTier === 'enterprise'),
    isTrialExpired: trialExpired,
    daysRemainingInTrial
  });
  
  const canCreatePrompts = (..._args: any[]) => ({
    hasAccess: hasAccess || currentTier === 'starter' || currentTier === 'growth' || currentTier === 'enterprise',
    reason: hasAccess || currentTier === 'starter' || currentTier === 'growth' || currentTier === 'enterprise' ? null : 'Subscription required',
    upgradeRequired: !(hasAccess || currentTier === 'starter' || currentTier === 'growth' || currentTier === 'enterprise'),
    isTrialExpired: trialExpired,
    daysRemainingInTrial
  });
  
  return {
    hasAccessToApp: () => ({
      hasAccess,
      reason: hasAccess ? null : 'Subscription required',
      upgradeRequired: !hasAccess,
      isTrialExpired: trialExpired,
      daysRemainingInTrial
    }),
    subscriptionData,
    currentTier,
    limits,
    isBypassUser,
    canAccessRecommendations,
    canAccessCompetitorAnalysis,
    canAccessAdvancedScoring,
    canCreatePrompts,
    isOnTrial,
    trialExpired,
    daysRemainingInTrial
  };
}