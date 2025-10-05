import { Layout } from '@/components/Layout';
import { UpgradePrompt } from '@/components/UpgradePrompt';
import { TrialBanner } from '@/components/TrialBanner';
import { useSubscriptionGate } from '@/hooks/useSubscriptionGate';
import { Card } from '@/components/ui/card';

export default function NewOptimizations() {
  const { canAccessRecommendations } = useSubscriptionGate();
  const recommendationsAccess = canAccessRecommendations();
  
  // Show upgrade prompt if no access
  if (!recommendationsAccess.hasAccess) {
    return (
      <Layout>
        <div className="space-y-6">
          {recommendationsAccess.daysRemainingInTrial && recommendationsAccess.daysRemainingInTrial > 0 && (
            <TrialBanner daysRemaining={recommendationsAccess.daysRemainingInTrial} />
          )}
          
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">AI Visibility Optimizer</h1>
            <p className="text-muted-foreground">
              Get specific, actionable content recommendations for prompts under 100% visibility
            </p>
          </div>

          <div className="max-w-md mx-auto">
            <UpgradePrompt 
              feature="AI Visibility Optimizer"
              reason={recommendationsAccess.reason || ''}
              isTrialExpired={recommendationsAccess.isTrialExpired}
              daysRemainingInTrial={recommendationsAccess.daysRemainingInTrial}
            />
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-8">
        {recommendationsAccess.daysRemainingInTrial && recommendationsAccess.daysRemainingInTrial > 0 && (
          <TrialBanner daysRemaining={recommendationsAccess.daysRemainingInTrial} />
        )}
        
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">AI Visibility Optimizer</h1>
          <p className="text-muted-foreground">
            The optimizations system has been upgraded to V2. Please visit the main Optimizations page.
          </p>
        </div>

        <Card className="p-6">
          <p className="text-center text-muted-foreground">
            This page has been moved. Please use the <strong>Optimizations</strong> link in the navigation menu to access the new V2 system.
          </p>
        </Card>
      </div>
    </Layout>
  );
}