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
  
  // UI optimization flags
  FEATURE_LIGHT_UI: boolean;
  FEATURE_A11Y: boolean;
  
  // Billing and security flags
  FEATURE_TRIAL_GRACE: boolean;
  FEATURE_BACKEND_QUOTA_ENFORCE: boolean;
  FEATURE_STRICT_AUTH_VALIDATION: boolean;
  FEATURE_RATE_LIMITING: boolean;
}

const DEFAULT_OPTIMIZATION_FLAGS: OptimizationFeatureFlags = {
  FEATURE_BULK_QUERIES: false,
  FEATURE_RESPONSE_CACHE: false, 
  FEATURE_STRICT_COMPETITOR_DETECT: false,
  FEATURE_DETECTOR_SHADOW: false,
  FEATURE_LIGHT_UI: false,
  FEATURE_A11Y: false,
  FEATURE_TRIAL_GRACE: false,
  FEATURE_BACKEND_QUOTA_ENFORCE: true, // ENABLED for security
  FEATURE_STRICT_AUTH_VALIDATION: true, // ENABLED for security
  FEATURE_RATE_LIMITING: true, // ENABLED for security
};

// Override flags from environment in development only
const getOptimizationFeatureFlags = (): OptimizationFeatureFlags => {
  if (import.meta.env?.DEV) {
    return {
      ...DEFAULT_OPTIMIZATION_FLAGS,
      FEATURE_BULK_QUERIES: import.meta.env.VITE_FEATURE_BULK_QUERIES === 'true',
      FEATURE_RESPONSE_CACHE: import.meta.env.VITE_FEATURE_RESPONSE_CACHE === 'true',
      FEATURE_STRICT_COMPETITOR_DETECT: import.meta.env.VITE_FEATURE_STRICT_COMPETITOR_DETECT === 'true',
      FEATURE_DETECTOR_SHADOW: import.meta.env.VITE_FEATURE_DETECTOR_SHADOW === 'true',
      FEATURE_LIGHT_UI: import.meta.env.VITE_FEATURE_LIGHT_UI === 'true',
      FEATURE_A11Y: import.meta.env.VITE_FEATURE_A11Y === 'true',
      FEATURE_TRIAL_GRACE: import.meta.env.VITE_FEATURE_TRIAL_GRACE === 'true',
      FEATURE_BACKEND_QUOTA_ENFORCE: import.meta.env.VITE_FEATURE_BACKEND_QUOTA_ENFORCE !== 'false', // Default ON
      FEATURE_STRICT_AUTH_VALIDATION: import.meta.env.VITE_FEATURE_STRICT_AUTH_VALIDATION !== 'false', // Default ON
      FEATURE_RATE_LIMITING: import.meta.env.VITE_FEATURE_RATE_LIMITING !== 'false', // Default ON
    };
  }
  
  return DEFAULT_OPTIMIZATION_FLAGS;
};

export const optimizationFlags = getOptimizationFeatureFlags();

export const isOptimizationFeatureEnabled = (flag: keyof OptimizationFeatureFlags): boolean => {
  return optimizationFlags[flag];
};

// Logging helper for feature flag usage
export const logFeatureFlagUsage = (flag: keyof OptimizationFeatureFlags, context: string) => {
  if (import.meta.env?.DEV) {
    console.log(`🚩 Feature flag ${flag} checked in ${context}:`, optimizationFlags[flag]);
  }
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