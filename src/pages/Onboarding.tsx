import { useState, useRef, useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscriptionGate } from '@/hooks/useSubscriptionGate';
import { EdgeFunctionClient } from '@/lib/edge-functions/client';
import { EnhancedEdgeFunctionClient } from '@/lib/edge-functions/enhanced-client';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { PricingCard } from '@/components/PricingCard';
import { Info, LogOut } from 'lucide-react';
import { isBillingBypassEligible, grantStarterBypass } from '@/lib/billing/bypass-utils';
import { openExternalUrl } from '@/lib/navigation';
import { signOutWithCleanup } from '@/lib/auth-cleanup';
import { OnboardingPromptSelection } from '@/components/onboarding/OnboardingPromptSelection';
import { acceptMultipleSuggestions } from '@/lib/suggestions/data';
import { updateOrgIdCache } from '@/lib/org-id';

export default function Onboarding() {
  const { user, orgData, subscriptionData, subscriptionLoading } = useAuth();
  const { hasAccessToApp } = useSubscriptionGate();
  const { toast } = useToast();
  const navigate = useNavigate();

  // Only redirect to dashboard if user truly has access (paid or valid trial)
  const access = hasAccessToApp();
  if (orgData?.org_id && access.hasAccess) {
    return <Navigate to="/dashboard" replace />;
  }
  const [loading, setLoading] = useState(false);
  const [autoFillLoading, setAutoFillLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(1); // 1: Basic info, 2: Business Context, 3: Pricing, 4: Prompts
  const [promptSuggestionsGenerated, setPromptSuggestionsGenerated] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<'starter' | 'growth' | 'pro'>(() => {
    const saved = sessionStorage.getItem('selected-plan');
    return (saved as 'starter' | 'growth' | 'pro') || 'growth';
  });
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>(() => {
    const saved = sessionStorage.getItem('billing-cycle');
    return (saved as 'monthly' | 'yearly') || 'monthly';
  });
  const [subscriptionCompleted, setSubscriptionCompleted] = useState(false);
  const [showManualFillBanner, setShowManualFillBanner] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);
  
  // REMOVED: Auto-complete logic that could bypass payment
  const businessContextRef = useRef<HTMLDivElement>(null);
  const [formData, setFormData] = useState(() => {
    // Try to recover from sessionStorage on component mount
    const savedData = sessionStorage.getItem('onboarding-data');
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        console.log('[Onboarding] Recovered data from sessionStorage');
        return {
          orgName: parsed.name || '',
          domain: parsed.domain || '',
          industry: parsed.industry || '',
          keywords: parsed.keywords || '',
          competitors: parsed.competitors || '',
          business_description: parsed.businessDescription || '',
          products_services: parsed.productsServices || '',
          target_audience: parsed.targetAudience || ''
        };
      } catch (e) {
        console.warn('[Onboarding] Failed to parse saved data');
      }
    }
    return {
      orgName: '',
      domain: '',
      industry: '',
      keywords: '',
      competitors: '',
      business_description: '',
      products_services: '',
      target_audience: ''
    };
  });

  if (!user) {
    return <Navigate to="/signin" replace />;
  }

  // SECURITY: Remove automatic hasValidAccess check that bypassed payment
  // All users must explicitly complete payment step during onboarding


  const handleSubscriptionSetup = async () => {
    if (!selectedPlan) {
      toast({
        title: "Plan Selection Required",
        description: "Please select a plan before continuing.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    setRetryError(null);
    
    try {
      console.log(`[Onboarding] Starting subscription setup for ${selectedPlan} plan`);
      
      // Check if user is eligible for billing bypass (only for starter tier)
      if (selectedPlan === 'starter' && isBillingBypassEligible(user?.email)) {
        console.log('[Onboarding] Eligible for billing bypass - granting test access');
        await grantStarterBypass(user!.email!);
        toast({
          title: 'Test Access Granted',
          description: 'Starter subscription activated for testing.',
        });
        
        // Post-bypass entitlement check
        let attempts = 0;
        const maxAttempts = 8;
        
        while (attempts < maxAttempts) {
          await EdgeFunctionClient.checkSubscription();
          
          // Check if access is granted
          const access = hasAccessToApp();
          if (access.hasAccess) {
            console.log('[Onboarding] Test access verified - proceeding to dashboard');
            navigate('/dashboard');
            return;
          }
          
          attempts++;
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
        
        // Failed after max attempts
        throw new Error("Verification timeout - access not granted");
      }

      // Use trial checkout for Starter, regular checkout for others
      const functionName = selectedPlan === 'starter' ? 'create-trial-checkout' : 'create-checkout';
      const body = selectedPlan === 'starter' ? {} : { tier: selectedPlan, billingCycle };
      
      console.log(`[Onboarding] Calling ${functionName} edge function`, body);
      
      const { data, error } = await EnhancedEdgeFunctionClient.invoke(functionName, {
        body,
      });

      if (error) {
        console.error(`[Onboarding] ${functionName} error:`, error);
        throw error;
      }
      
      if (!data?.url) {
        console.error('[Onboarding] No checkout URL returned:', data);
        throw new Error("Failed to create checkout session - no URL returned");
      }
      
      console.log('[Onboarding] Checkout URL received, storing onboarding data');
      
      // Store onboarding data temporarily to complete after payment
      try {
        sessionStorage.setItem('onboarding-data', JSON.stringify(formData));
        sessionStorage.setItem('selected-plan', selectedPlan);
        sessionStorage.setItem('billing-cycle', billingCycle);
        console.log('[Onboarding] Data saved to sessionStorage for post-payment recovery');
      } catch (storageError) {
        console.error('[Onboarding] Failed to save to sessionStorage:', storageError);
        setLoading(false);
        toast({
          title: "Storage Error",
          description: "Please disable private browsing mode or allow storage for this site.",
          variant: "destructive"
        });
        return; // Block checkout if storage fails
      }
      
      console.log('[Onboarding] Redirecting to Stripe checkout:', data.url);
      
      // Small delay to ensure storage completes
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Redirect to Stripe checkout (robust across preview iframe/new tab)
      openExternalUrl(data.url);
      
      // Keep loading state while redirect happens
      toast({
        title: "Redirecting to Checkout",
        description: "Opening secure payment page...",
      });
      
    } catch (error: any) {
      console.error("[Onboarding] Subscription setup error:", error);
      setLoading(false);
      
      const errorMessage = error.message || "Failed to create subscription";
      setRetryError(errorMessage);
      
      toast({
        title: "Subscription Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const refreshSubscriptionWithRetry = async () => {
    setRetryError(null);
    setLoading(true);
    
    let attempts = 0;
    const maxAttempts = 6;
    
    while (attempts < maxAttempts) {
      try {
        await EdgeFunctionClient.checkSubscription();
        
        // Check if access is granted
        const access = hasAccessToApp();
        if (access.hasAccess) {
          setSubscriptionCompleted(true);
          navigate('/dashboard');
          return;
        }
        
        attempts++;
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error: any) {
        console.error('Subscription check error:', error);
        break;
      }
    }
    
    // Failed after max attempts
    setLoading(false);
    setRetryError('Failed to verify subscription access');
  };

  const handleCompleteOnboarding = async () => {
    // Validate required fields
    if (!formData.orgName || !formData.domain) {
      toast({
        title: "Missing Information",
        description: "Please provide both organization name and domain.",
        variant: "destructive"
      });
      return;
    }

    // Validate domain format
    const domainRegex = /^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/i;
    const cleanedDomain = formData.domain.replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/$/, '').toLowerCase();
    
    if (!domainRegex.test(cleanedDomain)) {
      toast({
        title: "Invalid Domain",
        description: "Please enter a valid domain format (e.g., example.com)",
        variant: "destructive"
      });
      return;
    }

    // Update formData with cleaned domain
    setFormData(prev => ({ ...prev, domain: cleanedDomain }));

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
          competitors: formData.competitors,
          business_description: formData.business_description,
          products_services: formData.products_services,
          target_audience: formData.target_audience
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: "Setup Complete!",
        description: "Your organization has been created successfully",
      });

      // Cache org ID immediately for downstream API calls
      if (data?.orgId) {
        try { updateOrgIdCache(data.orgId); } catch {}
      }

      // Clear temporary storage
      sessionStorage.removeItem('onboarding-data');
      
      // Wait for subscription refresh then re-check access
      try {
        await EdgeFunctionClient.checkSubscription();
        // Give the context providers time to update
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (_) {}

      // SECURITY: ALWAYS require payment step after org creation
      // Never automatically grant access without explicit subscriber record
      setCurrentStep(3); // Always proceed to payment step
    } catch (error: any) {
      console.error("Onboarding error:", error);
      
      // Handle domain conflict error specially
      if (error.message?.includes("domain is already registered")) {
        toast({
          title: "Domain Already in Use",
          description: "This domain is already registered by another organization. Please use a different domain or contact support if you believe this is an error.",
          variant: "destructive",
        });
      } else {
        // Generic non-2xx from Supabase client – attempt fallback check
        const genericNon2xx = typeof error?.message === 'string' && error.message.toLowerCase().includes('non-2xx');
        if (genericNon2xx && user) {
          try {
            const { data: u } = await supabase
              .from('users')
              .select('org_id')
              .eq('id', user.id)
              .maybeSingle();
            if (u?.org_id) {
              // Org actually created; proceed to payment step (never skip pricing)
              try { updateOrgIdCache(u.org_id); } catch {}
              toast({ title: 'Setup Complete!', description: 'Your organization has been created.' });
              setCurrentStep(3);
              setLoading(false);
              return;
            }
          } catch {}
        }

        toast({
          title: 'Error',
          description: error.message || 'Failed to complete setup',
          variant: 'destructive',
        });
      }
    }

    setLoading(false);
  };

  const handleGeneratePromptSuggestions = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('suggest-prompts-now');
      
      if (error) throw error;
      
      toast({
        title: "AI Suggestions Generated!",
        description: `Generated ${data?.suggestionsCreated || 0} prompt suggestions based on your business context.`,
      });
      
      setPromptSuggestionsGenerated(true);
    } catch (error: any) {
      console.error("Prompt suggestions error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to generate suggestions",
        variant: "destructive",
      });
    }
    setLoading(false);
  };

  const handlePromptSelectionComplete = async (
    selectedSuggestionIds: string[],
    manualPrompts: string[]
  ) => {
    setLoading(true);
    try {
      const result = await acceptMultipleSuggestions(selectedSuggestionIds, manualPrompts);
      
      toast({
        title: "Prompts Activated!",
        description: `${result.promptsCreated} prompt${result.promptsCreated !== 1 ? 's' : ''} are now being tracked`,
      });

      // Complete onboarding and go to dashboard
      handleFinishOnboarding();
    } catch (error: any) {
      console.error("Prompt acceptance error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to activate prompts",
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  const handleAutoFill = async () => {
    if (!formData.domain) {
      toast({
        title: "Domain Required",
        description: "Please enter your domain first to auto-fill business context.",
        variant: "destructive",
      });
      return;
    }

    setAutoFillLoading(true);
    setShowManualFillBanner(false); // Reset banner state
    
    try {
      const session = await supabase.auth.getSession();
      console.log('Auth session:', session.data.session ? 'Present' : 'Missing');
      
      const { data, error } = await supabase.functions.invoke('auto-fill-business-context', {
        body: {
          domain: formData.domain
        },
        headers: {
          Authorization: `Bearer ${session.data.session?.access_token}`,
        },
      });

      if (error) throw error;

      if (data?.success && data?.businessContext) {
        const context = data.businessContext;
        
        setFormData(prev => ({
          ...prev,
          keywords: context.keywords ? context.keywords.join(', ') : prev.keywords,
          competitors: context.competitors ? context.competitors.join(', ') : prev.competitors,
          business_description: context.business_description || prev.business_description,
          products_services: context.products_services || prev.products_services,
          target_audience: context.target_audience || prev.target_audience,
        }));

        toast({
          title: "Auto-fill Complete!",
          description: "Business context has been populated from your website.",
        });
      } else if (data?.missingApiKey) {
        toast({
          title: "OpenAI API Key Required",
          description: "Please contact support to enable auto-fill functionality.",
          variant: "destructive",
        });
      } else if (data?.manualFill || data?.suggestManual) {
        // Show soft banner and scroll to form instead of destructive toast
        setShowManualFillBanner(true);
        
        // Scroll to business context fields after a brief delay
        setTimeout(() => {
          businessContextRef.current?.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start' 
          });
        }, 300);
      }
    } catch (error: any) {
      console.error("Auto-fill error:", error);
      toast({
        title: "Auto-fill Failed",
        description: error.message || "Failed to auto-fill business context",
        variant: "destructive",
      });
    }
    setAutoFillLoading(false);
  };

  const handleSignOut = () => {
    if (confirm('Are you sure you want to sign out? This will cancel the onboarding process.')) {
      // Clear any temporary onboarding data
      sessionStorage.removeItem('onboarding-data');
      signOutWithCleanup();
    }
  };

  const handleFinishOnboarding = () => {
    toast({
      title: "Welcome to Llumos!",
      description: "Your setup is complete. Start tracking your AI visibility now!",
    });
    
    // Force refresh auth context to load org data
    window.location.href = '/dashboard';
  };

  const pricingTiers = [
    {
      tier: 'starter' as const,
      title: 'Starter',
      description: 'Perfect for getting started',
      monthlyPrice: 39,
      yearlyPrice: 390,
      features: [
        'Up to 25 prompts to track daily',
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
      monthlyPrice: 89,
      yearlyPrice: 890,
      features: [
        'Up to 100 prompts to track daily',
        '4 AI providers (OpenAI, Perplexity, Gemini, Google AI Overviews)',
        'Advanced visibility scoring',
        'Competitor analysis & tracking',
        'AI-powered visibility optimizations',
        'Priority email support'
      ],
      limitations: [],
      isPopular: true
    },
    {
      tier: 'pro' as const,
      title: 'Pro',
      description: 'For enterprises & agencies',
      monthlyPrice: 250,
      yearlyPrice: 2500,
      features: [
        'Up to 300 prompts to track daily',
        '4 AI providers (OpenAI, Perplexity, Gemini, Google AI Overviews)',
        'Advanced visibility scoring',
        'Comprehensive competitor analysis',
        'AI-powered visibility optimizations',
        'Priority support + dedicated account manager'
      ],
      limitations: []
    }
  ];

  // Step 2: Business Context (before pricing)
  if (currentStep === 2) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle>Business Context & Keywords</CardTitle>
                <CardDescription>
                  This information is required to generate relevant AI prompt suggestions. Complete this step before selecting your plan.
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSignOut}
                className="text-muted-foreground hover:text-foreground"
              >
                <LogOut className="h-4 w-4 mr-1" />
                Sign Out
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-6 p-4 bg-muted/50 rounded-lg border border-dashed">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-sm">Save time with auto-fill</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Let AI analyze your website ({formData.domain}) and automatically fill in your business context.
                  </p>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleAutoFill}
                  disabled={autoFillLoading || !formData.domain}
                >
                  {autoFillLoading ? "Auto-filling..." : "Auto-fill from Website"}
                </Button>
              </div>
            </div>
            
            {/* Manual fill banner */}
            {showManualFillBanner && (
              <Alert className="mb-6 border-blue-200 bg-blue-50 dark:bg-blue-950/30">
                <Info className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-800 dark:text-blue-200">
                  <strong>Manual input needed:</strong> We couldn't automatically extract your business context from your website. 
                  This could be due to security restrictions or the website content not being accessible. 
                  Please fill in the fields below manually.
                </AlertDescription>
              </Alert>
            )}
            
            <div ref={businessContextRef}>
            <form onSubmit={async (e) => { 
              e.preventDefault(); 
              await handleCompleteOnboarding();
            }} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="keywords_required">Target Keywords *</Label>
                <Textarea
                  id="keywords_required"
                  placeholder="e.g., project management, task tracking, productivity"
                  value={formData.keywords}
                  onChange={(e) => setFormData(prev => ({ ...prev, keywords: e.target.value }))}
                  rows={3}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Essential for generating relevant prompts that your customers might use when searching
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="business_description">Business Description *</Label>
                <Textarea
                  id="business_description"
                  placeholder="Describe what your business does, your main products/services, and what makes you unique..."
                  value={formData.business_description}
                  onChange={(e) => setFormData(prev => ({ ...prev, business_description: e.target.value }))}
                  rows={4}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="products_services">Key Products/Services *</Label>
                <Textarea
                  id="products_services"
                  placeholder="List your main products or services that customers search for..."
                  value={formData.products_services}
                  onChange={(e) => setFormData(prev => ({ ...prev, products_services: e.target.value }))}
                  rows={3}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="target_audience">Target Audience *</Label>
                <Textarea
                  id="target_audience"
                  placeholder="Describe your ideal customers - who are they, what do they need, how do they search..."
                  value={formData.target_audience}
                  onChange={(e) => setFormData(prev => ({ ...prev, target_audience: e.target.value }))}
                  rows={3}
                  required
                />
              </div>

              <div className="flex justify-between pt-4">
                <Button 
                  variant="outline" 
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  disabled={loading}
                >
                  Back
                </Button>
                <Button type="submit" disabled={loading || subscriptionLoading}>
                  {subscriptionLoading 
                    ? 'Checking subscription…' 
                    : 'Continue to Pricing'}
                </Button>
              </div>
            </form>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show completion step after suggestions are generated
  if (promptSuggestionsGenerated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-between items-start mb-4">
              <div className="flex-1"></div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSignOut}
                className="text-muted-foreground hover:text-foreground"
              >
                <LogOut className="h-4 w-4 mr-1" />
                Sign Out
              </Button>
            </div>
            <CardTitle className="text-green-600">🎉 Setup Complete!</CardTitle>
            <CardDescription>
              Your Llumos account is ready to help you track and improve your AI search visibility.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-green-50 dark:bg-green-950 p-4 rounded-lg">
              <h3 className="font-medium mb-2">What we've set up for you:</h3>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>✓ Organization profile created</li>
                <li>✓ Business context saved</li>
                <li>✓ AI prompt suggestions generated</li>
                <li>✓ Ready to track your visibility</li>
              </ul>
            </div>

            <div className="space-y-3">
              <h4 className="font-medium">Next steps:</h4>
              <div className="text-sm text-muted-foreground space-y-2">
                <p>1. <strong>Review AI Suggestions:</strong> Check the prompts we generated for you</p>
                <p>2. <strong>Run Your First Test:</strong> See how visible you are in AI responses</p>
                <p>3. <strong>Track Competitors:</strong> Monitor how you compare to competition</p>
              </div>
            </div>

            <Button onClick={handleFinishOnboarding} className="w-full" size="lg">
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Step 1: Basic organization info
  if (currentStep === 1) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle>Welcome to Llumos</CardTitle>
                <CardDescription>
                  Let's set up your organization to start optimizing your AI search visibility.
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSignOut}
                className="text-muted-foreground hover:text-foreground"
              >
                <LogOut className="h-4 w-4 mr-1" />
                Sign Out
              </Button>
            </div>
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
                Continue to Business Context
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Step 4: Prompt Selection
  if (currentStep === 4) {
    return (
      <OnboardingPromptSelection
        onContinue={handlePromptSelectionComplete}
        onBack={() => setCurrentStep(subscriptionData?.subscribed ? 2 : 3)}
        isSubscribed={!!subscriptionData?.subscribed}
      />
    );
  }

  // Step 3: Plan selection
  return (
    <div className="min-h-screen bg-background p-4">
      <div className="container mx-auto max-w-6xl">
        <div className="flex justify-end mb-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSignOut}
            className="text-muted-foreground hover:text-foreground"
          >
            <LogOut className="h-4 w-4 mr-1" />
            Sign Out
          </Button>
        </div>
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

        {/* Black Friday Promo */}
        <Card className="mb-6 border-2 border-primary/20 bg-card/50">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Black Friday — One Year Starter for $99</CardTitle>
            <CardDescription>Limited-time offer. You can also choose this instead of standard pricing.</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button size="lg" onClick={() => navigate('/black-friday')}>
              Claim Black Friday Deal
            </Button>
          </CardContent>
        </Card>

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
            onClick={() => setCurrentStep(2)}
            disabled={loading}
          >
            Back to Business Context
          </Button>
          
          <Button 
            onClick={handleSubscriptionSetup}
            disabled={loading || !selectedPlan}
            size="lg"
            className="min-w-[300px]"
          >
            {loading 
              ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin">⏳</span>
                  Redirecting to checkout...
                </span>
              )
              : `Start ${selectedPlan === 'starter' ? '7-Day Free Trial' : 'Subscription'} - ${pricingTiers.find(t => t.tier === selectedPlan)?.title} Plan`
            }
          </Button>
          
          {retryError && (
            <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
              <p className="text-sm text-destructive mb-2">{retryError}</p>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={refreshSubscriptionWithRetry}
                disabled={loading}
              >
                Try Again
              </Button>
            </div>
          )}
        </div>
        
        <div className="text-center space-y-2 mt-4">
          {selectedPlan === 'starter' && (
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-green-600">7-day free trial</span> - No charge until trial ends
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Payment method required for all plans. Cancel anytime.
          </p>
        </div>
      </div>
    </div>
  );
}