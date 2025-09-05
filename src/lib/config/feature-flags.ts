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
  FEATURE_CONDENSED_UI: boolean;
  FEATURE_SCHEDULING_NOTICES: boolean;
  FEATURE_WEEKLY_REPORT: boolean;
  FEATURE_BILLING_BYPASS: boolean;
}

const DEFAULT_FLAGS: FeatureFlags = {
  FEATURE_SAFE_RECO: false,
  FEATURE_STRICT_COMPETITORS: false,
  FEATURE_ENHANCED_LOGGING: false,
  FEATURE_DEBUG_MODE: false,
  FEATURE_BATCH_OPTIMIZATION: false,
  FEATURE_CONDENSED_UI: false,
  FEATURE_SCHEDULING_NOTICES: false,
  FEATURE_WEEKLY_REPORT: false,
  FEATURE_BILLING_BYPASS: false,
};

// Override flags from environment in development
const getFeatureFlags = (): FeatureFlags => {
  if (import.meta.env?.DEV) {
    return {
      ...DEFAULT_FLAGS,
      FEATURE_ENHANCED_LOGGING: import.meta.env.VITE_FEATURE_ENHANCED_LOGGING === 'true',
      FEATURE_DEBUG_MODE: import.meta.env.VITE_FEATURE_DEBUG_MODE === 'true',
      FEATURE_SAFE_RECO: import.meta.env.VITE_FEATURE_SAFE_RECO === 'true',
      FEATURE_STRICT_COMPETITORS: import.meta.env.VITE_FEATURE_STRICT_COMPETITORS === 'true',
      FEATURE_CONDENSED_UI: import.meta.env.VITE_FEATURE_CONDENSED_UI === 'true',
      FEATURE_SCHEDULING_NOTICES: import.meta.env.VITE_FEATURE_SCHEDULING_NOTICES === 'true',
      FEATURE_WEEKLY_REPORT: import.meta.env.VITE_FEATURE_WEEKLY_REPORT === 'true',
      FEATURE_BILLING_BYPASS: import.meta.env.VITE_FEATURE_BILLING_BYPASS === 'true',
    };
  }
  
  return DEFAULT_FLAGS;
};

export const featureFlags = getFeatureFlags();

export const isFeatureEnabled = (flag: keyof FeatureFlags): boolean => {
  return featureFlags[flag];
};