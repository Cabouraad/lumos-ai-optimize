import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DateRangePicker } from '@/components/DateRangePicker';
import { ProviderResponseCard } from '@/components/ProviderResponseCard';

import { PromptCitationsTable } from '@/components/citations/PromptCitationsTable';
import { ScoreBreakdownTooltip } from '@/components/prompts/ScoreBreakdownTooltip';
import { getUnifiedPromptData } from '@/lib/data/unified-fetcher';
import { getAllowedProviders } from '@/lib/providers/tier-policy';
import { useSubscriptionGate } from '@/hooks/useSubscriptionGate';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { 
  ArrowLeft, 
  Calendar, 
  TrendingUp, 
  Target, 
  Users,
  BarChart3,
  Globe
} from 'lucide-react';

export default function PromptDetail() {
  const { promptId } = useParams<{ promptId: string }>();
  const navigate = useNavigate();
  const { orgData } = useAuth();
  const { currentTier } = useSubscriptionGate();
  
  const [prompt, setPrompt] = useState<any>(null);
  const [promptDetails, setPromptDetails] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({ from: undefined, to: undefined });
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    if (!promptId || !orgData?.id) return;

    const fetchPromptData = async () => {
      try {
        setLoading(true);

        // Fetch prompt basics and unified data in parallel
        const [promptResult, unifiedData] = await Promise.all([
          supabase
            .from('prompts')
            .select('*')
            .eq('id', promptId)
            .eq('org_id', orgData.id)
            .maybeSingle(),
          getUnifiedPromptData(true, dateRange.from, dateRange.to)
        ]);

        const { data: promptData, error: promptError } = promptResult as any;
        if (promptError) throw promptError;

        // Prefer direct row; fallback to unified list if RLS/cache returns 0 rows
        let finalPrompt = promptData as any;
        if (!finalPrompt) {
          const fallback = (unifiedData as any)?.prompts?.find((p: any) => p.id === promptId);
          if (fallback) finalPrompt = fallback;
        }
        setPrompt(finalPrompt || null);

        const promptDetail = (unifiedData as any)?.promptDetails?.find((p: any) => p.promptId === promptId);
        setPromptDetails(promptDetail || null);
      } catch (error) {
        console.error('Error fetching prompt details:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPromptData();
  }, [promptId, orgData?.id, dateRange.from, dateRange.to]);

  // Calculate metrics
  const metrics = (() => {
    if (!promptDetails?.providers) {
      return { avgScore: 0, totalRuns: 0, brandVisible: 0, totalCompetitors: 0 };
    }

    const providers = Object.values(promptDetails.providers);
    let totalScore = 0;
    let validScores = 0;
    let totalRuns = 0;
    let brandVisibleCount = 0;
    let competitorSet = new Set<string>();

    providers.forEach((providerVal: any) => {
      const responses = Array.isArray(providerVal) ? providerVal : (providerVal ? [providerVal] : []);
      
      responses.forEach((response: any) => {
        if (response?.status === 'completed' || response?.status === 'success') {
          totalRuns++;
          if (typeof response.score === 'number') {
            totalScore += response.score;
            validScores++;
          }
          if (response.org_brand_present) {
            brandVisibleCount++;
          }
          if (response.competitors_json) {
            const competitors = Array.isArray(response.competitors_json) 
              ? response.competitors_json 
              : [];
            competitors.forEach((comp: any) => {
              competitorSet.add(comp?.name || comp);
            });
          }
        }
      });
    });

    return {
      avgScore: validScores > 0 ? (totalScore / validScores) * 10 : 0,
      totalRuns,
      brandVisible: brandVisibleCount,
      totalCompetitors: competitorSet.size
    };
  })();

  const displayProviders = getAllowedProviders(currentTier as any);

  if (loading) {
    return (
      <Layout>
        <div className="container mx-auto py-8 space-y-6">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </Layout>
    );
  }

  if (!prompt) {
    return (
      <Layout>
        <div className="container mx-auto py-8">
          <div className="text-center">
            <h2 className="text-2xl font-semibold mb-4">Prompt not found</h2>
            <Button onClick={() => navigate('/prompts')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Prompts
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto py-6 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/prompts')}
              className="mb-4"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Prompts
            </Button>
            <h1 className="text-2xl font-bold mb-2">{prompt.text}</h1>
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                Created {format(new Date(prompt.created_at), 'MMM d, yyyy')}
              </div>
              <Badge variant={prompt.active ? 'default' : 'secondary'}>
                {prompt.active ? 'Active' : 'Paused'}
              </Badge>
              {prompt.cluster_tag && (
                <Badge variant="outline">{prompt.cluster_tag}</Badge>
              )}
            </div>
          </div>
          <DateRangePicker
            from={dateRange.from}
            to={dateRange.to}
            onRangeChange={(from, to) => setDateRange({ from, to })}
          />
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Avg Score
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScoreBreakdownTooltip 
                providers={promptDetails?.providers || {}}
                avgScore={metrics.avgScore / 10}
              >
                <div className="text-3xl font-bold cursor-help">
                  {metrics.avgScore.toFixed(1)}
                </div>
              </ScoreBreakdownTooltip>
              <p className="text-xs text-muted-foreground mt-1">
                Out of 10
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-blue-500" />
                Total Runs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{metrics.totalRuns}</div>
              <p className="text-xs text-muted-foreground mt-1">
                AI responses tracked
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Target className="h-4 w-4 text-success" />
                Brand Visible
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-success">
                {metrics.brandVisible}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Mentions detected
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Users className="h-4 w-4 text-warning" />
                Competitors
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-warning">
                {metrics.totalCompetitors}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Unique brands seen
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Tabbed Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="responses">AI Responses</TabsTrigger>
            <TabsTrigger value="citations">Citations</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6 mt-6">
            {/* Provider Performance Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  Provider Performance
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {displayProviders.map((provider) => {
                  const providerData = promptDetails?.providers?.[provider];
                  const responses = Array.isArray(providerData) ? providerData : (providerData ? [providerData] : []);
                  const latest = responses.find((r: any) => r?.status === 'completed' || r?.status === 'success');
                  
                  return (
                    <div key={provider} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="text-sm font-medium">{provider}</div>
                        {latest && (
                          <>
                            <Badge variant="outline" className="text-xs">
                              Score: {((latest.score || 0) * 10).toFixed(1)}
                            </Badge>
                            {latest.org_brand_present && (
                              <Badge variant="outline" className="text-xs bg-success/10 text-success border-success/20">
                                Brand Present
                              </Badge>
                            )}
                          </>
                        )}
                      </div>
                      {latest && (
                        <div className="text-xs text-muted-foreground">
                          {format(new Date(latest.run_at), 'MMM d, h:mm a')}
                        </div>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>

          </TabsContent>

          <TabsContent value="responses" className="space-y-4 mt-6">
            {displayProviders.map((provider) => (
              <ProviderResponseCard
                key={provider}
                provider={provider}
                response={promptDetails?.providers?.[provider] || null}
                promptText={prompt.text}
              />
            ))}
          </TabsContent>

          <TabsContent value="citations" className="mt-6">
            <PromptCitationsTable promptId={promptId!} />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
