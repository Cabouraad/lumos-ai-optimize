import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscriptionGate } from '@/hooks/useSubscriptionGate';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

export default function TrialSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { checkSubscription, subscriptionData } = useAuth();
  const { hasAccessToApp } = useSubscriptionGate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);

  useEffect(() => {
    const activateTrial = async () => {
      const sessionId = searchParams.get('session_id');
      
      if (!sessionId) {
        // No session_id - check if already has access
        const access = hasAccessToApp();
        const isSubscribed = subscriptionData?.subscribed;
        const trialActive = subscriptionData?.trial_expires_at && new Date(subscriptionData.trial_expires_at) > new Date();
        const paymentCollected = subscriptionData?.payment_collected;
        
        if (isSubscribed || (trialActive && paymentCollected)) {
          setSuccess(true);
          setLoading(false);
          return;
        }
        
        toast({
          title: "Error", 
          description: "Invalid session. Please try again.",
          variant: "destructive"
        });
        navigate('/pricing');
        return;
      }

      try {
        const { data, error } = await supabase.functions.invoke('activate-trial', {
          body: { sessionId }
        });

        if (error) throw error;

        if (data.success) {
          setSuccess(true);
          
          // Post-activation entitlement check
          let attempts = 0;
          const maxAttempts = 6;
          
          const checkEntitlement = async () => {
            while (attempts < maxAttempts) {
              await supabase.functions.invoke('check-subscription');
              
              // Check if access is granted
              const access = hasAccessToApp();
              if (access.hasAccess) {
                toast({
                  title: "Trial Activated!",
                  description: "Your 7-day trial has been activated. Enjoy full access to all features!"
                });
                return;
              }
              
              attempts++;
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
            
            // Failed after max attempts
            setRetryError("We couldn't verify your trial access yet. Please try again.");
          };
          
          checkEntitlement();
        }
      } catch (error) {
        console.error('Error activating trial:', error);
        toast({
          title: "Error",
          description: "Failed to activate trial. Please contact support.",
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    };

    activateTrial();
  }, [searchParams, navigate, subscriptionData, hasAccessToApp, toast]);

  const refreshSubscriptionWithRetry = async () => {
    setRetryError(null);
    
    let attempts = 0;
    const maxAttempts = 6;
    
    while (attempts < maxAttempts) {
      try {
        await supabase.functions.invoke('check-subscription');
        
        // Check if access is granted
        const access = hasAccessToApp();
        if (access.hasAccess) {
          setRetryError(null);
          return;
        }
        
        attempts++;
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error: any) {
        console.error('Subscription check error:', error);
        break;
      }
    }
    
    // Failed after max attempts
    setRetryError('Failed to verify subscription access');
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-md">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin" />
              Activating Your Trial
            </CardTitle>
            <CardDescription>
              Please wait while we set up your account...
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-md">
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2 text-green-600">
            <CheckCircle className="w-6 h-6" />
            Trial Activated!
          </CardTitle>
          <CardDescription>
            Your 7-day free trial has been successfully activated
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-sm text-muted-foreground">
            You now have full access to:
          </p>
          <ul className="text-sm space-y-2">
            <li>✓ AI Recommendations</li>
            <li>✓ Competitor Analysis</li>
            <li>✓ Advanced Scoring</li>
            <li>✓ Up to 10 prompts per day</li>
            <li>✓ Multiple AI providers</li>
          </ul>
          <Button onClick={() => navigate('/dashboard')} className="w-full">
            Go to Dashboard
          </Button>
          
          {retryError && (
            <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
              <p className="text-sm text-destructive mb-2">{retryError}</p>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={refreshSubscriptionWithRetry}
                disabled={loading}
              >
                Try Again
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}