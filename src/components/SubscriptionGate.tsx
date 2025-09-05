import { ReactNode, useEffect } from 'react';
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

  // Debug logging for subscription gate state changes
  useEffect(() => {
    console.log('[SUBSCRIPTION_GATE_COMPONENT] State updated', {
      plan: subscriptionData?.subscription_tier,
      status: subscriptionData?.subscribed ? 'active' : 'inactive',
      payment_collected: subscriptionData?.payment_collected,
      trial_expires_at: subscriptionData?.trial_expires_at,
      loading: loading || subscriptionLoading
    });
  }, [
    subscriptionData?.subscription_tier,
    subscriptionData?.subscribed,
    subscriptionData?.payment_collected,
    subscriptionData?.trial_expires_at,
    loading,
    subscriptionLoading
  ]);

  // Trigger subscription check if user exists but subscriptionData is null
  useEffect(() => {
    if (user && !loading && !subscriptionLoading && subscriptionData === null) {
      console.log('SubscriptionGate: Triggering subscription check for null subscriptionData');
      checkSubscription();
    }
  }, [user, loading, subscriptionLoading, subscriptionData, checkSubscription]);

  // Show loading state for auth or subscription loading OR when subscriptionData is null
  if (loading || subscriptionLoading || (user && subscriptionData === null)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
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