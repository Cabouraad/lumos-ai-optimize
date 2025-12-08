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
  maxUsers: number;
  allowedProviders: string[];
  hasRecommendations: boolean;
  hasCompetitorAnalysis: boolean;
  hasAdvancedScoring: boolean;
  hasPrioritySupport: boolean;
  hasWhiteLabeling: boolean;
  /** Maximum number of prompts user can track (null = unlimited) */
  maxPrompts: number | null;
  /** Run frequency: 'daily' | 'weekly' */
  runFrequency: 'daily' | 'weekly';
  /** Whether user is on free tier */
  isFreeTier: boolean;
}

export function useSubscriptionGate() {
  const { subscriptionData, loading: authLoading } = useAuth();
  
  // SECURITY: Bypass is controlled server-side only via subscribers table
  // Client cannot set this flag - it's managed by admin-only edge functions
  const isBypassUser = subscriptionData?.metadata?.source === "bypass" && 
    subscriptionData?.payment_collected === true; // Still require payment flag even for bypass
  
  // For trial users without explicit tier, default to 'starter'
  // This ensures trial users get proper Starter tier limits (25 prompts)
  const hasActiveTrial = subscriptionData?.trial_expires_at && 
    new Date(subscriptionData.trial_expires_at) > new Date() && 
    subscriptionData?.payment_collected === true;
  
  // If bypass user, force plan to 'starter' and never upgrade above it
  // If active trial without tier, default to 'starter'
  const currentTier = isBypassUser 
    ? 'starter' 
    : (subscriptionData?.subscription_tier || (hasActiveTrial ? 'starter' : 'free'));
  const isSubscribed = subscriptionData?.subscribed || false;
  
  // Debug logging for subscription state changes
  useEffect(() => {
    console.log('[SUBSCRIPTION_GATE] Hook mounted/updated', {
      plan: subscriptionData?.subscription_tier,
      status: subscriptionData?.subscribed ? 'active' : 'inactive',
      payment_collected: subscriptionData?.payment_collected,
      trial_expires_at: subscriptionData?.trial_expires_at,
      loading: authLoading,
      currentTier,
      hasActiveTrial,
      limits: {
        promptsPerDay: getTierLimits(currentTier).promptsPerDay,
        hasCompetitorAnalysis: getTierLimits(currentTier).hasCompetitorAnalysis,
        hasRecommendations: getTierLimits(currentTier).hasRecommendations
      }
    });
  }, [
    subscriptionData?.subscription_tier,
    subscriptionData?.subscribed,
    subscriptionData?.payment_collected,
    subscriptionData?.trial_expires_at,
    authLoading,
    currentTier,
    hasActiveTrial
  ]);
  
  // Debug logging only in development to reduce production noise
  if (import.meta.env.DEV) {
    console.log('[SUBSCRIPTION_GATE]', {
      originalTier: subscriptionData?.subscription_tier,
      forcedTier: currentTier,
      isBypassUser,
      metadata: subscriptionData?.metadata
    });
  }
  
  // Trial status with feature flag protection
  const allowTrialGrace = optimizationFlags.FEATURE_TRIAL_GRACE;
  const gracePeriodHours = allowTrialGrace ? 24 : 0;
  
  const trialExpiresAt = subscriptionData?.trial_expires_at;
  // Access logic: subscribed OR (trial_expires_at > now AND payment_collected === true) OR free tier
  const isFreeTier = currentTier === 'free';
  const hasValidAccess = isSubscribed || 
    (trialExpiresAt && new Date(trialExpiresAt) > new Date() && subscriptionData?.payment_collected === true) ||
    isFreeTier; // Free tier users always have access (with restrictions)
  
  const isOnTrial = currentTier === 'starter' && trialExpiresAt && subscriptionData?.payment_collected === true;
  const trialExpired = !isSubscribed && !isFreeTier && trialExpiresAt && new Date(trialExpiresAt) <= new Date();
  // Calculate days remaining for any active trial (not just starter tier)
  const daysRemainingInTrial = trialExpiresAt && !trialExpired && hasValidAccess && !isFreeTier
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
          maxUsers: quotas.maxUsers,
          allowedProviders: getAllowedProviders('starter'),
          hasRecommendations: false,
          hasCompetitorAnalysis: false,
          hasAdvancedScoring: false,
          hasPrioritySupport: false,
          hasWhiteLabeling: false,
          maxPrompts: null, // Unlimited prompts for paid tiers
          runFrequency: 'daily',
          isFreeTier: false,
        };
      case 'growth':
        return {
          promptsPerDay: quotas.promptsPerDay,
          providersPerPrompt: quotas.providersPerPrompt,
          maxUsers: quotas.maxUsers,
          allowedProviders: getAllowedProviders('growth'),
          hasRecommendations: true,
          hasCompetitorAnalysis: true,
          hasAdvancedScoring: true,
          hasPrioritySupport: true,
          hasWhiteLabeling: false,
          maxPrompts: null,
          runFrequency: 'daily',
          isFreeTier: false,
        };
      case 'pro':
        return {
          promptsPerDay: quotas.promptsPerDay,
          providersPerPrompt: quotas.providersPerPrompt,
          maxUsers: quotas.maxUsers,
          allowedProviders: getAllowedProviders('pro'),
          hasRecommendations: true,
          hasCompetitorAnalysis: true,
          hasAdvancedScoring: true,
          hasPrioritySupport: false,
          hasWhiteLabeling: false,
          maxPrompts: null,
          runFrequency: 'daily',
          isFreeTier: false,
        };
      default:
        // Free tier - limited access
        return {
          promptsPerDay: 5,
          providersPerPrompt: 1,
          maxUsers: 1,
          allowedProviders: getAllowedProviders('free'),
          hasRecommendations: false,
          hasCompetitorAnalysis: false,
          hasAdvancedScoring: false,
          hasPrioritySupport: false,
          hasWhiteLabeling: false,
          maxPrompts: 5, // Can only track 5 prompts total
          runFrequency: 'weekly', // Weekly runs only
          isFreeTier: true,
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
    if (limits.hasAdvancedScoring) {
      return { 
        hasAccess: true,
      };
    }
    return {
      hasAccess: false,
      reason: 'Advanced scoring requires Growth plan or higher',
      upgradeRequired: true,
    };
  };


  const canCreatePrompts = (currentCount: number): FeatureGate => {
    // Free tier has special max prompts limit (not per day, but total)
    if (isFreeTier && limits.maxPrompts !== null) {
      if (currentCount >= limits.maxPrompts) {
        return {
          hasAccess: false,
          reason: `Free tier is limited to ${limits.maxPrompts} prompts. Upgrade to track more.`,
          upgradeRequired: true,
        };
      }
      return { hasAccess: true };
    }
    
    // Check valid access for paid tiers
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
    // If subscription is still loading, deny access to prevent bypass
    if (authLoading) {
      return { hasAccess: false, reason: 'Loading subscription data...' };
    }
    
    // SECURITY: Log access checks for audit trail
    console.log('[SUBSCRIPTION_GATE] Access check:', {
      hasValidAccess,
      subscribed: subscriptionData?.subscribed,
      trial_expires_at: subscriptionData?.trial_expires_at,
      payment_collected: subscriptionData?.payment_collected,
      currentTier,
      isFreeTier
    });
    
    // Free tier users have access (with feature restrictions)
    if (isFreeTier) {
      return { hasAccess: true };
    }
    
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
    isFreeTier,
    limits,
    isOnTrial,
    trialExpired,
    daysRemainingInTrial,
    trialExpiresAt,
    isBypassUser, // Expose bypass status for UI feedback
    canAccessRecommendations,
    canAccessCompetitorAnalysis,
    canAccessAdvancedScoring,
    canCreatePrompts,
    hasAccessToApp,
  };
}