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
  FEATURE_ANALYZER_V2: boolean;
  AUDIT_UI: boolean;
}

const DEFAULT_FLAGS: FeatureFlags = {
  FEATURE_SAFE_RECO: false,
  FEATURE_STRICT_COMPETITORS: false,
  FEATURE_ENHANCED_LOGGING: false,
  FEATURE_DEBUG_MODE: false,
  FEATURE_BATCH_OPTIMIZATION: false,
  FEATURE_CONDENSED_UI: false,
  FEATURE_SCHEDULING_NOTICES: false,
  FEATURE_WEEKLY_REPORT: true, // Enable weekly reports by default
  FEATURE_BILLING_BYPASS: false,
  FEATURE_ANALYZER_V2: false, // Default off for safety
  AUDIT_UI: true, // Enable audit UI by default for admins
};

// Use default flags - no environment variable overrides
const getFeatureFlags = (): FeatureFlags => {
  return DEFAULT_FLAGS;
};

export const featureFlags = getFeatureFlags();

export const isFeatureEnabled = (flag: keyof FeatureFlags): boolean => {
  return featureFlags[flag];
};