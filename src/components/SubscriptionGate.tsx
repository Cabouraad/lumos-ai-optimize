import { ReactNode, useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthProvider';
import { useUser } from '@/contexts/UserProvider';
import { useSubscription } from '@/contexts/SubscriptionProvider';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { signOutWithCleanup } from '@/lib/auth-cleanup';
import { supabase } from '@/integrations/supabase/client';

interface SubscriptionGateProps {
  children: ReactNode;
}

export function SubscriptionGate({ children }: SubscriptionGateProps) {
  const { user, loading, ready } = useAuth();
  const { userData: orgData, loading: userLoading, error: userError } = useUser();
  const { 
    subscriptionData, 
    loading: subscriptionLoading, 
    error: subscriptionError,
    hasAccess,
    refreshSubscription 
  } = useSubscription();
  
  const orgStatus = userError ? 'error' : 
                   !orgData && userLoading ? 'loading' :
                   orgData ? 'success' : 'not_found';
  const isChecking = userLoading || subscriptionLoading;
  
  const location = useLocation();
  const navigate = useNavigate();
  const [authError, setAuthError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [lastRetryTime, setLastRetryTime] = useState<number | null>(null);
  const [orgDataLoading, setOrgDataLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [autoVerifiedOnce, setAutoVerifiedOnce] = useState(false);
  
  // Removed insecure forceAccess and loadingTimeout states

  // Removed insecure emergency timeouts that previously forced access

  // Debug effect - logs the status periodically (no forced access)
  useEffect(() => {
    const interval = setInterval(() => {
      console.log('[SUBSCRIPTION_GATE] Status check:', {
        user: !!user,
        orgData: !!orgData,
        orgStatus,
        subscriptionData: !!subscriptionData,
        loading,
        subscriptionLoading,
        ready,
        hasAccess
      });
    }, 5000);

    return () => clearInterval(interval);
  }, [user, orgData, orgStatus, subscriptionData, loading, subscriptionLoading, ready, hasAccess]);

  // Monitor subscription status changes
  useEffect(() => {
    if (subscriptionData) {
      console.log('[SUBSCRIPTION_GATE] Subscription status:', {
        subscribed: subscriptionData.subscribed,
        trial_expires_at: subscriptionData.trial_expires_at,
        payment_collected: subscriptionData.payment_collected,
        hasAccess
      });
    }
  }, [subscriptionData, hasAccess]);

  // Removed aggressive timeout that previously forced access

  // Removed emergency fallback that previously granted access without subscription

  // Manual retry function for users - uses bootstrap
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
      await refreshSubscription();
    } catch (error) {
      console.error('[SUBSCRIPTION_GATE] Manual retry failed:', error);
      setAuthError(error instanceof Error ? error.message : 'Retry failed');
    }
  }, [refreshSubscription, lastRetryTime, retryCount]);

  // Automatic one-time verification to recover previously-paid users
  useEffect(() => {
    const run = async () => {
      try {
        setVerifying(true);
        await supabase.functions.invoke('check-subscription');
        await refreshSubscription();
      } catch (e) {
        console.error('[SUBSCRIPTION_GATE] Auto verification failed:', e);
      } finally {
        setVerifying(false);
      }
    };

    if (user && ready && !isChecking && !hasAccess && !autoVerifiedOnce) {
      setAutoVerifiedOnce(true);
      run();
    }
  }, [user, ready, isChecking, hasAccess, autoVerifiedOnce, refreshSubscription]);

  // Debug current loading states
  console.log('[SUBSCRIPTION_GATE] Loading states:', {
    loading,
    subscriptionLoading,
    ready,
    hasUser: !!user,
    hasSubscriptionData: !!subscriptionData,
    hasOrgData: !!orgData,
    orgStatus
  });

  // Extract orgId from orgData structure (handle both formats)
  const orgId = orgData?.organizations?.id || orgData?.org_id;
  
  // Determine if we should show loading screen - don't block if we have last-known data
  const shouldShowLoading = (loading || !ready || 
    (user && subscriptionData === null && !subscriptionError) || 
    (user && orgStatus === 'loading'));

  if (shouldShowLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Loading...</p>
            <div className="max-w-md mx-auto text-xs text-muted-foreground space-y-1">
              <div>Auth: {loading ? 'Loading...' : ready ? 'Ready' : 'Not ready'}</div>
              <div>User: {user ? '✓ Signed in' : '✗ Not signed in'}</div>
              <div>Org: {orgStatus}</div>
              <div>Subscription: {subscriptionLoading ? 'Loading...' : subscriptionData ? '✓ Loaded' : subscriptionError ? `✗ ${subscriptionError}` : '⏳ Waiting'}</div>
            </div>
            
            {(retryCount > 0 || authError) && (
              <div className="mt-4 space-y-2">
                {authError && (
                  <p className="text-xs text-red-600">{authError}</p>
                )}
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleManualRetry}
                  disabled={lastRetryTime && Date.now() - lastRetryTime < 3000}
                >
                  Retry ({retryCount})
                </Button>
              </div>
            )}
            
            {/* Show retry button after 10 seconds */}
            {ready && (
              <div className="mt-4">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleManualRetry}
                >
                  Retry Connection
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // If not authenticated, redirect to auth
  if (!user) {
    return <Navigate to="/signin" replace />;
  }

  // If no org data and status indicates error, redirect to onboarding
  if (orgStatus === 'not_found' || (orgStatus === 'error' && !orgData)) {
    return <Navigate to="/onboarding" replace />;
  }

  // If org loading failed with error but we might be able to recover
  if (orgStatus === 'error' && userError && !orgDataLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Connection Issue</CardTitle>
            <CardDescription>
              Unable to load your organization data.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">{userError}</p>
            <div className="space-y-2">
              <Button 
                onClick={handleManualRetry}
                className="w-full"
                disabled={orgDataLoading}
              >
                {orgDataLoading ? 'Retrying...' : 'Retry'}
              </Button>
              <Button 
                variant="outline"
                onClick={() => navigate('/auth')}
                className="w-full"
              >
                Sign Out and Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Check if subscription is required - with fallback for forced access
  const hasValidSubscription = hasAccess;

  // If user requires subscription and doesn't have one, show subscription required page (unless forced)
  if (!hasValidSubscription) {
    // If we're auto-verifying in the background, show processing state
    if (verifying) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <CardTitle>Verifying Subscription...</CardTitle>
              <CardDescription>
                We’re syncing your payment. This can take up to a minute after checkout.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <Button onClick={handleManualRetry} variant="outline" className="w-full">
                Refresh Status
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }

    // Special case: just returned from checkout - show processing state
    const justPaid = new URLSearchParams(location.search).get('subscription') === 'success';
    
    if (justPaid && location.pathname === '/dashboard') {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <CardTitle>Processing Payment...</CardTitle>
              <CardDescription>
                We're activating your subscription. This usually takes 5-10 seconds.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <Button onClick={handleManualRetry} variant="outline" className="w-full">
                Refresh Status
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }
    
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
            <div className="bg-muted p-4 rounded-lg">
              <p className="text-sm text-muted-foreground">
                You need an active subscription or trial to access Llumos features.
              </p>
            </div>
            <div className="space-y-2">
              <Button 
                className="w-full" 
                onClick={() => navigate('/pricing')}
              >
                View Pricing Plans
              </Button>
              <Button 
                variant="outline"
                className="w-full" 
                onClick={signOutWithCleanup}
              >
                Sign Out
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // User has valid subscription - allow access
  return <>{children}</>;
}