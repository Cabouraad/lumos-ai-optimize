import { useAuth } from '@/contexts/AuthContext';
import { getQuotasForTier } from '../../lib/tiers/quotas';

export interface FeatureGate {
  hasAccess: boolean;
  reason?: string;
  upgradeRequired?: boolean;
}

export interface TierLimits {
  promptsPerDay: number;
  providersPerPrompt: number;
  hasRecommendations: boolean;
  hasCompetitorAnalysis: boolean;
  hasAdvancedScoring: boolean;
  hasApiAccess: boolean;
  hasPrioritySupport: boolean;
  hasWhiteLabeling: boolean;
}

export function useSubscriptionGate() {
  const { subscriptionData } = useAuth();
  
  const currentTier = subscriptionData?.subscription_tier || 'free';
  const isSubscribed = subscriptionData?.subscribed || false;
  
  // Get tier limits
  const getTierLimits = (tier: string): TierLimits => {
    const quotas = getQuotasForTier(tier as any);
    
    switch (tier) {
      case 'starter':
        return {
          promptsPerDay: quotas.promptsPerDay,
          providersPerPrompt: quotas.providersPerPrompt,
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
          hasRecommendations: true,
          hasCompetitorAnalysis: true,
          hasAdvancedScoring: true,
          hasApiAccess: true,
          hasPrioritySupport: true,
          hasWhiteLabeling: true,
        };
      default:
        return {
          promptsPerDay: 5, // Free tier gets 5 prompts
          providersPerPrompt: 1,
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

  // Feature gate functions
  const canAccessRecommendations = (): FeatureGate => {
    if (limits.hasRecommendations) {
      return { hasAccess: true };
    }
    return {
      hasAccess: false,
      reason: 'Recommendations require Growth plan or higher',
      upgradeRequired: true,
    };
  };

  const canAccessCompetitorAnalysis = (): FeatureGate => {
    if (limits.hasCompetitorAnalysis) {
      return { hasAccess: true };
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
    if (currentCount < limits.promptsPerDay) {
      return { hasAccess: true };
    }
    return {
      hasAccess: false,
      reason: `Daily prompt limit reached (${limits.promptsPerDay})`,
      upgradeRequired: currentTier !== 'pro',
    };
  };

  return {
    currentTier,
    isSubscribed,
    limits,
    canAccessRecommendations,
    canAccessCompetitorAnalysis,
    canAccessAdvancedScoring,
    canAccessApiFeatures,
    canCreatePrompts,
  };
}