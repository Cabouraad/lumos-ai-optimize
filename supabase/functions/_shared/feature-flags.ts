/**
 * Feature flags for edge functions - minimal inline version
 * Only includes flags needed by edge functions
 */

export interface EdgeFeatureFlags {
  FEATURE_DETECTOR_SHADOW: boolean;
  FEATURE_PROMINENCE_FIX: boolean;
  FEATURE_BILLING_BYPASS: boolean;
  FEATURE_GOOGLE_AIO: boolean;
}

// Simple inline feature flag check for edge functions
export function isEdgeFeatureEnabled(flag: keyof EdgeFeatureFlags): boolean {
  // For edge functions, feature flags are always OFF by default for safety
  // Enable them via environment variables only when needed for testing
  const envVar = `FEATURE_${flag.replace('FEATURE_', '')}`;
  return Deno.env.get(envVar) === 'true';
}