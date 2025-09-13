import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { Zap, CreditCard } from 'lucide-react';
import { EnhancedEdgeFunctionClient } from '@/lib/edge-functions/enhanced-client';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';
import { isBillingBypassEligible, grantStarterBypass } from '@/lib/billing/bypass-utils';

export function SubscriptionBanner() {
  const { user, subscriptionData, checkSubscription } = useAuth();
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
      // Check if user is eligible for billing bypass
      if (isBillingBypassEligible(user?.email)) {
        await grantStarterBypass(user!.email!);
        toast({
          title: 'Test Access Granted',
          description: 'Starter subscription activated for testing.',
        });
        if (checkSubscription) {
          await checkSubscription();
        }
        return;
      }

      // Default: start standard trial checkout
      const { data, error } = await EnhancedEdgeFunctionClient.invoke('create-trial-checkout');
      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (error: any) {
      console.error('Error starting trial:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to start trial. Please try again.',
        variant: 'destructive',
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