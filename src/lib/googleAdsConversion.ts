/**
 * Google Ads Conversion Tracking
 * Tracks purchase conversions for Google Ads campaigns
 */

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
  }
}

/**
 * Reports a purchase conversion to Google Ads
 * @param transactionId - Optional transaction ID for deduplication
 */
export function trackGoogleAdsConversion(transactionId?: string) {
  try {
    if (typeof window === 'undefined' || !window.gtag) {
      console.warn('[GoogleAdsConversion] gtag not available');
      return;
    }

    window.gtag('event', 'conversion', {
      'send_to': 'AW-17742756847/gX0BCP-BysUbEO_3s4xC',
      'transaction_id': transactionId || '',
    });

    console.log('[GoogleAdsConversion] Purchase conversion tracked', { transactionId });
  } catch (error) {
    console.error('[GoogleAdsConversion] Failed to track conversion:', error);
  }
}
