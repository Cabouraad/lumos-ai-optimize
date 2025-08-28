import { Layout } from '@/components/Layout';
import { UpgradePrompt } from '@/components/UpgradePrompt';
import { TrialBanner } from '@/components/TrialBanner';
import { RecommendationCard } from '@/components/RecommendationCard';
import { useSubscriptionGate } from '@/hooks/useSubscriptionGate';
import { useAuth } from '@/contexts/AuthContext';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  Lightbulb, 
  RefreshCw
} from 'lucide-react';

interface Recommendation {
  id: string;
  type: 'content' | 'social' | 'site' | 'prompt';
  title: string;
  rationale: string;
  status: 'open' | 'snoozed' | 'done' | 'dismissed';
  created_at: string;
  cooldown_until?: string;
  metadata?: {
    steps?: string[];
    estLift?: number;
    sourcePromptIds?: string[];
    sourceRunIds?: string[];
    citations?: Array<{type: 'url' | 'ref', value: string}>;
    impact?: 'high' | 'medium' | 'low';
    category?: string;
    competitors?: string;
  };
}


export default function Recommendations() {
  const { canAccessRecommendations } = useSubscriptionGate();
  const { orgData } = useAuth();
  const { toast } = useToast();
  const recommendationsAccess = canAccessRecommendations();
  
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState('all');

  // Show upgrade prompt if no access
  if (!recommendationsAccess.hasAccess) {
    return (
      <Layout>
        <div className="space-y-6">
          {recommendationsAccess.daysRemainingInTrial && recommendationsAccess.daysRemainingInTrial > 0 && (
            <TrialBanner daysRemaining={recommendationsAccess.daysRemainingInTrial} />
          )}
          
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">AI Recommendations</h1>
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

  useEffect(() => {
    if (orgData?.organizations?.id) {
      loadRecommendations();
    }
  }, [orgData]);

  const loadRecommendations = async () => {
    if (!orgData?.organizations?.id) return;

    try {
      setLoading(true);
      const { data } = await supabase
        .from('recommendations')
        .select('*')
        .eq('org_id', orgData.organizations.id)
        .in('status', ['open', 'snoozed', 'done', 'dismissed'])
        .order('created_at', { ascending: false })
        .limit(20);

      setRecommendations((data || []) as Recommendation[]);
    } catch (error) {
      console.error('Error loading recommendations:', error);
      toast({
        title: "Error",
        description: "Failed to load recommendations",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateRecommendations = async () => {
    if (!orgData?.organizations?.id) return;
    
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('intelligent-recommendations', {
        body: { orgId: orgData.organizations.id }
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: "Success",
          description: `Generated ${data.created} new content recommendations from analysis of ${data.analyzed} prompts`,
        });
      } else {
        throw new Error(data.error || 'Failed to generate recommendations');
      }

      await loadRecommendations();
    } catch (error: any) {
      console.error('Recommendation generation error:', error);
      toast({
        title: "Error", 
        description: error.message || 'Failed to generate recommendations',
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleUpdateStatus = async (id: string, status: 'done' | 'dismissed', cooldownDays?: number) => {
    try {
      let updateData: any = { status };
      
      // If cooldown is specified for dismissed status, calculate cooldown_until
      if (status === 'dismissed' && cooldownDays) {
        const cooldownUntil = new Date();
        cooldownUntil.setDate(cooldownUntil.getDate() + cooldownDays);
        updateData.cooldown_until = cooldownUntil.toISOString();
      }

      const { error } = await supabase
        .from('recommendations')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Success",
        description: cooldownDays 
          ? `Recommendation snoozed for ${cooldownDays} days`
          : `Recommendation marked as ${status}`,
      });

      await loadRecommendations();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const filteredRecommendations = activeTab === 'all' 
    ? recommendations.filter(r => r.status === 'open')
    : recommendations.filter(r => r.type === activeTab && r.status === 'open');

  if (loading) {
    return (
      <Layout>
        <div className="space-y-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-foreground">AI Recommendations</h1>
              <p className="text-muted-foreground">
                Actionable content recommendations to improve your AI visibility
              </p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader>
                  <div className="w-3/4 h-4 bg-muted rounded"></div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="w-full h-3 bg-muted rounded"></div>
                    <div className="w-2/3 h-3 bg-muted rounded"></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {recommendationsAccess.daysRemainingInTrial && recommendationsAccess.daysRemainingInTrial > 0 && (
          <TrialBanner daysRemaining={recommendationsAccess.daysRemainingInTrial} />
        )}
        
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-foreground">AI Recommendations</h1>
            <p className="text-muted-foreground">
              Actionable content recommendations based on your prompt performance
            </p>
          </div>
          <Button 
            onClick={handleGenerateRecommendations}
            disabled={generating}
            aria-label="Generate new recommendations"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${generating ? 'animate-spin' : ''}`} />
            {generating ? 'Analyzing...' : 'Generate New'}
          </Button>
        </div>

        {recommendations.length > 0 ? (
          <>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="all">All ({recommendations.filter(r => r.status === 'open').length})</TabsTrigger>
                <TabsTrigger value="content">Content</TabsTrigger>
                <TabsTrigger value="social">Social</TabsTrigger>
              </TabsList>

              <TabsContent value={activeTab} className="space-y-6">
                {filteredRecommendations.length > 0 ? (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {filteredRecommendations.map((recommendation) => (
                      <RecommendationCard
                        key={recommendation.id}
                        recommendation={recommendation}
                        onUpdateStatus={handleUpdateStatus}
                        orgId={orgData?.organizations?.id}
                      />
                    ))}
                  </div>
                ) : (
                  <Card>
                    <CardContent className="text-center py-12">
                      <Lightbulb className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-medium mb-2">No {activeTab === 'all' ? '' : activeTab} recommendations</h3>
                      <p className="text-sm text-muted-foreground">
                        Generate new recommendations to see content suggestions for this category.
                      </p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
          </>
        ) : (
          <Card>
            <CardContent className="text-center py-12">
              <Lightbulb className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No recommendations yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Generate AI-powered content recommendations based on your prompt performance data.
              </p>
              <Button 
                onClick={handleGenerateRecommendations}
                disabled={generating}
                variant="secondary"
                aria-label="Generate recommendations"
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${generating ? 'animate-spin' : ''}`} />
                {generating ? 'Analyzing Prompts...' : 'Generate Recommendations'}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}