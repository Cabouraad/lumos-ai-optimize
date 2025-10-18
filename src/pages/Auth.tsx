import { useState } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { signInWithCleanup } from '@/lib/auth-cleanup';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { usePasswordStrength } from '@/hooks/usePasswordStrength';
import { PasswordStrengthMeter } from '@/components/ui/password-strength';
import { Search } from 'lucide-react';

export default function Auth() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  
  // Password strength analysis for sign-up
  const { strength: passwordStrength, loading: strengthLoading } = usePasswordStrength(
    isSignUp ? password : ''
  );

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await signInWithCleanup(email, password);

    if (error) {
      // Show friendly error and stop loading
      const message = (error as any)?.message || 'Invalid email or password';
      toast({ title: 'Error', description: message, variant: 'destructive' });
      setLoading(false);
    }
    // On success, signInWithCleanup will redirect and reload the app
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/processing`
      }
    });

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Check your email for the confirmation link!",
      });
    }
    
    setLoading(false);
  };


  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative">
      {/* Home button with logo in top left */}
      <Link 
        to="/" 
        className="absolute top-8 left-8 flex items-center gap-2 group hover:opacity-80 transition-opacity"
      >
        <div className="w-8 h-8 bg-gradient-to-br from-primary to-primary/80 rounded-lg flex items-center justify-center shadow-md">
          <Search className="w-4 h-4 text-white" strokeWidth={2.5} />
        </div>
        <span className="text-lg font-bold text-foreground">Llumos</span>
      </Link>

      <Card className="w-[400px]">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Llumos</CardTitle>
          <CardDescription>AI Search Optimization Platform</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>
            
            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4" onFocus={() => setIsSignUp(false)}>
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
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Signing in...' : 'Sign In'}
                </Button>
              </form>
            </TabsContent>
            
            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4" onFocus={() => setIsSignUp(true)}>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                  
                  {/* Password strength indicator */}
                  {isSignUp && password.length > 0 && (
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
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}