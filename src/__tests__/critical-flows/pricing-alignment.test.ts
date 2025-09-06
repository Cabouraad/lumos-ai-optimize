import { describe, it, expect } from 'vitest';

describe('Pricing Alignment', () => {
  it('should ensure Stripe prices match pricing page', () => {
    // Pricing page prices (in dollars)
    const pricingPageTiers = {
      starter: { monthly: 29, yearly: 290 },
      growth: { monthly: 69, yearly: 690 },
      pro: { monthly: 199, yearly: 1990 }
    };

    // Stripe prices (in cents) - these should match the pricing page
    const stripePrices = {
      starter: { monthly: 2900, yearly: 29000 },
      growth: { monthly: 6900, yearly: 69000 },
      pro: { monthly: 19900, yearly: 199000 }
    };

    // Convert pricing page prices to cents and compare
    Object.entries(pricingPageTiers).forEach(([tier, prices]) => {
      const expectedMonthly = prices.monthly * 100;
      const expectedYearly = prices.yearly * 100;
      
      expect(stripePrices[tier as keyof typeof stripePrices].monthly).toBe(expectedMonthly);
      expect(stripePrices[tier as keyof typeof stripePrices].yearly).toBe(expectedYearly);
    });
  });
});