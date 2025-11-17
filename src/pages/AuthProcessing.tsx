import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

export default function AuthProcessing() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [error, setError] = useState<string | null>(null);
  
  // Get redirect path from URL (e.g., from /signin?redirect=/black-friday)
  const redirectPath = searchParams.get('redirect') || null;

  useEffect(() => {
    const code = searchParams.get('code');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    if (error) {
      setStatus('error');
      setError(errorDescription || error);
      // Redirect to auth page after showing error briefly
      setTimeout(() => navigate('/auth'), 3000);
      return;
    }

    if (!code) {
      setStatus('error');
      setError('No authorization code found');
      setTimeout(() => navigate('/auth'), 3000);
      return;
    }

    // Exchange code for session and bootstrap user
    const exchangeCodeForSession = async () => {
      try {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        
        if (error) {
          throw error;
        }

        // Ensure user record exists
        try {
          await supabase.functions.invoke('ensure-user-record');
        } catch (ensureError) {
          console.warn('Ensure user record failed:', ensureError);
          // Not critical, continue
        }

        // Bootstrap to determine where to redirect
        try {
          const { data: bootstrapData, error: bootstrapError } = await supabase.functions.invoke('bootstrap-auth');
          
          if (!bootstrapError && bootstrapData?.success) {
            // Redirect based on org AND subscription status
            if (bootstrapData.org_id) {
              // User has organization - check subscription before dashboard redirect
              const { data: subData } = await supabase.functions.invoke('check-subscription');
              
              if (subData?.hasAccess) {
                // Has org and subscription - go to dashboard
                setTimeout(() => navigate('/dashboard'), 1000);
              } else {
                // Has org but no subscription - check for redirect path (e.g., black-friday)
                if (redirectPath) {
                  setTimeout(() => navigate(redirectPath), 1000);
                } else {
                  // Default to pricing if no redirect specified
                  setTimeout(() => navigate('/pricing'), 1000);
                }
              }
            } else {
              // No organization - send to onboarding
              setTimeout(() => navigate('/onboarding'), 1000);
            }
          } else {
            // Bootstrap failed - safe default to onboarding for new users
            console.warn('Bootstrap failed:', bootstrapError);
            setTimeout(() => navigate('/onboarding'), 1000);
          }
        } catch (bootstrapError) {
          console.warn('Bootstrap failed:', bootstrapError);
          // Default to onboarding for safety
          setTimeout(() => navigate('/onboarding'), 1000);
        }

        setStatus('success');
      } catch (err) {
        console.error('Error exchanging code for session:', err);
        setStatus('error');
        setError(err instanceof Error ? err.message : 'Failed to authenticate');
        setTimeout(() => navigate('/auth'), 3000);
      }
    };

    exchangeCodeForSession();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-[400px]">
        <CardContent className="p-6 text-center">
          {status === 'processing' && (
            <>
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
              <h2 className="text-lg font-semibold mb-2">Processing Authentication</h2>
              <p className="text-sm text-muted-foreground">
                Please wait while we complete your sign-in...
              </p>
            </>
          )}
          
          {status === 'success' && (
            <>
              <div className="h-8 w-8 rounded-full bg-green-500 flex items-center justify-center mx-auto mb-4">
                <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold mb-2">Authentication Successful</h2>
              <p className="text-sm text-muted-foreground">
                Redirecting to dashboard...
              </p>
            </>
          )}
          
          {status === 'error' && (
            <>
              <div className="h-8 w-8 rounded-full bg-red-500 flex items-center justify-center mx-auto mb-4">
                <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold mb-2">Authentication Failed</h2>
              <p className="text-sm text-muted-foreground mb-4">
                {error || 'An error occurred during authentication'}
              </p>
              <p className="text-xs text-muted-foreground">
                Redirecting to sign-in page...
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}