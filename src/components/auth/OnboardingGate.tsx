import { ReactNode, useEffect } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useUser } from '@/contexts/UserProvider';
import { useAuth } from '@/contexts/AuthProvider';
import { Loader2 } from 'lucide-react';

interface OnboardingGateProps {
  children: ReactNode;
}

// Ensures authenticated users without an organization are forced to onboarding
export function OnboardingGate({ children }: OnboardingGateProps) {
  const { user, ready } = useAuth();
  const { userData, loading, error } = useUser();
  const location = useLocation();
  const navigate = useNavigate();

  console.log('[OnboardingGate] State:', {
    hasUser: !!user,
    ready,
    hasUserData: !!userData,
    orgId: userData?.org_id,
    loading,
    error,
    pathname: location.pathname
  });

  // Early hard redirect to minimize flicker if we detect dashboard with no org
  useEffect(() => {
    if (!user || !ready) return;
    const hasOrg = Boolean(userData?.org_id || userData?.organizations?.id);
    console.log('[OnboardingGate] Checking org:', { hasOrg, pathname: location.pathname });
    if (!loading && !hasOrg && location.pathname !== '/onboarding') {
      console.log('[OnboardingGate] REDIRECTING to onboarding - no org detected');
      navigate('/onboarding', { replace: true });
    }
  }, [user, ready, userData, loading, location.pathname, navigate]);

  if (!ready || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">Checking your account…</p>
        </div>
      </div>
    );
  }

  // Not authenticated – let outer guards handle it
  if (!user) return <>{children}</>;

  // If no org or known user-data error, force onboarding
  const hasOrg = Boolean(userData?.org_id || userData?.organizations?.id);
  if (!hasOrg || (error && (error.includes('User not found') || error.toLowerCase().includes('organization')))) {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}
