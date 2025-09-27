import { ReactNode, useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

interface SubscriptionGateProps {
  children: ReactNode;
}

export function SubscriptionGate({ children }: SubscriptionGateProps) {
  const { 
    user, 
    orgData, 
    orgStatus,
    subscriptionData, 
    loading, 
    subscriptionLoading, 
    ready, 
    isChecking,
    subscriptionError,
    checkSubscription 
  } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [authError, setAuthError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [lastRetryTime, setLastRetryTime] = useState<number | null>(null);
  const [orgDataLoading, setOrgDataLoading] = useState(false);
  const [forceAccess, setForceAccess] = useState(false);
  const [loadingTimeoutReached, setLoadingTimeoutReached] = useState(false);

  // Debug logging for org data
  useEffect(() => {
    if (user) {
      console.log('[SUBSCRIPTION_GATE] Org data debug:', {
        userId: user.id,
        userEmail: user.email,
        orgData: orgData,
        orgDataType: typeof orgData,
        orgDataKeys: orgData ? Object.keys(orgData) : 'null',
        orgId: orgData?.organizations?.id,
        orgName: orgData?.organizations?.name,
        hasOrganizations: !!orgData?.organizations,
        loading,
        ready,
        subscriptionLoading
      });
    }
  }, [user, orgData, loading, ready, subscriptionLoading]);

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

      // Only trigger subscription check if not already checking and no data
      if (user && !loading && !subscriptionLoading && !isChecking && subscriptionData === null) {
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
  }, [user, loading, subscriptionLoading, isChecking, subscriptionData, checkSubscription, authError, retryCount]);

  // Aggressive timeout to prevent infinite loading
  useEffect(() => {
    const timeout = setTimeout(() => {
      console.warn('[SUBSCRIPTION_GATE] Aggressive timeout reached - forcing access');
      setLoadingTimeoutReached(true);
      setAuthError('Loading timed out. You can continue to use the app, but some features may not work properly.');
    }, 8000); // Shorter timeout
    
    return () => clearTimeout(timeout);
  }, []);

  // Emergency fallback timeout
  useEffect(() => {
    if (user && !loading && !subscriptionLoading && subscriptionData === null) {
      const timeout = setTimeout(() => {
        console.warn('[SUBSCRIPTION_GATE] Emergency timeout - allowing access with defaults');
        setForceAccess(true);
      }, 15000);
      
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

  // Removed fallback org data fetch - now handled in AuthContext

  // Debug current loading states
  console.log('[SUBSCRIPTION_GATE] Loading states:', {
    loading,
    subscriptionLoading,
    ready,
    hasUser: !!user,
    hasSubscriptionData: !!subscriptionData,
    hasOrgData: !!orgData,
    orgStatus,
    forceAccess,
    loadingTimeoutReached
  });

  // Extract orgId from orgData structure (handle both formats)
  const orgId = orgData?.organizations?.id || orgData?.org_id;
  
  // Determine if we should show loading screen - don't block if we have last-known data
  const shouldShowLoading = (loading || !ready || 
    (user && subscriptionData === null && !subscriptionError && !forceAccess) || 
    (user && orgStatus === 'loading' && !forceAccess)) && !loadingTimeoutReached;

  if (shouldShowLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">
            {loading ? 'Loading authentication...' :
             subscriptionLoading ? 'Checking subscription...' :
             'Verifying access...'}
          </p>
          
          {/* Show detailed debug info after 5 seconds */}
          {loadingTimeoutReached && (
            <div className="mt-6 p-4 bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-800 rounded-lg max-w-md mx-auto">
              <p className="text-sm text-orange-800 dark:text-orange-200 mb-3">
                Loading is taking longer than expected. Debug info:
              </p>
              <div className="text-xs text-left space-y-1 text-orange-700 dark:text-orange-300">
                <div>Auth loading: {loading ? 'Yes' : 'No'}</div>
                <div>Subscription loading: {subscriptionLoading ? 'Yes' : 'No'}</div>
                <div>Ready: {ready ? 'Yes' : 'No'}</div>
                <div>Has user: {user ? 'Yes' : 'No'}</div>
                <div>Has subscription data: {subscriptionData ? 'Yes' : 'No'}</div>
                <div>Has org data: {orgData ? 'Yes' : 'No'}</div>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-3"
                onClick={() => setForceAccess(true)}
              >
                Continue Anyway
              </Button>
            </div>
          )}
          
          {/* Show error message and retry option if there's a subscription error */}
          {subscriptionError && (
            <div className="mt-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg max-w-md mx-auto">
              <p className="text-sm text-destructive mb-3">
                {subscriptionError}
              </p>
              <div className="space-y-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleManualRetry}
                  disabled={retryCount >= 3}
                >
                  {retryCount >= 3 ? 'Max retries reached' : `Retry (${retryCount}/3)`}
                </Button>
                
                <Button 
                  variant="secondary" 
                  size="sm" 
                  onClick={() => setForceAccess(true)}
                >
                  Continue Anyway
                </Button>
              </div>
              
              {retryCount >= 3 && (
                <div className="mt-3 text-xs text-muted-foreground">
                  <p>Still having issues? Please refresh the page or contact support.</p>
                </div>
              )}
            </div>
          )}
          
          {/* Auto-timeout message */}
          {user && subscriptionData === null && !subscriptionError && !loadingTimeoutReached && (
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

  // Only redirect to onboarding if we're certain there's no organization
  if (user && orgStatus === 'not_found' && ready && !shouldShowLoading && !forceAccess) {
    console.log('[SubscriptionGate] Redirecting to onboarding - confirmed no org');
    return <Navigate to="/onboarding" replace />;
  }

  // Show non-blocking warning for org fetch errors but allow continuing
  if (user && orgStatus === 'error' && ready && !forceAccess && !shouldShowLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md space-y-4">
          <Card className="border-orange-200 dark:border-orange-800">
            <CardHeader>
              <CardTitle className="text-orange-800 dark:text-orange-200">
                Connection Issue
              </CardTitle>
              <CardDescription>
                We're having trouble loading your organization data. This might be a temporary network issue.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Button 
                  onClick={handleManualRetry}
                  disabled={retryCount >= 3}
                  className="w-full"
                >
                  {retryCount >= 3 ? 'Max retries reached' : `Try Again (${retryCount}/3)`}
                </Button>
                
                <Button 
                  variant="outline"
                  onClick={() => setForceAccess(true)}
                  className="w-full"
                >
                  Continue Anyway
                </Button>
              </div>
              
              <p className="text-xs text-muted-foreground text-center">
                You can continue to use the app, but some features may not work properly.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Check if subscription is required - with fallback for forced access
  const hasValidSubscription = forceAccess || subscriptionData?.subscribed || 
    (subscriptionData?.trial_expires_at && new Date(subscriptionData.trial_expires_at) > new Date() && subscriptionData?.payment_collected === true);

  // If user requires subscription and doesn't have one, show subscription required page (unless forced)
  if (!forceAccess && (subscriptionData?.requires_subscription || !hasValidSubscription)) {
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