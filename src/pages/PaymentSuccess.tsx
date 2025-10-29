import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@/contexts/UserProvider';

export default function PaymentSuccess() {
  const navigate = useNavigate();
  const location = useLocation();
  const { refreshUserData } = useUser();
  
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [retryError, setRetryError] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Processing your payment...');

  useEffect(() => {
    setupSubscription();
  }, []);

  const setupSubscription = async () => {
    try {
      setLoading(true);
      setRetryError(false);
      setStatusMessage('Processing your payment...');

      // Get session_id from URL params
      const params = new URLSearchParams(location.search);
      const sessionId = params.get('session_id');

      console.log('[PaymentSuccess] Starting setup, session_id:', sessionId);

      // Step 1: Recover onboarding data from sessionStorage
      const onboardingDataStr = sessionStorage.getItem('onboarding-data');
      const selectedPlan = sessionStorage.getItem('selected-plan');
      const billingCycle = sessionStorage.getItem('billing-cycle');

      console.log('[PaymentSuccess] SessionStorage data:', {
        hasOnboardingData: !!onboardingDataStr,
        selectedPlan,
        billingCycle
      });

      if (!onboardingDataStr) {
        console.warn('[PaymentSuccess] No onboarding data in sessionStorage');
        // Check if user already has org and subscription
        await refreshUserData();
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
          const { data: userData } = await supabase
            .from('users')
            .select('org_id')
            .eq('id', user.id)
            .single();

          if (userData?.org_id) {
            // User already has org, just verify subscription and proceed
            setStatusMessage('Verifying your subscription... This may take up to 60 seconds.');
            const hasAccess = await verifySubscriptionAccess();
            
            if (hasAccess) {
              setSuccess(true);
              setLoading(false);
              setTimeout(() => navigate('/dashboard?subscription=success'), 2000);
              return;
            } else {
              // Subscription verification failed - don't redirect, show error
              throw new Error('Unable to verify subscription. Your payment was successful, but activation is delayed.');
            }
          }
        }

        // No org and no sessionStorage - show error, don't redirect
        throw new Error('Payment successful, but setup data was lost. Please contact support or try manual setup.');
      }

      const onboardingData = JSON.parse(onboardingDataStr);

      // Step 2: Activate the subscription based on plan type
      setStatusMessage('Activating your subscription...');
      
      if (selectedPlan === 'starter') {
        // Activate trial
        console.log('[PaymentSuccess] Activating trial subscription');
        const { data: activateData, error: activateError } = await supabase.functions.invoke('activate-trial', {
          body: { sessionId }
        });

        if (activateError || !activateData?.success) {
          throw new Error(activateData?.error || activateError?.message || 'Failed to activate trial');
        }
      } else {
        // For Growth/Pro, webhook handles activation - just wait for it
        console.log('[PaymentSuccess] Waiting for webhook to activate subscription');
      }

      // Step 3: Refresh user data to check for org
      setStatusMessage('Setting up your organization...');
      await refreshUserData();

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Step 4: Check if organization exists
      const { data: userData } = await supabase
        .from('users')
        .select('org_id')
        .eq('id', user.id)
        .single();

      let orgCreated = false;

      if (!userData?.org_id) {
        // Create organization via onboarding edge function
        console.log('[PaymentSuccess] Creating organization:', onboardingData);
        
        const { data: onboardingResult, error: onboardingError } = await supabase.functions.invoke('onboarding', {
          body: onboardingData
        });

        if (onboardingError || !onboardingResult?.success) {
          throw new Error(onboardingResult?.error || onboardingError?.message || 'Failed to create organization');
        }

        orgCreated = true;
        console.log('[PaymentSuccess] Organization created successfully');
        
        // Refresh user data after org creation
        await refreshUserData();
      } else {
        console.log('[PaymentSuccess] Organization already exists');
      }

      // Step 5: Verify subscription access with retry logic (up to 60 seconds)
      setStatusMessage('Verifying your subscription... This may take up to 60 seconds.');
      const hasAccess = await verifySubscriptionAccess();

      if (!hasAccess) {
        throw new Error('Payment processed successfully, but subscription activation is delayed. Please wait a moment and try refreshing.');
      }

      // Step 6: Clean up sessionStorage
      sessionStorage.removeItem('onboarding-data');
      sessionStorage.removeItem('selected-plan');
      sessionStorage.removeItem('billing-cycle');

      // Success!
      setSuccess(true);
      setLoading(false);
      
      toast.success(orgCreated ? 'Organization created and subscription activated!' : 'Subscription activated!');
      
      // Redirect to dashboard after brief delay with subscription=success flag
      setTimeout(() => navigate('/dashboard?subscription=success'), 2000);

    } catch (error: any) {
      console.error('[PaymentSuccess] Setup failed:', error);
      setRetryError(true);
      setLoading(false);
      setStatusMessage(error.message || 'Setup encountered an issue. Your payment was successful.');
      toast.error(error.message || 'Failed to complete setup', { duration: 5000 });
    }
  };

  const verifySubscriptionAccess = async (retries = 15): Promise<boolean> => {
    for (let i = 0; i < retries; i++) {
      try {
        console.log(`[PaymentSuccess] Verifying subscription access (attempt ${i + 1}/${retries})`);
        
        // Refresh subscription data from provider
        await refreshUserData();
        
        const { data: subData, error: subError } = await supabase.functions.invoke('check-subscription');
        
        // Compute hasAccess from the response fields
        const hasAccess = Boolean(
          subData?.subscribed ||
          (
            subData?.trial_expires_at &&
            new Date(subData.trial_expires_at) > new Date()
          ) ||
          subData?.requires_subscription === false ||
          (subData?.subscription_tier && subData.subscription_tier !== 'free')
        );

        console.log('[PaymentSuccess] Verification attempt:', {
          attempt: i + 1,
          hasAccess,
          subscribed: subData?.subscribed,
          trialExpiresAt: subData?.trial_expires_at,
          paymentCollected: subData?.payment_collected,
        });
        
        if (!subError && hasAccess) {
          console.log('[PaymentSuccess] Subscription verified successfully');
          return true;
        }

        // Wait before retry (start with 2s, increase to 4s after 5 tries)
        if (i < retries - 1) {
          const delay = i < 5 ? 2000 : 4000;
          console.log(`[PaymentSuccess] Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      } catch (error) {
        console.error(`[PaymentSuccess] Verification attempt ${i + 1} failed:`, error);
        if (i === retries - 1) {
          return false;
        }
        // Wait 3 seconds on error before retry
        if (i < retries - 1) {
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }
    }
    
    return false;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
            <CardTitle>Setting Up Your Account</CardTitle>
            <CardDescription>{statusMessage}</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-sm text-muted-foreground">
              This usually takes just a few seconds...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (retryError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4">
              <AlertCircle className="h-12 w-12 text-destructive" />
            </div>
            <CardTitle>Setup Issue</CardTitle>
            <CardDescription>
              We encountered an issue completing your setup. Your payment was successful.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted p-4 rounded-lg">
              <p className="text-sm text-muted-foreground text-center">
                {statusMessage}
              </p>
            </div>
            <p className="text-xs text-center text-muted-foreground">
              Stripe webhooks can take 30-60 seconds to process. Your payment was successful.
            </p>
            <Button onClick={setupSubscription} className="w-full">
              Retry Verification
            </Button>
            <Button 
              onClick={() => navigate('/dashboard')} 
              variant="outline" 
              className="w-full"
            >
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4">
              <CheckCircle className="h-12 w-12 text-green-500" />
            </div>
            <CardTitle>Welcome to Llumos!</CardTitle>
            <CardDescription>
              Your subscription is active and ready to use
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <p className="text-sm text-muted-foreground">
              Redirecting you to your dashboard...
            </p>
            <Button onClick={() => navigate('/dashboard')} className="w-full">
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
}
