import { useState } from 'react';
import { Layout } from '@/components/Layout';
import { PricingCard } from '@/components/PricingCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';

export default function Pricing() {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const { subscriptionData } = useAuth();

  const pricingTiers = [
    {
      tier: 'starter' as const,
      title: 'Starter',
      description: 'Perfect for getting started with AI search visibility tracking',
      monthlyPrice: 19,
      yearlyPrice: 190,
      features: [
        'Up to 10 prompts to track daily',
        '2 AI providers (OpenAI + Perplexity)',
        'Basic visibility scoring',
        'Email support',
        'Brand catalog tracking',
        'Domain verification & locking'
      ],
      limitations: [
        'No competitor analysis',
        'No optimization recommendations',
        'Limited to basic reporting'
      ]
    },
    {
      tier: 'growth' as const,
      title: 'Growth',
      description: 'Best for businesses serious about AI search optimization',
      monthlyPrice: 69,
      yearlyPrice: 690,
      features: [
        'Up to 50 prompts to track daily',
        '3 AI providers (OpenAI, Perplexity, Gemini)',
        'Advanced visibility scoring',
        'Competitor analysis & tracking',
        'AI-powered optimization recommendations',
        'Priority email support',
        'Advanced reporting & insights',
        'Brand catalog tracking',
        'Domain verification & locking'
      ],
      limitations: [],
      isPopular: true
    },
    {
      tier: 'pro' as const,
      title: 'Pro',
      description: 'For enterprises and agencies managing multiple brands',
      monthlyPrice: 199,
      yearlyPrice: 1990,
      features: [
        'Up to 200 prompts to track daily',
        '3 AI providers (OpenAI, Perplexity, Gemini)',
        'Advanced visibility scoring',
        'Comprehensive competitor analysis',
        'AI-powered optimization recommendations',
        'Priority support + dedicated account manager',
        'Advanced reporting & insights',
        'API access for integrations',
        'White-label reporting',
        'Brand catalog tracking',
        'Domain verification & locking'
      ],
      limitations: []
    }
  ];

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-4">Choose Your Plan</h1>
          <p className="text-lg text-muted-foreground mb-6">
            Scale your AI search visibility tracking with plans designed for every business size
          </p>
          
          {/* Billing Toggle */}
          <div className="flex items-center justify-center space-x-4 mb-8">
            <span className={billingCycle === 'monthly' ? 'font-medium' : 'text-muted-foreground'}>
              Monthly
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setBillingCycle(billingCycle === 'monthly' ? 'yearly' : 'monthly')}
              className="relative w-16 h-8"
            >
              <div
                className={`absolute w-6 h-6 bg-primary rounded transition-transform ${
                  billingCycle === 'yearly' ? 'translate-x-3' : '-translate-x-3'
                }`}
              />
            </Button>
            <span className={`${billingCycle === 'yearly' ? 'font-medium' : 'text-muted-foreground'} flex items-center`}>
              Yearly
              <Badge variant="secondary" className="ml-2">Save 17%</Badge>
            </span>
          </div>
        </div>

        {/* Current Subscription Status */}
        {subscriptionData && (
          <div className="mb-8">
            <Card>
              <CardHeader>
                <CardTitle>Current Subscription</CardTitle>
                <CardDescription>
                  You are currently on the {subscriptionData.subscription_tier || 'free'} plan
                  {subscriptionData.subscription_end && (
                    <> (expires {new Date(subscriptionData.subscription_end).toLocaleDateString()})</>
                  )}
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        )}

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-8 mb-12">
          {pricingTiers.map((tier) => (
            <PricingCard
              key={tier.tier}
              {...tier}
              billingCycle={billingCycle}
              currentTier={subscriptionData?.subscription_tier}
            />
          ))}
        </div>

        {/* FAQ Section */}
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-8">Frequently Asked Questions</h2>
          
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">What happens if I exceed my prompt limit?</CardTitle>
              </CardHeader>
              <CardContent>
                <p>If you approach your daily prompt limit, we'll notify you. You can either upgrade your plan or additional prompts will queue for the next day. We never surprise you with overage charges.</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Can I change plans anytime?</CardTitle>
              </CardHeader>
              <CardContent>
                <p>Yes! You can upgrade or downgrade your plan at any time. Changes take effect at your next billing cycle, and you'll receive prorated credits for any unused time.</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">What AI providers do you support?</CardTitle>
              </CardHeader>
              <CardContent>
                <p>We currently support OpenAI (ChatGPT), Perplexity AI, and Google Gemini. Starter plans include 2 providers, while Growth and Pro plans include all 3 providers.</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Is domain locking included in all plans?</CardTitle>
              </CardHeader>
              <CardContent>
                <p>Yes, all plans include domain verification and locking to ensure your subscription is tied to your verified domain and prevent unauthorized usage.</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
}