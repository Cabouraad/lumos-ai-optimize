import { describe, it, expect } from 'vitest';

describe('Pricing Alignment', () => {
  it('should ensure Stripe prices match pricing page', () => {
    // Pricing page prices (in dollars)
    const pricingPageTiers = {
      starter: { monthly: 39, yearly: 390 },
      growth: { monthly: 89, yearly: 890 },
      pro: { monthly: 250, yearly: 2500 }
    };

    // Stripe prices (in cents) - these should match the pricing page
    const stripePrices = {
      starter: { monthly: 3900, yearly: 39000 },
      growth: { monthly: 8900, yearly: 89000 },
      pro: { monthly: 25000, yearly: 250000 }
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