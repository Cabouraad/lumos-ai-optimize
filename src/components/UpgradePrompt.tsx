import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Crown, Zap, Clock } from 'lucide-react';

interface UpgradePromptProps {
  feature: string;
  reason: string;
  isTrialExpired?: boolean;
  daysRemainingInTrial?: number;
}

export function UpgradePrompt({ feature, reason, isTrialExpired, daysRemainingInTrial }: UpgradePromptProps) {
  const handleUpgrade = () => {
    // Navigate to pricing page or trigger checkout
    window.location.href = '/pricing';
  };

  if (isTrialExpired) {
    return (
      <Card className="border-red-200 bg-red-50/50 dark:bg-red-900/10 dark:border-red-800">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-red-600" />
            <CardTitle className="text-lg text-red-800 dark:text-red-300">Trial Expired</CardTitle>
            <Badge variant="destructive" className="ml-auto">
              Expired
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-red-700 dark:text-red-300 mb-4">
            Your free trial has ended. Upgrade now to continue using all Llumos features.
          </p>
          <Button 
            onClick={handleUpgrade}
            className="w-full bg-red-600 hover:bg-red-700 text-white"
          >
            <Crown className="w-4 h-4 mr-2" />
            Upgrade to Continue
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-900/10 dark:border-amber-800">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Crown className="w-5 h-5 text-amber-600" />
          <CardTitle className="text-lg text-amber-800 dark:text-amber-300">
            Upgrade Required
          </CardTitle>
          {daysRemainingInTrial && daysRemainingInTrial > 0 && (
            <Badge variant="outline" className="ml-auto border-amber-600 text-amber-700 dark:text-amber-300">
              {daysRemainingInTrial} days left in trial
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-amber-700 dark:text-amber-300 mb-4">
          {reason}
        </p>
        <Button 
          onClick={handleUpgrade}
          className="w-full bg-amber-600 hover:bg-amber-700 text-white"
        >
          <Zap className="w-4 h-4 mr-2" />
          Upgrade Now
        </Button>
      </CardContent>
    </Card>
  );
}