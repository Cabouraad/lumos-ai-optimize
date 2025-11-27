import { useState } from 'react';
import { Navigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { usePasswordStrength } from '@/hooks/usePasswordStrength';
import { PasswordStrengthMeter } from '@/components/ui/password-strength';
import { ResendEmailButton } from '@/components/auth/ResendEmailButton';
import { Search, CheckCircle, Play } from 'lucide-react';
import { useAnalytics } from '@/hooks/useAnalytics';
import { Separator } from '@/components/ui/separator';

export default function SignUp() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const { trackSignupBegin, trackSignupSuccess } = useAnalytics();
  
  const { strength: passwordStrength, loading: strengthLoading } = usePasswordStrength(password);
  
  // Get redirect path to preserve it through auth flow
  const redirectPath = searchParams.get('redirect') || '/dashboard';

  if (user) {
    return <Navigate to={redirectPath} replace />;
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    trackSignupBegin('email');
    
    // Build email redirect URL with the redirect path parameter
    const emailRedirectUrl = redirectPath && redirectPath !== '/dashboard'
      ? `${window.location.origin}/auth-processing?redirect=${encodeURIComponent(redirectPath)}`
      : `${window.location.origin}/auth-processing`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: emailRedirectUrl
      }
    });

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      setLoading(false);
    } else {
      trackSignupSuccess('email');
      setEmailSent(true);
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    trackSignupBegin('google');
    
    const redirectUrl = redirectPath && redirectPath !== '/dashboard'
      ? `${window.location.origin}/auth-processing?redirect=${encodeURIComponent(redirectPath)}`
      : `${window.location.origin}/auth-processing`;

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl
      }
    });

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative">
      <Link 
        to="/" 
        className="absolute top-8 left-8 flex items-center gap-2 group hover:opacity-80 transition-opacity"
      >
        <div className="w-8 h-8 bg-gradient-to-br from-primary to-primary/80 rounded-lg flex items-center justify-center shadow-md">
          <Search className="w-4 h-4 text-white" strokeWidth={2.5} />
        </div>
        <span className="text-lg font-bold text-foreground">Llumos</span>
      </Link>

      <div className="w-full max-w-md px-4">
        <Card className="w-full">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Create Account</CardTitle>
            <CardDescription>Get started with Llumos</CardDescription>
            <p className="text-xs text-muted-foreground mt-2">
              7-day free trial • Cancel anytime
            </p>
          </CardHeader>
          <CardContent>
          {emailSent ? (
            <div className="space-y-4 text-center">
              <div className="flex justify-center">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-8 h-8 text-primary" />
                </div>
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">Check Your Email</h3>
                <p className="text-sm text-muted-foreground">
                  We sent a verification link to <strong>{email}</strong>
                </p>
                <p className="text-sm text-muted-foreground">
                  Click the link in the email to complete your signup.
                </p>
              </div>
              <div className="pt-4 border-t">
                <p className="text-sm text-muted-foreground mb-3">Didn't receive the email?</p>
                <ResendEmailButton email={email} />
              </div>
            </div>
          ) : (
            <>
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                  
                  {password.length > 0 && (
                    <PasswordStrengthMeter 
                      strength={passwordStrength}
                      loading={strengthLoading}
                      className="mt-2"
                    />
                  )}
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Creating account...' : 'Sign Up'}
                </Button>
              </form>

              <div className="relative my-4">
                <Separator />
                <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-2 text-xs text-muted-foreground">
                  or continue with
                </span>
              </div>

              <Button 
                type="button" 
                variant="outline" 
                className="w-full"
                onClick={handleGoogleSignIn}
                disabled={loading}
              >
                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continue with Google
              </Button>
              
              <div className="mt-4 text-center text-sm">
                <span className="text-muted-foreground">Already have an account? </span>
                <Link 
                  to={redirectPath && redirectPath !== '/dashboard' ? `/signin?redirect=${encodeURIComponent(redirectPath)}` : '/signin'}
                  className="text-primary hover:underline font-medium"
                >
                  Sign in
                </Link>
              </div>
            </>
          )}
        </CardContent>
      </Card>
      
      <div className="mt-6 text-center">
        <p className="text-sm text-muted-foreground mb-2">
          Want to see how it works first?
        </p>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/demo" className="gap-2">
            <Play className="h-4 w-4" />
            Watch the Demo
          </Link>
        </Button>
      </div>
      </div>
    </div>
  );
}
