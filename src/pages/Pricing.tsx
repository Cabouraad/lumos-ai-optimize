import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PricingCard } from '@/components/PricingCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EdgeFunctionClient } from '@/lib/edge-functions/client';
import { useToast } from '@/hooks/use-toast';
import { Logo } from '@/components/Logo';
import { ThemeToggle } from '@/components/ThemeToggle';
import { FeatureComparisonTable } from '@/components/pricing/FeatureComparisonTable';

export default function Pricing() {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [showDiagModal, setShowDiagModal] = useState(false);
  const [diagResult, setDiagResult] = useState<any>(null);
  const [diagLoading, setDiagLoading] = useState(false);
  const { subscriptionData } = useAuth();
  const { toast } = useToast();

  // Show dev tools in non-production or with ?dev=1
  const isDev = import.meta.env.DEV || new URLSearchParams(window.location.search).has('dev');

  const checkEdgeConnectivity = async () => {
    setDiagLoading(true);
    setDiagResult(null);
    setShowDiagModal(true);

    try {
      const { data, error } = await EdgeFunctionClient.invoke('diag');
      
      if (error) {
        setDiagResult({ error: error.message || 'Unknown error', details: error });
        toast({
          title: "Edge Connectivity Failed",
          description: `Error: ${error.message || 'Unknown error'}`,
          variant: "destructive",
        });
      } else {
        setDiagResult(data);
        if (data?.ok === true && data?.allowed === true) {
          toast({
            title: "Edge Connectivity Success",
            description: "CORS and origin validation working correctly",
            variant: "default",
          });
        } else {
          toast({
            title: "Edge Connectivity Issues",
            description: `ok: ${data?.ok}, allowed: ${data?.allowed}`,
            variant: "destructive",
          });
        }
      }
    } catch (err: any) {
      const errorInfo = {
        name: err.name,
        message: err.message,
        isFetchError: err.__isFetchError,
        status: err.response?.status,
        statusText: err.response?.statusText
      };
      setDiagResult({ error: 'Network error', details: errorInfo });
      toast({
        title: "Network Error",
        description: `${err.name}: ${err.message}`,
        variant: "destructive",
      });
    }

    setDiagLoading(false);
  };

  const pricingTiers = [
    {
      tier: 'starter' as const,
      title: 'Starter',
      description: 'Perfect for getting started with AI search visibility tracking',
      monthlyPrice: 39,
      yearlyPrice: 390,
      features: [
        'Track 25 search queries your customers actually use (updated daily)',
        'Monitor on 2 major AI platforms (ChatGPT + Perplexity)',
        'See exactly how often AI platforms mention your brand',
        'Get direct email support when you need help',
        'Automatically track your brand catalog across platforms',
        'Secure your subscription with domain verification'
      ],
      limitations: [
        'No competitor benchmarking',
        'No AI-powered optimization recommendations',
        'Basic reporting only'
      ]
    },
    {
      tier: 'growth' as const,
      title: 'Growth',
      description: 'Best for businesses serious about AI search optimization',
      monthlyPrice: 89,
      yearlyPrice: 890,
      features: [
        'Track 100 search queries across all customer touchpoints (updated daily)',
        'Full coverage: ChatGPT, Perplexity, Gemini & Google AI Overviews',
        'Advanced scoring shows your exact mention rate vs competitors',
        'Track up to 3 competitors and see exactly where they win',
        'Get AI-powered recommendations to improve your ranking',
        'Priority support with faster response times',
        'Export reports and share insights with your team',
        'Comprehensive brand catalog tracking',
        'Domain verification & account security'
      ],
      limitations: [],
      isPopular: true
    },
    {
      tier: 'pro' as const,
      title: 'Pro',
      description: 'For enterprises and agencies managing multiple brands',
      monthlyPrice: 250,
      yearlyPrice: 2500,
      features: [
        'Track 300 search queries for maximum market coverage (updated daily)',
        'Full coverage: ChatGPT, Perplexity, Gemini & Google AI Overviews',
        'Advanced visibility scoring with predictive analytics',
        'Monitor up to 10 competitors with deep competitive intelligence',
        'Custom optimization plans based on your industry',
        'Dedicated account manager + priority support',
        'White-label reports for client presentations',
        'Multi-brand catalog management',
        'Enterprise-grade security & domain verification'
      ],
      limitations: []
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-bg">
      {/* Standalone Header */}
      <header className="border-b border-border/30 bg-card/30 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <Logo collapsed={false} />
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <Link to="/auth">
              <Button variant="outline">Sign In</Button>
            </Link>
            <Link to="/auth">
              <Button>Get Started</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-4">Choose Your Plan</h1>
          <p className="text-lg text-muted-foreground mb-4">
            Start tracking your AI search visibility today. All plans require a payment method.
          </p>
          <div className="bg-green-50 dark:bg-green-950 p-4 rounded-lg border border-green-200 dark:border-green-800 mb-6">
            <p className="text-sm text-green-800 dark:text-green-200">
              <strong>Starter Plan Special:</strong> Get a 7-day free trial! Payment method required but no charge until your trial ends. Cancel anytime with no fees.
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

        {/* Feature Comparison Table */}
        <div className="mb-12">
          <FeatureComparisonTable />
        </div>

        {/* What Happens After Trial */}
        <div className="max-w-3xl mx-auto mb-12">
          <Card className="shadow-elevated">
            <CardHeader>
              <CardTitle className="text-2xl text-center">What Happens After My Trial?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-4 bg-muted/30 rounded-lg">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                    <span className="text-primary font-bold">1</span>
                  </div>
                  <div>
                    <p className="font-semibold mb-1">Day 1-7: Full Access</p>
                    <p className="text-sm text-muted-foreground">
                      Enjoy complete access to all Starter plan features. No restrictions, no hidden fees.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 bg-muted/30 rounded-lg">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                    <span className="text-primary font-bold">2</span>
                  </div>
                  <div>
                    <p className="font-semibold mb-1">Day 5: Reminder Email</p>
                    <p className="text-sm text-muted-foreground">
                      We&apos;ll send you a friendly reminder that your trial is ending soon. You can cancel anytime.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 bg-muted/30 rounded-lg">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                    <span className="text-primary font-bold">3</span>
                  </div>
                  <div>
                    <p className="font-semibold mb-1">Day 7: Trial Ends</p>
                    <p className="text-sm text-muted-foreground">
                      If you haven&apos;t canceled, your subscription begins at $39/month. If you cancel before day 7, you won&apos;t be charged anything.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 bg-primary/5 border border-primary/20 rounded-lg">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                    <span className="text-primary font-bold">✓</span>
                  </div>
                  <div>
                    <p className="font-semibold mb-1">Cancel Anytime</p>
                    <p className="text-sm text-muted-foreground">
                      You can cancel your subscription at any time from your account settings. No questions asked, no cancellation fees.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
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
                <p>We currently support OpenAI (ChatGPT), Perplexity AI, Google Gemini, and Google AI Overviews. Starter plans include 2 providers (OpenAI + Perplexity), while Growth and Pro plans include all 4 providers.</p>
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

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">How do I cancel my subscription?</CardTitle>
              </CardHeader>
              <CardContent>
                <p>You can cancel anytime from your account settings. If you cancel during your trial, you won't be charged at all. If you cancel after your trial, you'll retain access until the end of your current billing period.</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Do you offer refunds?</CardTitle>
              </CardHeader>
              <CardContent>
                <p>Refunds are handled on a case-by-case basis. If you experience issues with our service, please contact support and we'll work with you to find a solution.</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">What payment methods do you accept?</CardTitle>
              </CardHeader>
              <CardContent>
                <p>We accept all major credit cards (Visa, MasterCard, American Express, Discover) through our secure payment processor Stripe. All transactions are encrypted and PCI-compliant.</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">How long does setup take?</CardTitle>
              </CardHeader>
              <CardContent>
                <p>Setup is incredibly fast! Most users are fully set up and tracking their first queries within 5 minutes. Our onboarding wizard guides you through brand verification, selecting prompts to track, and adding competitors. No technical knowledge required.</p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Dev Tools */}
        {isDev && (
          <div className="fixed bottom-4 right-4">
            <Button
              variant="outline"
              size="sm"
              onClick={checkEdgeConnectivity}
              disabled={diagLoading}
              className="text-xs bg-background/80 backdrop-blur"
            >
              {diagLoading ? 'Checking...' : 'Check Edge Connectivity'}
            </Button>
          </div>
        )}

        {/* Diagnostic Modal */}
        <Dialog open={showDiagModal} onOpenChange={setShowDiagModal}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edge Function Connectivity Test</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {diagLoading ? (
                <div className="text-center py-4">Checking connectivity...</div>
              ) : diagResult ? (
                <div className="space-y-2">
                  <div className="text-sm font-medium">Result:</div>
                  <pre className="bg-muted p-3 rounded text-xs overflow-auto max-h-96">
                    {JSON.stringify(diagResult, null, 2)}
                  </pre>
                  {diagResult.ok === true && diagResult.allowed === true && (
                    <div className="text-green-600 text-sm font-medium">
                      ✅ Connectivity and CORS working correctly
                    </div>
                  )}
                  {(diagResult.ok !== true || diagResult.allowed !== true) && !diagResult.error && (
                    <div className="text-orange-600 text-sm font-medium">
                      ⚠️ CORS/Origin issues detected
                    </div>
                  )}
                  {diagResult.error && (
                    <div className="text-red-600 text-sm font-medium">
                      ❌ Connection failed
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-muted-foreground text-sm">Click "Check Edge Connectivity" to test</div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}