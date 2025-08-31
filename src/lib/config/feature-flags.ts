/**
 * Feature flags configuration
 * All flags default to OFF for safety
 */

export interface FeatureFlags {
  FEATURE_SAFE_RECO: boolean;
  FEATURE_STRICT_COMPETITORS: boolean;
  FEATURE_ENHANCED_LOGGING: boolean;
  FEATURE_DEBUG_MODE: boolean;
  FEATURE_BATCH_OPTIMIZATION: boolean;
}

const DEFAULT_FLAGS: FeatureFlags = {
  FEATURE_SAFE_RECO: false,
  FEATURE_STRICT_COMPETITORS: false,
  FEATURE_ENHANCED_LOGGING: false,
  FEATURE_DEBUG_MODE: false,
  FEATURE_BATCH_OPTIMIZATION: false,
};

// Override flags from environment in development
const getFeatureFlags = (): FeatureFlags => {
  if (import.meta.env?.DEV) {
    return {
      ...DEFAULT_FLAGS,
      FEATURE_ENHANCED_LOGGING: import.meta.env.VITE_FEATURE_ENHANCED_LOGGING === 'true',
      FEATURE_DEBUG_MODE: import.meta.env.VITE_FEATURE_DEBUG_MODE === 'true',
    };
  }
  
  return DEFAULT_FLAGS;
};

export const featureFlags = getFeatureFlags();

export const isFeatureEnabled = (flag: keyof FeatureFlags): boolean => {
  return featureFlags[flag];
};