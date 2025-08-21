import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { Zap, CreditCard } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { useState } from 'react';

export function SubscriptionBanner() {
  const { subscriptionData } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  // Don't show banner if user has an active subscription
  if (subscriptionData?.subscribed) {
    return null;
  }

  const handleStartTrial = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-trial-checkout');
      
      if (error) throw error;
      
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('Error starting trial:', error);
      toast({
        title: "Error",
        description: "Failed to start trial. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="mb-6 border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
      <CardContent className="flex items-center justify-between p-4">
        <div className="flex items-center space-x-3">
          <div className="rounded-full bg-amber-100 p-2 dark:bg-amber-900">
            <Zap className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="font-semibold text-amber-900 dark:text-amber-100">
                Start Your Free Trial
              </h3>
              <Badge variant="secondary" className="bg-amber-200 text-amber-800">
                Payment Required
              </Badge>
            </div>
            <p className="text-sm text-amber-700 dark:text-amber-300">
              Get 7 days free access to all features. Credit card required - no charges during trial.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleStartTrial} disabled={loading} size="sm">
            <CreditCard className="mr-2 h-4 w-4" />
            {loading ? "Starting..." : "Start Free Trial"}
          </Button>
          <Button onClick={() => navigate('/pricing')} variant="outline" size="sm">
            View Plans
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}