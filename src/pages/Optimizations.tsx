import { Layout } from '@/components/Layout';
import { UpgradePrompt } from '@/components/UpgradePrompt';
import { TrialBanner } from '@/components/TrialBanner';
import { useSubscriptionGate } from '@/hooks/useSubscriptionGate';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { 
  Lightbulb, 
  Zap
} from 'lucide-react';
import { LowVisibilityPromptsTable } from '@/components/LowVisibilityPromptsTable';
import { OptimizationsGrid } from '@/components/OptimizationsGrid';
import { JobStatusBanner } from '@/components/JobStatusBanner';
import { useGenerateForOrg } from '@/features/optimizations/hooks';

export default function Optimizations() {
  const { canAccessRecommendations } = useSubscriptionGate();
  const { orgData } = useAuth();
  const recommendationsAccess = canAccessRecommendations();
  const generateForOrgMutation = useGenerateForOrg();
  
  // Show upgrade prompt if no access
  if (!recommendationsAccess.hasAccess) {
    return (
      <Layout>
        <div className="space-y-6">
          {recommendationsAccess.daysRemainingInTrial && recommendationsAccess.daysRemainingInTrial > 0 && (
            <TrialBanner daysRemaining={recommendationsAccess.daysRemainingInTrial} />
          )}
          
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Visibility Optimizations</h1>
            <p className="text-muted-foreground">
              Get actionable content recommendations to improve your AI visibility
            </p>
          </div>

          <div className="max-w-md mx-auto">
            <UpgradePrompt 
              feature="AI Content Recommendations"
              reason={recommendationsAccess.reason || ''}
              isTrialExpired={recommendationsAccess.isTrialExpired}
              daysRemainingInTrial={recommendationsAccess.daysRemainingInTrial}
            />
          </div>
        </div>
      </Layout>
    );
  }

  const handleGenerateForLowVisibility = () => {
    generateForOrgMutation.mutate();
  };

  return (
    <Layout>
      <div className="space-y-6">
        {recommendationsAccess.daysRemainingInTrial && recommendationsAccess.daysRemainingInTrial > 0 && (
          <TrialBanner daysRemaining={recommendationsAccess.daysRemainingInTrial} />
        )}
        
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Visibility Optimizations</h1>
            <p className="text-muted-foreground">
              AI-powered content recommendations based on your prompt performance
            </p>
          </div>
          <Button 
            onClick={handleGenerateForLowVisibility}
            disabled={generateForOrgMutation.isPending}
            className="flex items-center gap-2"
          >
            <Zap className={`h-4 w-4 ${generateForOrgMutation.isPending ? 'animate-pulse' : ''}`} />
            {generateForOrgMutation.isPending ? 'Generating...' : 'Generate for Low-Visibility Prompts'}
          </Button>
        </div>

        <JobStatusBanner />

        <div className="space-y-8">
          <LowVisibilityPromptsTable />
          <OptimizationsGrid />
        </div>
      </div>
    </Layout>
  );
}