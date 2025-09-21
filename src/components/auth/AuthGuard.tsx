import { ReactNode, useEffect } from 'react';
import { useLocation, Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { isPublicRoute } from '@/lib/auth/publicRoutes';

interface AuthGuardProps {
  children: ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { ready, user, loading } = useAuth();
  const location = useLocation();
  const pathname = location.pathname;

  // Timeout warning for stuck auth
  useEffect(() => {
    if (!ready) {
      const timeoutId = setTimeout(() => {
        if (!ready) {
          console.warn('Auth guard timeout - auth may be stuck. Check network connectivity.');
        }
      }, 30000);
      
      return () => clearTimeout(timeoutId);
    }
  }, [ready]);

  // Allow public routes to render without auth check
  if (isPublicRoute(pathname)) {
    return <>{children}</>;
  }

  // Show loading while auth is initializing
  if (!ready) {
    return (
      <div className="w-full h-[60vh] grid place-items-center text-muted-foreground">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          <div>Loading authentication...</div>
          <div className="text-xs text-gray-500 max-w-md text-center">
            If this takes more than a few seconds, check your network connection and browser console for errors.
          </div>
        </div>
      </div>
    );
  }

  // Redirect to auth if not authenticated on protected route
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
}