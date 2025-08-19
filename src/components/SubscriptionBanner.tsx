import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { Zap, Clock } from 'lucide-react';

export function SubscriptionBanner() {
  const { subscriptionData } = useAuth();
  const navigate = useNavigate();

  // Don't show banner if user has an active subscription
  if (subscriptionData?.subscribed) {
    return null;
  }

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
                You're on the Free Trial
              </h3>
              <Badge variant="secondary" className="bg-amber-200 text-amber-800">
                Limited Features
              </Badge>
            </div>
            <p className="text-sm text-amber-700 dark:text-amber-300">
              Upgrade to unlock competitor analysis, AI recommendations, and more prompts
            </p>
          </div>
        </div>
        <Button onClick={() => navigate('/pricing')} size="sm">
          <Clock className="mr-2 h-4 w-4" />
          Upgrade Now
        </Button>
      </CardContent>
    </Card>
  );
}