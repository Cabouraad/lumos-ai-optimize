import { ReactNode, useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface SubscriptionGateProps {
  children: ReactNode;
}

export function SubscriptionGate({ children }: SubscriptionGateProps) {
  const { user, orgData, subscriptionData, loading, subscriptionLoading, checkSubscription } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [authError, setAuthError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [lastRetryTime, setLastRetryTime] = useState<number | null>(null);

  // Enhanced subscription check with better error handling and debugging
  useEffect(() => {
    const handleSubscriptionCheck = async () => {
      console.log('[SUBSCRIPTION_GATE] Component mounted/updated', {
        plan: subscriptionData?.subscription_tier,
        status: subscriptionData?.subscribed ? 'active' : 'inactive',
        payment_collected: subscriptionData?.payment_collected,
        trial_expires_at: subscriptionData?.trial_expires_at,
        loading: loading || subscriptionLoading,
        authError: authError,
        retryCount: retryCount
      });

      // Clear previous auth errors when we have valid subscription data
      if (subscriptionData !== null && authError) {
        setAuthError(null);
        setRetryCount(0);
      }

      if (user && !loading && !subscriptionLoading && subscriptionData === null) {
        console.log('[SUBSCRIPTION_GATE] Null subscriptionData detected, triggering check');
        try {
          await checkSubscription();
          // Clear error on successful check
          setAuthError(null);
          setRetryCount(0);
        } catch (error) {
          console.error('[SUBSCRIPTION_GATE] Failed to check subscription:', error);
          setAuthError(error instanceof Error ? error.message : 'Unknown subscription check error');
          // Don't block the UI, continue with current state
        }
      }
    };

    handleSubscriptionCheck();
  }, [user, loading, subscriptionLoading, subscriptionData, checkSubscription, authError, retryCount]);

  // Safety timeout to prevent infinite loading with better error recovery
  useEffect(() => {
    if (user && !loading && !subscriptionLoading && subscriptionData === null) {
      const timeout = setTimeout(() => {
        console.warn('[SUBSCRIPTION_GATE] Safety timeout triggered - subscription check took too long');
        setAuthError('Subscription check timed out. Please try refreshing the page.');
        // Set default subscription data to prevent infinite loading
        // Note: This won't actually update the context, but helps with UI state
      }, 12000); // Increased timeout to allow for retries
      
      return () => clearTimeout(timeout);
    }
  }, [user, loading, subscriptionLoading, subscriptionData]);

  // Manual retry function for users
  const handleManualRetry = useCallback(async () => {
    const now = Date.now();
    
    // Prevent too frequent retries
    if (lastRetryTime && now - lastRetryTime < 3000) {
      console.log('[SUBSCRIPTION_GATE] Retry too soon, ignoring');
      return;
    }
    
    setLastRetryTime(now);
    setRetryCount(prev => prev + 1);
    setAuthError(null);
    
    console.log('[SUBSCRIPTION_GATE] Manual retry initiated', { retryCount: retryCount + 1 });
    
    try {
      await checkSubscription();
    } catch (error) {
      console.error('[SUBSCRIPTION_GATE] Manual retry failed:', error);
      setAuthError(error instanceof Error ? error.message : 'Retry failed');
    }
  }, [checkSubscription, lastRetryTime, retryCount]);

  // Show loading state for auth or subscription loading OR when subscriptionData is null
  if (loading || subscriptionLoading || (user && subscriptionData === null)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">
            {loading ? 'Loading authentication...' :
             subscriptionLoading ? 'Checking subscription...' :
             'Verifying access...'}
          </p>
          
          {/* Show error message and retry option if there's an auth error */}
          {authError && (
            <div className="mt-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg max-w-md mx-auto">
              <p className="text-sm text-destructive mb-3">
                {authError}
              </p>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleManualRetry}
                disabled={retryCount >= 3}
              >
                {retryCount >= 3 ? 'Max retries reached' : `Retry (${retryCount}/3)`}
              </Button>
              
              {retryCount >= 3 && (
                <div className="mt-3 text-xs text-muted-foreground">
                  <p>Still having issues? Please refresh the page or contact support.</p>
                </div>
              )}
            </div>
          )}
          
          {/* Auto-timeout message */}
          {user && subscriptionData === null && !authError && (
            <div className="mt-6 text-xs text-muted-foreground">
              <p>This is taking longer than usual...</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Not authenticated - redirect to auth
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // No org data - needs onboarding
  if (!orgData?.organizations?.id) {
    return <Navigate to="/onboarding" replace />;
  }

  // Check if subscription is required
  const hasValidSubscription = subscriptionData?.subscribed || 
    (subscriptionData?.trial_expires_at && new Date(subscriptionData.trial_expires_at) > new Date() && subscriptionData?.payment_collected === true);

  // If user requires subscription and doesn't have one, show subscription required page
  if (subscriptionData?.requires_subscription || !hasValidSubscription) {
    // Don't block access to pricing page
    if (location.pathname === '/pricing') {
      return <>{children}</>;
    }

    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-red-600">Subscription Required</CardTitle>
            <CardDescription>
              Access to Llumos requires an active subscription. Choose a plan to continue.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-yellow-50 dark:bg-yellow-950 p-4 rounded-lg border border-yellow-200 dark:border-yellow-800">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                <strong>No free tier available.</strong> All plans require a payment method, but the Starter plan includes a 7-day free trial.
              </p>
            </div>
            
            <Button 
              className="w-full" 
              onClick={() => navigate('/pricing')}
            >
              Choose Your Plan
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // User has valid subscription - allow access
  return <>{children}</>;
}