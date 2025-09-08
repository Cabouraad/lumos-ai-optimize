import { useAuth } from '@/contexts/AuthContext';
import { getQuotasForTier } from '../../lib/tiers/quotas';
import { getAllowedProviders } from '@/lib/providers/tier-policy';
import { optimizationFlags } from '@/config/featureFlags';
import { useEffect } from 'react';

export interface FeatureGate {
  hasAccess: boolean;
  reason?: string;
  upgradeRequired?: boolean;
  isTrialExpired?: boolean;
  trialExpiresAt?: string;
  daysRemainingInTrial?: number;
}

export interface TierLimits {
  promptsPerDay: number;
  providersPerPrompt: number;
  allowedProviders: string[];
  hasRecommendations: boolean;
  hasCompetitorAnalysis: boolean;
  hasAdvancedScoring: boolean;
  hasApiAccess: boolean;
  hasPrioritySupport: boolean;
  hasWhiteLabeling: boolean;
}

export function useSubscriptionGate() {
  const { subscriptionData, loading: authLoading } = useAuth();
  
  // BYPASS LOGIC: Check for bypass metadata and enforce Starter entitlements
  const isBypassUser = subscriptionData?.metadata?.source === "bypass";
  
  // If bypass user, force plan to 'starter' and never upgrade above it
  const currentTier = isBypassUser ? 'starter' : (subscriptionData?.subscription_tier || 'free');
  const isSubscribed = subscriptionData?.subscribed || false;
  
  // Debug logging for subscription state changes
  useEffect(() => {
    console.log('[SUBSCRIPTION_GATE] Hook mounted/updated', {
      plan: subscriptionData?.subscription_tier,
      status: subscriptionData?.subscribed ? 'active' : 'inactive',
      payment_collected: subscriptionData?.payment_collected,
      trial_expires_at: subscriptionData?.trial_expires_at,
      loading: authLoading
    });
  }, [
    subscriptionData?.subscription_tier,
    subscriptionData?.subscribed,
    subscriptionData?.payment_collected,
    subscriptionData?.trial_expires_at,
    authLoading
  ]);
  
  console.log('[SUBSCRIPTION_GATE]', {
    originalTier: subscriptionData?.subscription_tier,
    forcedTier: currentTier,
    isBypassUser,
    metadata: subscriptionData?.metadata
  });
  
  // Trial status with feature flag protection
  const allowTrialGrace = optimizationFlags.FEATURE_TRIAL_GRACE;
  const gracePeriodHours = allowTrialGrace ? 24 : 0;
  
  const trialExpiresAt = subscriptionData?.trial_expires_at;
  // Simplified access logic: subscribed OR (trial_expires_at > now AND payment_collected === true)
  const hasValidAccess = isSubscribed || 
    (trialExpiresAt && new Date(trialExpiresAt) > new Date() && subscriptionData?.payment_collected === true);
  
  const isOnTrial = currentTier === 'starter' && trialExpiresAt && subscriptionData?.payment_collected === true;
  const trialExpired = !hasValidAccess && trialExpiresAt && new Date(trialExpiresAt) <= new Date();
  const daysRemainingInTrial = isOnTrial && hasValidAccess && trialExpiresAt
    ? Math.max(0, Math.ceil((new Date(trialExpiresAt).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)))
    : 0;
  
  // Get tier limits - bypass users are locked to Starter limits regardless of claimed tier
  const getTierLimits = (tier: string): TierLimits => {
    const quotas = getQuotasForTier(tier as any);
    
    // BYPASS ENFORCEMENT: Never allow bypass users to get above Starter entitlements
    const effectiveTier = isBypassUser ? 'starter' : tier;
    
    switch (effectiveTier) {
      case 'starter':
        return {
          promptsPerDay: quotas.promptsPerDay, // Standard Starter quota enforcement
          providersPerPrompt: quotas.providersPerPrompt,
          allowedProviders: getAllowedProviders('starter'),
          hasRecommendations: false,
          hasCompetitorAnalysis: false,
          hasAdvancedScoring: false,
          hasApiAccess: false,
          hasPrioritySupport: false,
          hasWhiteLabeling: false,
        };
      case 'growth':
        return {
          promptsPerDay: quotas.promptsPerDay,
          providersPerPrompt: quotas.providersPerPrompt,
          allowedProviders: getAllowedProviders('growth'),
          hasRecommendations: true,
          hasCompetitorAnalysis: true,
          hasAdvancedScoring: true,
          hasApiAccess: false,
          hasPrioritySupport: true,
          hasWhiteLabeling: false,
        };
      case 'pro':
        return {
          promptsPerDay: quotas.promptsPerDay,
          providersPerPrompt: quotas.providersPerPrompt,
          allowedProviders: getAllowedProviders('pro'),
          hasRecommendations: true,
          hasCompetitorAnalysis: true,
          hasAdvancedScoring: true,
          hasApiAccess: false,
          hasPrioritySupport: false,
          hasWhiteLabeling: false,
        };
      default:
        return {
          promptsPerDay: 5, // Free tier gets 5 prompts
          providersPerPrompt: 1,
          allowedProviders: getAllowedProviders('free'),
          hasRecommendations: false,
          hasCompetitorAnalysis: false,
          hasAdvancedScoring: false,
          hasApiAccess: false,
          hasPrioritySupport: false,
          hasWhiteLabeling: false,
        };
    }
  };

  const limits = getTierLimits(currentTier);

  // Feature gate functions - updated to use new access logic
  const canAccessRecommendations = (): FeatureGate => {
    // Check valid access first
    if (!hasValidAccess) {
      return {
        hasAccess: false,
        reason: 'Access requires an active subscription or valid trial with payment method.',
        upgradeRequired: true,
        isTrialExpired: trialExpired,
      };
    }
    
    // Check tier permissions
    if (limits.hasRecommendations) {
      return { 
        hasAccess: true,
      };
    }
    return {
      hasAccess: false,
      reason: 'Optimizations require Growth plan or higher',
      upgradeRequired: true,
    };
  };

  const canAccessCompetitorAnalysis = (): FeatureGate => {
    // Check valid access first
    if (!hasValidAccess) {
      return {
        hasAccess: false,
        reason: 'Access requires an active subscription or valid trial with payment method.',
        upgradeRequired: true,
        isTrialExpired: trialExpired,
      };
    }
    
    // Check tier permissions
    if (limits.hasCompetitorAnalysis) {
      return { 
        hasAccess: true,
      };
    }
    return {
      hasAccess: false,
      reason: 'Competitor analysis requires Growth plan or higher',
      upgradeRequired: true,
    };
  };

  const canAccessAdvancedScoring = (): FeatureGate => {
    if (limits.hasAdvancedScoring) {
      return { hasAccess: true };
    }
    return {
      hasAccess: false,
      reason: 'Advanced scoring requires Growth plan or higher',
      upgradeRequired: true,
    };
  };

  const canAccessApiFeatures = (): FeatureGate => {
    if (limits.hasApiAccess) {
      return { hasAccess: true };
    }
    return {
      hasAccess: false,
      reason: 'API access requires Pro plan',
      upgradeRequired: true,
    };
  };

  const canCreatePrompts = (currentCount: number): FeatureGate => {
    // Check valid access first
    if (!hasValidAccess) {
      return {
        hasAccess: false,
        reason: 'Access requires an active subscription or valid trial with payment method.',
        upgradeRequired: true,
        isTrialExpired: trialExpired,
      };
    }
    
    if (currentCount < limits.promptsPerDay) {
      return { 
        hasAccess: true,
        trialExpiresAt: isOnTrial ? trialExpiresAt : undefined,
        daysRemainingInTrial: isOnTrial ? daysRemainingInTrial : undefined,
      };
    }
    return {
      hasAccess: false,
      reason: `Daily prompt limit reached (${limits.promptsPerDay})`,
      upgradeRequired: currentTier !== 'pro',
    };
  };

  const hasAccessToApp = (): FeatureGate => {
    if (!hasValidAccess) {
      return {
        hasAccess: false,
        reason: 'Access requires an active subscription or valid trial with payment method.',
        upgradeRequired: true,
        isTrialExpired: trialExpired,
      };
    }
    return { hasAccess: true };
  };

  return {
    currentTier,
    isSubscribed,
    limits,
    isOnTrial,
    trialExpired,
    daysRemainingInTrial,
    trialExpiresAt,
    isBypassUser, // Expose bypass status for UI feedback
    canAccessRecommendations,
    canAccessCompetitorAnalysis,
    canAccessAdvancedScoring,
    canAccessApiFeatures,
    canCreatePrompts,
    hasAccessToApp,
  };
}