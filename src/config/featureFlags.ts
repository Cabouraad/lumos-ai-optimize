/**
 * Feature flags configuration for maintenance and optimization features
 * All flags default to FALSE for safety - enable selectively for testing
 */

export interface OptimizationFeatureFlags {
  // Query optimization flags
  FEATURE_BULK_QUERIES: boolean;
  FEATURE_RESPONSE_CACHE: boolean;
  
  // Detection and processing flags  
  FEATURE_STRICT_COMPETITOR_DETECT: boolean;
  FEATURE_DETECTOR_SHADOW: boolean;
  FEATURE_ANALYZER_V2: boolean; // V2 brand analyzer with enhanced rulesets
  
  // UI optimization flags
  FEATURE_LIGHT_UI: boolean;
  FEATURE_A11Y: boolean;
  
  // Billing and security flags
  FEATURE_TRIAL_GRACE: boolean;
  FEATURE_BACKEND_QUOTA_ENFORCE: boolean;
  FEATURE_STRICT_AUTH_VALIDATION: boolean;
  FEATURE_RATE_LIMITING: boolean;

  // Phase 2 Ultra-Safe Features
  FEATURE_DATA_FETCH_CACHE: boolean;
  FEATURE_ONBOARDING_PROGRESS_TRACKER: boolean;
  FEATURE_SUBSCRIPTION_STATE_OBSERVER: boolean;
  FEATURE_ENHANCED_ERROR_RESPONSES: boolean;
}

const DEFAULT_OPTIMIZATION_FLAGS: OptimizationFeatureFlags = {
  FEATURE_BULK_QUERIES: false,
  FEATURE_RESPONSE_CACHE: false, 
  FEATURE_STRICT_COMPETITOR_DETECT: false,
  FEATURE_DETECTOR_SHADOW: false,
  FEATURE_ANALYZER_V2: false, // Default OFF for safety
  FEATURE_LIGHT_UI: false,
  FEATURE_A11Y: false,
  FEATURE_TRIAL_GRACE: false,
  FEATURE_BACKEND_QUOTA_ENFORCE: true, // ENABLED for security
  FEATURE_STRICT_AUTH_VALIDATION: true, // ENABLED for security
  FEATURE_RATE_LIMITING: true, // ENABLED for security

  // Phase 2 Ultra-Safe Features - OFF by default for gradual rollout
  FEATURE_DATA_FETCH_CACHE: false,
  FEATURE_ONBOARDING_PROGRESS_TRACKER: false,
  FEATURE_SUBSCRIPTION_STATE_OBSERVER: false,
  FEATURE_ENHANCED_ERROR_RESPONSES: false,
};

// Use default flags - no environment variable overrides
const getOptimizationFeatureFlags = (): OptimizationFeatureFlags => {
  return DEFAULT_OPTIMIZATION_FLAGS;
};

export const optimizationFlags = getOptimizationFeatureFlags();

export const isOptimizationFeatureEnabled = (flag: keyof OptimizationFeatureFlags): boolean => {
  return optimizationFlags[flag];
};

// Logging helper for feature flag usage
export const logFeatureFlagUsage = (flag: keyof OptimizationFeatureFlags, context: string) => {
  // Simplified logging without environment checks
  console.log(`🚩 Feature flag ${flag} checked in ${context}:`, optimizationFlags[flag]);
};

// Feature flag guard helper
export const withFeatureFlag = <T>(
  flag: keyof OptimizationFeatureFlags,
  enabledBehavior: () => T,
  defaultBehavior: () => T,
  context?: string
): T => {
  if (context) {
    logFeatureFlagUsage(flag, context);
  }
  
  return isOptimizationFeatureEnabled(flag) ? enabledBehavior() : defaultBehavior();
};