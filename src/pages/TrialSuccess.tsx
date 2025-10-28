import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { EdgeFunctionClient } from "@/lib/edge-functions/client";
import { useAuth } from '@/contexts/AuthContext';
import { useUser } from '@/contexts/UserProvider';
import { useSubscriptionGate } from '@/hooks/useSubscriptionGate';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

export default function TrialSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { checkSubscription, subscriptionData } = useAuth();
  const { userData, refreshUserData } = useUser();
  const { hasAccessToApp } = useSubscriptionGate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);
  const [orgCreationStatus, setOrgCreationStatus] = useState<'pending' | 'creating' | 'complete' | 'failed'>('pending');

  useEffect(() => {
    const activateTrialAndSetupOrg = async () => {
      const sessionId = searchParams.get('session_id');
      
      if (!sessionId) {
        // No session_id - check if already has access
        const access = hasAccessToApp();
        const isSubscribed = subscriptionData?.subscribed;
        const trialActive = subscriptionData?.trial_expires_at && new Date(subscriptionData.trial_expires_at) > new Date();
        const paymentCollected = subscriptionData?.payment_collected;
        
        if (isSubscribed || (trialActive && paymentCollected)) {
          setSuccess(true);
          setLoading(false);
          return;
        }
        
        toast({
          title: "Error", 
          description: "Invalid session. Please try again.",
          variant: "destructive"
        });
        navigate('/pricing');
        return;
      }

      try {
        // Step 1: Activate trial subscription
        console.log('[TrialSuccess] Activating trial...');
        const { data, error } = await EdgeFunctionClient.activateTrial(sessionId);

        if (error) throw error;

        if (data.success) {
          console.log('[TrialSuccess] Trial activated successfully');
          setSuccess(true);
          
          // Step 2: Refresh user data to check for organization
          await refreshUserData();
          
          // Step 3: Check if user has an organization
          const hasOrg = Boolean(userData?.org_id);
          console.log('[TrialSuccess] Organization check:', { hasOrg, userData });
          
          if (!hasOrg) {
            // Step 4: Recover onboarding data from sessionStorage
            console.log('[TrialSuccess] No organization found, checking sessionStorage...');
            const onboardingDataStr = sessionStorage.getItem('onboarding-data');
            
            if (onboardingDataStr) {
              try {
                setOrgCreationStatus('creating');
                const onboardingData = JSON.parse(onboardingDataStr);
                console.log('[TrialSuccess] Recovered onboarding data, creating organization...');
                
                // Step 5: Create organization using onboarding edge function
                const { data: orgData, error: orgError } = await supabase.functions.invoke('onboarding', {
                  body: {
                    name: onboardingData.name,
                    domain: onboardingData.domain,
                    industry: onboardingData.industry || null,
                    keywords: onboardingData.keywords || [],
                    business_description: onboardingData.businessDescription || null,
                    products_services: onboardingData.productsServices || null,
                    target_audience: onboardingData.targetAudience || null
                  }
                });

                if (orgError) {
                  console.error('[TrialSuccess] Organization creation failed:', orgError);
                  throw new Error('Failed to create organization');
                }

                console.log('[TrialSuccess] Organization created:', orgData);
                setOrgCreationStatus('complete');
                
                // Clear sessionStorage after successful org creation
                sessionStorage.removeItem('onboarding-data');
                sessionStorage.removeItem('selected-plan');
                sessionStorage.removeItem('billing-cycle');
                
                // Refresh user data to get new org_id
                await refreshUserData();
                
                toast({
                  title: "Setup Complete!",
                  description: "Your organization and trial have been set up successfully."
                });
              } catch (orgError) {
                console.error('[TrialSuccess] Organization setup error:', orgError);
                setOrgCreationStatus('failed');
                setRetryError('Failed to complete organization setup. Please contact support.');
              }
            } else {
              console.warn('[TrialSuccess] No onboarding data in sessionStorage');
              // User might have cleared storage or this is an edge case
              // They'll be redirected to onboarding by OnboardingGate if needed
            }
          }
          
          // Step 6: Verify subscription access with retries
          let attempts = 0;
          const maxAttempts = 6;
          
          const checkEntitlement = async () => {
            while (attempts < maxAttempts) {
              await EdgeFunctionClient.checkSubscription();
              
              // Check if access is granted
              const access = hasAccessToApp();
              if (access.hasAccess) {
                console.log('[TrialSuccess] Access verified successfully');
                toast({
                  title: "Trial Activated!",
                  description: "Your 7-day trial has been activated. Enjoy full access to all features!"
                });
                return;
              }
              
              attempts++;
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
            
            // Failed after max attempts
            console.warn('[TrialSuccess] Access verification timed out');
            setRetryError("We couldn't verify your trial access yet. Please try again.");
          };
          
          checkEntitlement();
        }
      } catch (error) {
        console.error('[TrialSuccess] Error in trial activation flow:', error);
        toast({
          title: "Error",
          description: "Failed to complete setup. Please contact support.",
          variant: "destructive"
        });
        setOrgCreationStatus('failed');
      } finally {
        setLoading(false);
      }
    };

    activateTrialAndSetupOrg();
  }, [searchParams, navigate, subscriptionData, hasAccessToApp, toast, userData, refreshUserData]);

  const refreshSubscriptionWithRetry = async () => {
    setRetryError(null);
    
    let attempts = 0;
    const maxAttempts = 6;
    
    while (attempts < maxAttempts) {
      try {
        await EdgeFunctionClient.checkSubscription();
        
        // Check if access is granted
        const access = hasAccessToApp();
        if (access.hasAccess) {
          setRetryError(null);
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
    setRetryError('Failed to verify subscription access');
  };

  if (loading) {
    const statusMessage = orgCreationStatus === 'creating' 
      ? 'Creating your organization...'
      : 'Please wait while we set up your account...';
    
    return (
      <div className="container mx-auto px-4 py-8 max-w-md">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin" />
              Activating Your Trial
            </CardTitle>
            <CardDescription>
              {statusMessage}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-md">
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2 text-green-600">
            <CheckCircle className="w-6 h-6" />
            Trial Activated!
          </CardTitle>
          <CardDescription>
            Your 7-day free trial has been successfully activated
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-sm text-muted-foreground mb-4">
            Your 7-day Starter trial includes:
          </p>
          <ul className="text-sm space-y-2">
            <li>✓ Basic Visibility Scoring</li>
            <li>✓ Brand Catalog Tracking</li>
            <li>✓ Email Support</li>
            <li>✓ Up to 25 prompts per day</li>
            <li>✓ 2 AI providers (OpenAI + Perplexity)</li>
          </ul>
          <Button onClick={() => navigate('/dashboard')} className="w-full">
            Go to Dashboard
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
        </CardContent>
      </Card>
    </div>
  );
}