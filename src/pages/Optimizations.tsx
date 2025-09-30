import { Layout } from '@/components/Layout';
import { UpgradePrompt } from '@/components/UpgradePrompt';
import { TrialBanner } from '@/components/TrialBanner';
import { useSubscriptionGate } from '@/hooks/useSubscriptionGate';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Lightbulb, Zap, Loader2 } from 'lucide-react';
import { LowVisibilityPromptsTable } from '@/components/LowVisibilityPromptsTable';
import { LowVisibilityOptimizationsCard } from '@/components/LowVisibilityOptimizationsCard';
import { GeneralOptimizationsCard } from '@/components/GeneralOptimizationsCard';
import { JobStatusBanner } from '@/components/JobStatusBanner';
import { useGenerateForOrg } from '@/features/optimizations/hooks';
import { useAllVisibilityRecommendations } from '@/features/visibility-recommendations/hooks';
import { RecommendationCard } from '@/features/visibility-recommendations/components/RecommendationCard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function Optimizations() {
  const { canAccessRecommendations } = useSubscriptionGate();
  const { orgData } = useAuth();
  const recommendationsAccess = canAccessRecommendations();
  const generateForOrgMutation = useGenerateForOrg();
  
  const { data: visibilityRecs, isLoading: recsLoading } = useAllVisibilityRecommendations();
  const contentRecs = visibilityRecs?.filter(r => r.channel === 'content') ?? [];
  const socialRecs = visibilityRecs?.filter(r => r.channel === 'social') ?? [];
  
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

  // Handle generation with category support
  const handleGenerate = (category: 'low_visibility' | 'general') => {
    generateForOrgMutation.mutate({ category });
  };

  return (
    <Layout>
      <div className="space-y-6">
        {recommendationsAccess.daysRemainingInTrial && recommendationsAccess.daysRemainingInTrial > 0 && (
          <TrialBanner daysRemaining={recommendationsAccess.daysRemainingInTrial} />
        )}
        
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-foreground">AI Visibility Recommendations</h1>
            <p className="text-muted-foreground">
              Actionable content and social strategies to improve your AI search visibility
            </p>
          </div>
        </div>

        <JobStatusBanner />

        <Tabs defaultValue="new" className="w-full">
          <TabsList>
            <TabsTrigger value="new">New System (Actionable)</TabsTrigger>
            <TabsTrigger value="legacy">Legacy System</TabsTrigger>
          </TabsList>
          
          <TabsContent value="new" className="space-y-6">
            {recsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : visibilityRecs && visibilityRecs.length > 0 ? (
              <div className="space-y-8">
                {contentRecs.length > 0 && (
                  <div>
                    <h2 className="text-2xl font-bold mb-4">Content Strategies</h2>
                    <div className="grid gap-6">
                      {contentRecs.map((rec: any) => (
                        <RecommendationCard key={rec.id} recommendation={rec} />
                      ))}
                    </div>
                  </div>
                )}
                
                {socialRecs.length > 0 && (
                  <div>
                    <h2 className="text-2xl font-bold mb-4">Social Media Strategies</h2>
                    <div className="grid gap-6 md:grid-cols-2">
                      {socialRecs.map((rec: any) => (
                        <RecommendationCard key={rec.id} recommendation={rec} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-muted-foreground mb-4">
                  No recommendations yet. Generate recommendations from the Low Visibility Prompts table below.
                </p>
              </div>
            )}
            
            <div>
              <h2 className="text-2xl font-bold mb-4">Low Visibility Prompts</h2>
              <p className="text-muted-foreground mb-6">
                Click "Generate" to create actionable recommendations for any prompt
              </p>
              <LowVisibilityPromptsTable />
            </div>
          </TabsContent>
          
          <TabsContent value="legacy" className="space-y-6">
            <div className="flex gap-2 mb-6">
              <Button 
                onClick={() => handleGenerate('low_visibility')}
                disabled={generateForOrgMutation.isPending}
                className="flex items-center gap-2"
                variant="outline"
              >
                <Zap className={`h-4 w-4 ${generateForOrgMutation.isPending ? 'animate-pulse' : ''}`} />
                Generate Low-Visibility Fixes
              </Button>
              <Button 
                onClick={() => handleGenerate('general')}
                disabled={generateForOrgMutation.isPending}
                className="flex items-center gap-2"
              >
                <Lightbulb className={`h-4 w-4 ${generateForOrgMutation.isPending ? 'animate-pulse' : ''}`} />
                Generate General Strategy
              </Button>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <LowVisibilityOptimizationsCard />
              <GeneralOptimizationsCard />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
