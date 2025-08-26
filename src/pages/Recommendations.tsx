import { Layout } from '@/components/Layout';
import { UpgradePrompt } from '@/components/UpgradePrompt';
import { TrialBanner } from '@/components/TrialBanner';
import { useSubscriptionGate } from '@/hooks/useSubscriptionGate';
import { useAuth } from '@/contexts/AuthContext';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  Lightbulb, 
  RefreshCw, 
  Target, 
  TrendingUp, 
  FileText, 
  Users,
  CheckCircle,
  Clock,
  ArrowRight,
  ExternalLink,
  Share2,
  BarChart3
} from 'lucide-react';

interface Recommendation {
  id: string;
  type: 'blog_post' | 'case_study' | 'comparison' | 'tutorial' | 'social_post' | 'landing_page';
  title: string;
  rationale: string;
  status: 'open' | 'snoozed' | 'done' | 'dismissed';
  created_at: string;
  metadata?: {
    steps?: string[];
    estLift?: number;
    sourcePromptIds?: string[];
    seoKeywords?: string[];
    contentOutline?: string[];
    implementationSteps?: string[];
    socialStrategy?: {
      platforms: string[];
      postTemplates: string[];
      hashtagStrategy: string[];
    };
    expectedImpact?: 'high' | 'medium' | 'low';
    timeToImplement?: string;
  };
}

const typeIcons = {
  blog_post: FileText,
  case_study: BarChart3, 
  comparison: Target,
  tutorial: Users,
  social_post: Share2,
  landing_page: ExternalLink
};

const typeColors = {
  blog_post: 'bg-blue-50 text-blue-700 border-blue-200',
  case_study: 'bg-green-50 text-green-700 border-green-200',
  comparison: 'bg-purple-50 text-purple-700 border-purple-200',
  tutorial: 'bg-orange-50 text-orange-700 border-orange-200',
  social_post: 'bg-pink-50 text-pink-700 border-pink-200',
  landing_page: 'bg-indigo-50 text-indigo-700 border-indigo-200'
};

