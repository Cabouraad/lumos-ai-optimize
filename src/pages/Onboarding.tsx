import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { PricingCard } from '@/components/PricingCard';

export default function Onboarding() {
  const { user, orgData } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedPlan, setSelectedPlan] = useState<'starter' | 'growth' | 'pro'>('growth');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [formData, setFormData] = useState({
    orgName: '',
    domain: '',
    industry: '',
    keywords: '',
    competitors: ''
  });

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (orgData) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSubscriptionSetup = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: {
          tier: selectedPlan,
          billingCycle,
        },
      });

      if (error) throw error;
      if (data?.url) {
        // Store onboarding data temporarily to complete after payment
        sessionStorage.setItem('onboarding-data', JSON.stringify(formData));
        window.open(data.url, '_blank');
        // Don't redirect immediately - let them complete payment first
        toast({
          title: "Payment processing",
          description: "Complete your payment to finish setting up your account.",
        });
      }
    } catch (error: any) {
      console.error("Subscription error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to create subscription",
        variant: "destructive",
      });
    }
    setLoading(false);
  };

  const handleCompleteOnboarding = async () => {
    setLoading(true);

    try {
      // Get current session for JWT token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("Not authenticated");
      }

      // Call onboarding edge function
      const { data, error } = await supabase.functions.invoke('onboarding', {
        body: {
          name: formData.orgName,
          domain: formData.domain,
          industry: formData.industry,
          keywords: formData.keywords,
          competitors: formData.competitors
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: "Welcome to Llumos!",
        description: "Your organization has been set up successfully.",
      });

      // Clear temporary storage
      sessionStorage.removeItem('onboarding-data');
      
      // Force refresh auth context
      window.location.reload();
    } catch (error: any) {
      console.error("Onboarding error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to complete setup",
        variant: "destructive",
      });
    }

    setLoading(false);
  };

  const pricingTiers = [
    {
      tier: 'starter' as const,
      title: 'Starter',
      description: 'Perfect for getting started',
      monthlyPrice: 19,
      yearlyPrice: 190,
      features: [
        '10 prompts/day',
        '2 AI providers',
        'Basic visibility scoring',
        'Domain locking'
      ],
      limitations: [
        'No competitor analysis',
        'No recommendations'
      ]
    },
    {
      tier: 'growth' as const,
      title: 'Growth',
      description: 'Best for growing businesses',
      monthlyPrice: 69,
      yearlyPrice: 690,
      features: [
        '50 prompts/day',
        '3 AI providers',
        'Advanced scoring',
        'Competitor analysis',
        'AI recommendations',
        'Priority support'
      ],
      limitations: [],
      isPopular: true
    },
    {
      tier: 'pro' as const,
      title: 'Pro',
      description: 'For enterprises & agencies',
      monthlyPrice: 199,
      yearlyPrice: 1990,
      features: [
        '200 prompts/day',
        '3 AI providers',
        'Advanced scoring',
        'Full competitor analysis',
        'AI recommendations',
        'API access',
        'White-label reports'
      ],
      limitations: []
    }
  ];

  if (currentStep === 1) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Welcome to Llumos</CardTitle>
            <CardDescription>
              Let's set up your organization to start optimizing your AI search visibility.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => { e.preventDefault(); setCurrentStep(2); }} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="orgName">Organization Name *</Label>
                <Input
                  id="orgName"
                  value={formData.orgName}
                  onChange={(e) => setFormData(prev => ({ ...prev, orgName: e.target.value }))}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="domain">Domain *</Label>
                <Input
                  id="domain"
                  placeholder="example.com"
                  value={formData.domain}
                  onChange={(e) => setFormData(prev => ({ ...prev, domain: e.target.value }))}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Your domain will be locked to your account for security
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="industry">Industry</Label>
                <Input
                  id="industry"
                  placeholder="e.g., SaaS, E-commerce, Healthcare"
                  value={formData.industry}
                  onChange={(e) => setFormData(prev => ({ ...prev, industry: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="keywords">Target Keywords</Label>
                <Textarea
                  id="keywords"
                  placeholder="e.g., project management, task tracking, productivity"
                  value={formData.keywords}
                  onChange={(e) => setFormData(prev => ({ ...prev, keywords: e.target.value }))}
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">
                  We'll use these to suggest relevant prompts to track
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="competitors">Competitors (Optional)</Label>
                <Textarea
                  id="competitors"
                  placeholder="e.g., Notion, Asana, Monday.com"
                  value={formData.competitors}
                  onChange={(e) => setFormData(prev => ({ ...prev, competitors: e.target.value }))}
                  rows={3}
                />
              </div>

              <Button type="submit" className="w-full">
                Continue to Pricing
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="container mx-auto max-w-6xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-4">Choose Your Plan</h1>
          <p className="text-lg text-muted-foreground mb-6">
            Complete your setup by selecting the plan that fits your needs
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
              <span className="ml-2 text-sm text-green-600">Save 17%</span>
            </span>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          {pricingTiers.map((tier) => (
            <Card 
              key={tier.tier} 
              className={`cursor-pointer transition-all ${
                selectedPlan === tier.tier 
                  ? 'ring-2 ring-primary border-primary' 
                  : 'hover:border-primary/50'
              } ${tier.isPopular ? 'relative' : ''}`}
              onClick={() => setSelectedPlan(tier.tier)}
            >
              {tier.isPopular && (
                <div className="absolute -top-2 left-1/2 -translate-x-1/2">
                  <span className="bg-primary text-primary-foreground px-3 py-1 rounded-full text-sm font-medium">
                    Most Popular
                  </span>
                </div>
              )}
              
              <CardHeader className="text-center pb-2">
                <CardTitle className="text-xl">{tier.title}</CardTitle>
                <CardDescription className="text-sm">{tier.description}</CardDescription>
                <div className="mt-4">
                  <span className="text-3xl font-bold">
                    ${billingCycle === 'yearly' ? tier.yearlyPrice : tier.monthlyPrice}
                  </span>
                  <span className="text-muted-foreground">
                    /{billingCycle === 'yearly' ? 'year' : 'month'}
                  </span>
                  {billingCycle === 'yearly' && (
                    <div className="text-sm text-green-600 font-medium">
                      Save ~17% annually
                    </div>
                  )}
                </div>
              </CardHeader>

              <CardContent>
                <ul className="space-y-2">
                  {tier.features.map((feature, index) => (
                    <li key={index} className="flex items-center text-sm">
                      <svg className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>{feature}</span>
                    </li>
                  ))}
                  {tier.limitations.map((limitation, index) => (
                    <li key={index} className="flex items-center text-sm text-muted-foreground">
                      <svg className="h-4 w-4 text-muted-foreground mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      <span>{limitation}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="flex justify-center space-x-4">
          <Button 
            variant="outline" 
            onClick={() => setCurrentStep(1)}
            disabled={loading}
          >
            Back to Details
          </Button>
          
          <Button 
            onClick={selectedPlan === 'starter' ? handleCompleteOnboarding : handleSubscriptionSetup}
            disabled={loading}
            size="lg"
          >
            {loading 
              ? 'Processing...' 
              : selectedPlan === 'starter' 
                ? 'Start Free Trial' 
                : `Subscribe to ${pricingTiers.find(t => t.tier === selectedPlan)?.title}`
            }
          </Button>
        </div>
        
        {selectedPlan === 'starter' && (
          <p className="text-center text-sm text-muted-foreground mt-4">
            Start with our free tier - upgrade anytime as you grow
          </p>
        )}
      </div>
    </div>
  );
}