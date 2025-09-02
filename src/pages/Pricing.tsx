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
      monthlyPrice: 29,
      yearlyPrice: 290,
      features: [
        'Up to 25 prompts to track daily',
        '2 AI providers (OpenAI + Perplexity)',
        'Basic visibility scoring',
        'Email support',
        'Brand catalog tracking',
        'Domain verification & locking'
      ],
      limitations: [
        'No competitor analysis',
        'No visibility optimizations',
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
        'Up to 100 prompts to track daily',
        '3 AI providers (OpenAI, Perplexity, Gemini)',
        'Advanced visibility scoring',
        'Competitor analysis & tracking',
        'AI-powered visibility optimizations',
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
        'Up to 300 prompts to track daily',
        '3 AI providers (OpenAI, Perplexity, Gemini)',
        'Advanced visibility scoring',
        'Comprehensive competitor analysis',
        'AI-powered visibility optimizations',
        'Priority support + dedicated account manager',
        'Advanced reporting & insights',
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
          <p className="text-lg text-muted-foreground mb-4">
            Start tracking your AI search visibility today. All plans require a payment method.
          </p>
          <div className="bg-green-50 dark:bg-green-950 p-4 rounded-lg border border-green-200 dark:border-green-800 mb-6">
            <p className="text-sm text-green-800 dark:text-green-200">
              <strong>Starter Plan Special:</strong> Get a 7-day free trial! No charge until your trial ends.
            </p>
          </div>
          
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
                <CardTitle className="text-lg">Do you offer a free trial?</CardTitle>
              </CardHeader>
              <CardContent>
                <p>Yes! The Starter plan includes a 7-day free trial. You'll need to provide a payment method, but you won't be charged until your trial period ends. You can cancel anytime during the trial at no cost.</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Is there a free plan?</CardTitle>
              </CardHeader>
              <CardContent>
                <p>We don't offer a free tier to ensure we can provide the best AI search visibility tracking experience. However, our Starter plan includes a 7-day free trial so you can fully evaluate our platform risk-free.</p>
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