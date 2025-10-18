import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthProvider';
import { useUser } from '@/contexts/UserProvider';
import { useSubscription } from '@/contexts/SubscriptionProvider';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

interface ProtectedRouteProps {
  children: ReactNode;
  requireAuth?: boolean;
  requireSubscription?: boolean;
}

export function ProtectedRoute({ 
  children, 
  requireAuth = true, 
  requireSubscription = true 
}: ProtectedRouteProps) {
  const { user, loading: authLoading, ready, signOut } = useAuth();
  const { userData, loading: userLoading, error: userError } = useUser();
  const { hasAccess, loading: subscriptionLoading } = useSubscription();
  const location = useLocation();
  const navigate = useNavigate();

  // Show loading while auth is initializing
  if (authLoading || !ready) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">Loading authentication...</p>
        </div>
      </div>
    );
  }

  // Redirect to auth if authentication is required but user is not logged in
  if (requireAuth && !user) {
    return <Navigate to="/auth" replace />;
  }

  // Redirect authenticated users away from auth page
  if (!requireAuth && user) {
    return <Navigate to="/dashboard" replace />;
  }

  // If user is authenticated, show loading for user data
  if (user && userLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">Loading user data...</p>
        </div>
      </div>
    );
  }

  // Handle user data errors
  if (user && userError) {
    // If user not found in database or no org, redirect to onboarding
    if (userError.includes('User not found') || userError.includes('organization')) {
      return <Navigate to="/onboarding" replace />;
    }

    // Other errors - show error page
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Error Loading Account</CardTitle>
            <CardDescription>
              There was an issue loading your account information.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">{userError}</p>
            <div className="space-y-2">
              <Button 
                onClick={() => window.location.reload()}
                className="w-full"
              >
                Reload Page
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

  // Show subscription loading
  if (user && userData && subscriptionLoading && requireSubscription) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">Checking subscription...</p>
        </div>
      </div>
    );
  }

  // Check subscription access
  if (user && userData && requireSubscription && !hasAccess) {
    // Allow access to pricing page
    if (location.pathname === '/pricing') {
      return <>{children}</>;
    }

    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-destructive">Subscription Required</CardTitle>
            <CardDescription>
              Access to this feature requires an active subscription.
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
                onClick={async () => {
                  await signOut();
                  navigate('/auth');
                }}
              >
                Sign Out
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // All checks passed - render children
  return <>{children}</>;
}
