import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

export default function TrialSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { checkSubscription } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const activateTrial = async () => {
      const sessionId = searchParams.get('session_id');
      
      if (!sessionId) {
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
          // Refresh subscription status
          await checkSubscription();
          toast({
            title: "Trial Activated!",
            description: "Your 7-day trial has been activated. Enjoy full access to all features!"
          });
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
  }, [searchParams, navigate, checkSubscription, toast]);

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
        </CardContent>
      </Card>
    </div>
  );
}