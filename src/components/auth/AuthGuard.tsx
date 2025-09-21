import { ReactNode } from 'react';
import { useLocation, Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { isPublicRoute } from '@/lib/auth/publicRoutes';

interface AuthGuardProps {
  children: ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { ready, user } = useAuth();
  const location = useLocation();
  const pathname = location.pathname;

  // Allow public routes to render without auth check
  if (isPublicRoute(pathname)) {
    return <>{children}</>;
  }

  // Show loading while auth is initializing
  if (!ready) {
    return (
      <div className="w-full h-[60vh] grid place-items-center text-muted-foreground">
        Loading…
      </div>
    );
  }

  // Redirect to auth if not authenticated on protected route
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
}