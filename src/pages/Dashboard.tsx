
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { UpgradePrompt } from '@/components/UpgradePrompt';
import { TrialBanner } from '@/components/TrialBanner';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscriptionGate } from '@/hooks/useSubscriptionGate';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts';
import { Calendar, TrendingUp, TrendingDown, Eye, Users, AlertTriangle, Play, Lightbulb } from 'lucide-react';
import { getUnifiedDashboardData, invalidateCache } from '@/lib/data/unified-fetcher';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export default function Dashboard() {
  const { user, orgData } = useAuth();
  const navigate = useNavigate();
  const { hasAccessToApp } = useSubscriptionGate();
  const appAccess = hasAccessToApp();
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [manualRunLoading, setManualRunLoading] = useState(false);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    loadDashboardData();
    if (orgData?.organizations?.id) {
      loadRecommendations();
    }
  }, [orgData]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const data = await getUnifiedDashboardData();
      setDashboardData({
        ...data,
        // Ensure we have default values to prevent rendering issues
        chartData: data.chartData || [],
        providers: data.providers || [],
        prompts: data.prompts || []
      });
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      toast({
        title: 'Error loading dashboard',
        description: 'Failed to load dashboard data. Please refresh the page.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const loadRecommendations = async () => {
    try {
      const orgId = orgData?.organizations?.id;
      if (!orgId) return;

      const { data, error } = await supabase
        .from('recommendations')
        .select('*')
        .eq('org_id', orgId)
        .in('status', ['open', 'snoozed', 'done', 'dismissed'])
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Filter for high impact recommendations first, then fall back to others if needed
      const allRecommendations = (data || []) as any[];
      
      // First try to get high impact recommendations
      let highImpactRecs = allRecommendations.filter(rec => {
        const metadata = rec.metadata as any;
        return metadata?.impact === 'high' && rec.status === 'open';
      });

      // If we don't have at least 3 high impact, add medium impact ones
      if (highImpactRecs.length < 3) {
        const mediumImpactRecs = allRecommendations.filter(rec => {
          const metadata = rec.metadata as any;
          return metadata?.impact === 'medium' && rec.status === 'open';
        });
        highImpactRecs = [...highImpactRecs, ...mediumImpactRecs];
      }

      // If still not enough, add any open recommendations
      if (highImpactRecs.length < 3) {
        const otherOpenRecs = allRecommendations.filter(rec => 
          rec.status === 'open' && !highImpactRecs.some(h => h.id === rec.id)
        );
        highImpactRecs = [...highImpactRecs, ...otherOpenRecs];
      }

      // Take at least 3, or all available if less than 3
      setRecommendations(highImpactRecs.slice(0, Math.max(3, highImpactRecs.length)));
    } catch (error) {
      console.error('Error loading recommendations:', error);
    }
  };

  const handleManualRun = async () => {
    setManualRunLoading(true);
    try {
      toast({
        title: 'Starting prompt execution...',
        description: 'Processing will run in background. Please wait for completion notification.',
      });

      // Use trigger-test-run instead for better reliability
      const { data: result, error } = await supabase.functions.invoke('trigger-test-run', {
        body: { manualRun: true }
      });
      
      if (error) {
        console.warn('Trigger failed, but background processing may continue:', error);
        toast({
          title: 'Processing started',
          description: 'Background execution initiated. Data will refresh automatically.',
        });
        
        // Auto-refresh after delay
        setTimeout(async () => {
          await loadDashboardData();
        }, 5000);
        return;
      }
      
      toast({
        title: 'Manual run completed',
        description: result?.organizations 
          ? `Processed ${result.organizations} orgs · ${result.successfulRuns}/${result.totalRuns} successful`
          : 'Completed successfully',
      });
      
      // Invalidate cache and refresh dashboard data after successful run
      invalidateCache(['dashboard-data', 'prompt-data']);
      setTimeout(async () => {
        await loadDashboardData();
        await loadRecommendations();
        toast({
          title: 'Dashboard refreshed',
          description: 'Latest visibility data has been loaded.',
        });
      }, 2000);
      
    } catch (e: any) {
      console.error('Manual run failed:', e);
      toast({ title: 'Manual run failed', description: e.message || 'Unknown error' });
    } finally {
      setManualRunLoading(false);
    }
  };

  if (!appAccess.hasAccess) {
    return (
      <Layout>
        <div className="container mx-auto p-6">
          {/* Trial banner if user is on trial */}
          {appAccess.daysRemainingInTrial && appAccess.daysRemainingInTrial > 0 && (
            <TrialBanner daysRemaining={appAccess.daysRemainingInTrial} />
          )}
          
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">Dashboard</h1>
            <p className="text-muted-foreground">AI visibility insights for your organization</p>
          </div>

          <div className="max-w-md mx-auto">
            <UpgradePrompt 
              feature="Dashboard"
              reason={appAccess.reason || ''}
              isTrialExpired={appAccess.isTrialExpired}
              daysRemainingInTrial={appAccess.daysRemainingInTrial}
            />
          </div>
        </div>
      </Layout>
    );
  }

  const showTrialBanner = appAccess.daysRemainingInTrial && appAccess.daysRemainingInTrial > 0;

  if (loading) {
    return (
      <Layout>
        <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
          <div className="container mx-auto p-6">
            <div className="animate-pulse space-y-8">
              <div className="h-8 bg-muted rounded w-1/3"></div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-32 bg-muted rounded-lg"></div>
                ))}
              </div>
              <div className="h-64 bg-muted rounded-lg"></div>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  const formatScore = (score: number) => Math.round(score * 10) / 10;
  const getTrendIcon = (trend: number) => {
    if (trend > 0) return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (trend < 0) return <TrendingDown className="h-4 w-4 text-red-500" />;
    return null;
  };

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
        <div className="container mx-auto p-6 space-y-8">
          {showTrialBanner && (
            <TrialBanner daysRemaining={appAccess.daysRemainingInTrial!} />
          )}
          
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <h1 className="text-4xl font-bold text-foreground">Dashboard</h1>
              <p className="text-muted-foreground">AI visibility insights for your organization</p>
            </div>
            
            <Button 
              onClick={handleManualRun}
              disabled={manualRunLoading}
              className="shadow-sm"
            >
              <Play className="h-4 w-4 mr-2" />
              {manualRunLoading ? 'Running...' : 'Run All Prompts Now'}
            </Button>
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card className="bg-card/80 backdrop-blur-sm border shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg Visibility Score</CardTitle>
                <Eye className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-2">
                  <div className="text-2xl font-bold">{formatScore(dashboardData?.avgScore || 0)}/10</div>
                  {getTrendIcon(dashboardData?.trend || 0)}
                  {(dashboardData?.trend || 0) !== 0 && (
                    <span className="text-xs text-muted-foreground">
                      {Math.abs(dashboardData.trend).toFixed(1)}%
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card/80 backdrop-blur-sm border shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Overall Score</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatScore(dashboardData?.overallScore || 0)}/10</div>
                <p className="text-xs text-muted-foreground">Last 7 days average</p>
              </CardContent>
            </Card>

            <Card className="bg-card/80 backdrop-blur-sm border shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Prompts</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{dashboardData?.promptCount || 0}</div>
                <p className="text-xs text-muted-foreground">Being monitored</p>
              </CardContent>
            </Card>

            <Card className="bg-card/80 backdrop-blur-sm border shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Data Points</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{dashboardData?.totalRuns || 0}</div>
                <p className="text-xs text-muted-foreground">Last 30 days</p>
              </CardContent>
            </Card>
          </div>

          {/* Visibility Trend Chart */}
          <Card className="bg-card/80 backdrop-blur-sm border shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Visibility Trend
              </CardTitle>
            </CardHeader>
            <CardContent>
              {dashboardData?.chartData && dashboardData.chartData.length > 0 ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dashboardData.chartData}>
                      <XAxis 
                        dataKey="date" 
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 12 }}
                        tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      />
                      <YAxis 
                        domain={[0, 10]}
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 12 }}
                      />
                      <Tooltip 
                        labelFormatter={(value) => new Date(value).toLocaleDateString()}
                        formatter={(value: any) => [`${formatScore(value)}/10`, 'Visibility Score']}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="score" 
                        stroke="hsl(var(--primary))" 
                        strokeWidth={2}
                        dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2, r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-64 flex items-center justify-center">
                  <div className="text-center">
                    <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No visibility data available</p>
                    <p className="text-sm text-muted-foreground mt-2">Run prompts to start collecting data</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top Recommendations */}
          <Card className="bg-card/80 backdrop-blur-sm border shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5" />
                Top Recommendations
              </CardTitle>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => navigate('/recommendations')}
              >
                View All
              </Button>
            </CardHeader>
            <CardContent>
              {recommendations.length > 0 ? (
                <div className="space-y-4">
                  {recommendations.map((rec) => (
                    <div key={rec.id} className="p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200 text-xs">
                            {((rec.metadata as any)?.impact === 'high' && 'High Impact') ||
                             ((rec.metadata as any)?.impact === 'medium' && 'Medium Impact') ||
                             'Impact'}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {rec.type}
                          </Badge>
                        </div>
                      </div>
                      <h4 className="font-medium text-foreground mb-2">{rec.title}</h4>
                      <p className="text-sm text-muted-foreground line-clamp-2">{rec.rationale}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Lightbulb className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No high-impact recommendations available</p>
                  <p className="text-sm text-muted-foreground mt-2">Check back after running prompts</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
