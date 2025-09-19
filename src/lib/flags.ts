/**
 * Runtime feature flag utilities for Google AI Overviews
 */

export const ENABLE_GOOGLE_AIO = process?.env?.ENABLE_GOOGLE_AIO === 'true';
export const hasSerpApi = !!process?.env?.SERPAPI_KEY;

// Weight configuration for AIO in scoring
export const WEIGHT_AIO = parseFloat(process?.env?.WEIGHT_AIO || '1.0');

/**
 * Check if Google AI Overviews is enabled and configured
 */
export function isGoogleAioEnabled(): boolean {
  return ENABLE_GOOGLE_AIO && hasSerpApi;
}

/**
 * Get AIO weight for scoring calculations
 */
export function getAioWeight(): number {
  return Math.max(0, Math.min(2, WEIGHT_AIO)); // Clamp between 0-2
}