const impactColors = {
  high: 'bg-red-50 text-red-700 border-red-200',
  medium: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  low: 'bg-gray-50 text-gray-700 border-gray-200'
};

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
        .order('created_at', { ascending: false });

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

  const handleUpdateStatus = async (id: string, status: 'done' | 'dismissed') => {
    try {
      const { error } = await supabase
        .from('recommendations')
        .update({ status })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Recommendation marked as ${status}`,
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
              <TabsList className="grid w-full grid-cols-7">
                <TabsTrigger value="all">All ({recommendations.filter(r => r.status === 'open').length})</TabsTrigger>
                <TabsTrigger value="blog_post">Blog Posts</TabsTrigger>
                <TabsTrigger value="comparison">Comparisons</TabsTrigger>
                <TabsTrigger value="tutorial">Tutorials</TabsTrigger>
                <TabsTrigger value="case_study">Case Studies</TabsTrigger>
                <TabsTrigger value="social_post">Social</TabsTrigger>
                <TabsTrigger value="landing_page">Landing</TabsTrigger>
              </TabsList>

              <TabsContent value={activeTab} className="space-y-6">
                {filteredRecommendations.length > 0 ? (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {filteredRecommendations.map((recommendation) => (
                      <RecommendationCard
                        key={recommendation.id}
                        recommendation={recommendation}
                        onUpdateStatus={handleUpdateStatus}
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

function RecommendationCard({ 
  recommendation, 
  onUpdateStatus 
}: { 
  recommendation: Recommendation;
  onUpdateStatus: (id: string, status: 'done' | 'dismissed') => void;
}) {
  const Icon = typeIcons[recommendation.type];
  const impact = recommendation.metadata?.expectedImpact || 'medium';
  
  return (
    <Card className="h-full">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2 mb-2">
            <Icon className="h-5 w-5" />
            <Badge className={typeColors[recommendation.type]}>
              {recommendation.type.replace('_', ' ').toUpperCase()}
            </Badge>
            <Badge className={impactColors[impact]}>
              {impact.toUpperCase()} IMPACT
            </Badge>
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {recommendation.metadata?.timeToImplement || '1-2 weeks'}
          </div>
        </div>
        <CardTitle className="text-lg leading-tight">
          {recommendation.title}
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg">
          <strong>Why this matters:</strong> {recommendation.rationale}
        </div>

        {recommendation.metadata?.contentOutline && (
          <div>
            <h4 className="font-medium text-sm mb-2">Content Outline:</h4>
            <ul className="text-sm space-y-1">
              {recommendation.metadata.contentOutline.slice(0, 3).map((item, index) => (
                <li key={index} className="flex items-start gap-2">
                  <ArrowRight className="h-3 w-3 mt-0.5 text-muted-foreground flex-shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
              {recommendation.metadata.contentOutline.length > 3 && (
                <li className="text-muted-foreground text-xs">
                  +{recommendation.metadata.contentOutline.length - 3} more sections...
                </li>
              )}
            </ul>
          </div>
        )}

        {recommendation.metadata?.seoKeywords && (
          <div>
            <h4 className="font-medium text-sm mb-2">Target Keywords:</h4>
            <div className="flex flex-wrap gap-1">
              {recommendation.metadata.seoKeywords.slice(0, 4).map((keyword, index) => (
                <Badge key={index} variant="outline" className="text-xs">
                  {keyword}
                </Badge>
              ))}
              {recommendation.metadata.seoKeywords.length > 4 && (
                <Badge variant="outline" className="text-xs text-muted-foreground">
                  +{recommendation.metadata.seoKeywords.length - 4}
                </Badge>
              )}
            </div>
          </div>
        )}

        {recommendation.metadata?.socialStrategy && (
          <div>
            <h4 className="font-medium text-sm mb-2">Social Strategy:</h4>
            <div className="text-xs space-y-1">
              <div>
                <strong>Platforms:</strong> {recommendation.metadata.socialStrategy.platforms.join(', ')}
              </div>
              {recommendation.metadata.socialStrategy.postTemplates[0] && (
                <div className="bg-muted/30 p-2 rounded text-muted-foreground italic">
                  "{recommendation.metadata.socialStrategy.postTemplates[0]}"
                </div>
              )}
            </div>
          </div>
        )}

        <Dialog>
          <div className="flex justify-between items-center pt-4 border-t">
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                View Details
              </Button>
            </DialogTrigger>
            <div className="flex gap-2">
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => onUpdateStatus(recommendation.id, 'dismissed')}
              >
                Dismiss
              </Button>
              <Button 
                size="sm"
                onClick={() => onUpdateStatus(recommendation.id, 'done')}
              >
                <CheckCircle className="h-4 w-4 mr-1" />
                Mark Done
              </Button>
            </div>
          </div>

          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Icon className="h-5 w-5" />
                {recommendation.title}
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold mb-2">Strategic Rationale</h3>
                <p className="text-sm text-muted-foreground">{recommendation.rationale}</p>
              </div>

              {recommendation.metadata?.implementationSteps && (
                <div>
                  <h3 className="font-semibold mb-3">Implementation Steps</h3>
                  <ol className="space-y-2">
                    {recommendation.metadata.implementationSteps.map((step, index) => (
                      <li key={index} className="flex items-start gap-3">
                        <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs font-medium flex-shrink-0 mt-0.5">
                          {index + 1}
                        </span>
                        <span className="text-sm">{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {recommendation.metadata?.socialStrategy && (
                <div>
                  <h3 className="font-semibold mb-3">Social Media Strategy</h3>
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-medium text-sm mb-2">Platforms & Distribution:</h4>
                      <div className="flex flex-wrap gap-2">
                        {recommendation.metadata.socialStrategy.platforms.map((platform, index) => (
                          <Badge key={index} variant="outline">{platform}</Badge>
                        ))}
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="font-medium text-sm mb-2">Post Templates:</h4>
                      <div className="space-y-2">
                        {recommendation.metadata.socialStrategy.postTemplates.map((template, index) => (
                          <div key={index} className="bg-muted/30 p-3 rounded text-sm">
                            {template}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium text-sm mb-2">Hashtag Strategy:</h4>
                      <div className="flex flex-wrap gap-1">
                        {recommendation.metadata.socialStrategy.hashtagStrategy.map((hashtag, index) => (
                          <Badge key={index} variant="secondary" className="text-xs">
                            {hashtag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button 
                  variant="outline"
                  onClick={() => onUpdateStatus(recommendation.id, 'dismissed')}
                >
                  Dismiss
                </Button>
                <Button onClick={() => onUpdateStatus(recommendation.id, 'done')}>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Mark as Complete
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}