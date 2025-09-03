
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
import { RefreshButton } from '@/components/RefreshButton';
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts';
import { Calendar, TrendingUp, TrendingDown, Eye, Users, AlertTriangle, Lightbulb, FileText, Download } from 'lucide-react';
import { useRealTimeDashboard } from '@/hooks/useRealTimeDashboard';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { isFeatureEnabled } from '@/lib/config/feature-flags';

export default function Dashboard() {
  const { user, orgData } = useAuth();
  const navigate = useNavigate();
  const { hasAccessToApp } = useSubscriptionGate();
  const appAccess = hasAccessToApp();
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [latestReport, setLatestReport] = useState<any>(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const { toast } = useToast();
  
  // Use real-time dashboard hook
  const { data: dashboardData, loading, error, refresh, lastUpdated } = useRealTimeDashboard({
    autoRefreshInterval: 60000, // 1 minute
    enableAutoRefresh: true
  });

  useEffect(() => {
    if (orgData?.organizations?.id) {
      loadRecommendations();
      if (isFeatureEnabled('FEATURE_WEEKLY_REPORT')) {
        loadLatestReport();
      }
    }
  }, [orgData?.organizations?.id]);

  // Show error if dashboard fetch failed
  useEffect(() => {
    if (error) {
      toast({
        title: 'Dashboard Error',
        description: 'Failed to load dashboard data. Please try refreshing.',
        variant: 'destructive'
      });
    }
  }, [error, toast]);

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

      // Take exactly 3 recommendations
      setRecommendations(highImpactRecs.slice(0, 3));
    } catch (error) {
      console.error('Error loading recommendations:', error);
    }
  };

  const loadLatestReport = async () => {
    try {
      setLoadingReport(true);
      const orgId = orgData?.organizations?.id;
      if (!orgId) return;

      const { data, error } = await supabase
        .from('reports')
        .select('*')
        .eq('org_id', orgId)
        .order('period_start', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        throw error;
      }

      setLatestReport(data);
    } catch (error) {
      console.error('Error loading latest report:', error);
      // Don't show toast error for report loading as it's secondary content
    } finally {
      setLoadingReport(false);
    }
  };

  const downloadLatestReport = async () => {
    if (!latestReport) return;
    
    try {
      setLoadingReport(true);
      
      const response = await supabase.functions.invoke('weekly-report', {
        method: 'GET',
        body: { week: latestReport.week_key }
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to generate download URL');
      }

      const { download_url } = response.data;
      if (!download_url) {
        throw new Error('No download URL received');
      }

      // Immediately trigger download since signed URL has short TTL (5 minutes)
      const link = document.createElement('a');
      link.href = download_url;
      link.download = `weekly-report-${latestReport.week_key}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast({
        title: 'Download Started',
        description: `Weekly report for ${latestReport.week_key} is downloading.`,
      });
    } catch (error) {
      console.error('Error downloading report:', error);
      toast({
        title: 'Download Failed',
        description: error instanceof Error ? error.message : 'Failed to download report. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setLoadingReport(false);
    }
  };

  const formatWeekPeriod = (start: string, end: string): string => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const options: Intl.DateTimeFormatOptions = { 
      month: 'short', 
      day: 'numeric'
    };
    
    return `${startDate.toLocaleDateString('en-US', options)} - ${endDate.toLocaleDateString('en-US', options)}`;
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
            <RefreshButton 
              onRefresh={refresh}
              loading={loading}
              lastUpdated={lastUpdated}
              autoRefreshEnabled={true}
              showLastUpdated={true}
            />
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card className="bg-card/80 backdrop-blur-sm border shadow-soft hover-lift group">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg Visibility Score</CardTitle>
                <div className="p-2 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
                  <Eye className="h-4 w-4 text-primary" />
                </div>
              </CardHeader>
              <CardContent>
                {dashboardData?.metrics?.avgScore ? (
                  <div className="flex items-center space-x-2">
                    <div className="text-2xl font-bold text-primary">{formatScore(dashboardData.metrics.avgScore)}/10</div>
                    {getTrendIcon(dashboardData?.metrics?.trend || 0)}
                    {(dashboardData?.metrics?.trend || 0) !== 0 && (
                      <span className="text-xs text-muted-foreground">
                        {Math.abs(dashboardData.metrics.trend).toFixed(1)}%
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="space-y-1">
                    <div className="text-2xl font-bold text-muted-foreground">-/10</div>
                    <p className="text-xs text-muted-foreground">No data yet</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-card/80 backdrop-blur-sm border shadow-soft hover-lift group">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Overall Score</CardTitle>
                <div className="p-2 bg-secondary/10 rounded-lg group-hover:bg-secondary/20 transition-colors">
                  <TrendingUp className="h-4 w-4 text-secondary" />
                </div>
              </CardHeader>
              <CardContent>
                {dashboardData?.metrics?.overallScore ? (
                  <div>
                    <div className="text-2xl font-bold text-secondary">{formatScore(dashboardData.metrics.overallScore)}/10</div>
                    <p className="text-xs text-muted-foreground">Last 7 days average</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <div className="text-2xl font-bold text-muted-foreground">-/10</div>
                    <p className="text-xs text-muted-foreground">No data available</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-card/80 backdrop-blur-sm border shadow-soft hover-lift group">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Prompts</CardTitle>
                <div className="p-2 bg-accent/10 rounded-lg group-hover:bg-accent/20 transition-colors">
                  <Users className="h-4 w-4 text-accent" />
                </div>
              </CardHeader>
              <CardContent>
                {dashboardData?.metrics?.promptCount ? (
                  <div>
                    <div className="text-2xl font-bold text-accent">{dashboardData.metrics.promptCount}</div>
                    <p className="text-xs text-muted-foreground">Being monitored</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <div className="text-2xl font-bold text-muted-foreground">0</div>
                    <p className="text-xs text-muted-foreground">Add prompts to start</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-card/80 backdrop-blur-sm border shadow-soft hover-lift group">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Responses</CardTitle>
                <div className="p-2 bg-warning/10 rounded-lg group-hover:bg-warning/20 transition-colors">
                  <Calendar className="h-4 w-4 text-warning" />
                </div>
              </CardHeader>
              <CardContent>
                {dashboardData?.metrics?.totalRuns ? (
                  <div>
                    <div className="text-2xl font-bold text-warning">{dashboardData.metrics.totalRuns}</div>
                    <p className="text-xs text-muted-foreground">Last 30 days</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <div className="text-2xl font-bold text-muted-foreground">0</div>
                    <p className="text-xs text-muted-foreground">No responses yet</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Visibility Trend Chart */}
          <Card className="bg-card/80 backdrop-blur-sm border shadow-soft hover-glow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-primary" />
                </div>
                <span>Visibility Trend</span>
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
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
                        }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="score" 
                        stroke="hsl(var(--primary))" 
                        strokeWidth={3}
                        dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2, r: 4 }}
                        activeDot={{ r: 6, stroke: 'hsl(var(--primary))', strokeWidth: 2, fill: 'hsl(var(--background))' }}
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

          {/* Latest Weekly Report */}
          {isFeatureEnabled('FEATURE_WEEKLY_REPORT') && (
            <Card className="bg-card/80 backdrop-blur-sm border shadow-soft hover-glow">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <span>Latest Weekly Report</span>
                </CardTitle>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => navigate('/reports')}
                  className="hover-lift"
                >
                  View All Reports
                </Button>
              </CardHeader>
              <CardContent>
                {loadingReport ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    <span className="ml-2 text-muted-foreground">Loading report...</span>
                  </div>
                ) : latestReport ? (
                  <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-all duration-300">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-mono text-xs">
                          {latestReport.week_key}
                        </Badge>
                        <span className="text-sm font-medium text-foreground">
                          {formatWeekPeriod(latestReport.period_start, latestReport.period_end)}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Generated: {new Date(latestReport.created_at).toLocaleDateString('en-US', { 
                          month: 'short', 
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                    <Button 
                      onClick={downloadLatestReport}
                      disabled={loadingReport}
                      size="sm"
                      className="hover-lift"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download PDF
                    </Button>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground mb-2">No weekly reports available yet</p>
                    <p className="text-sm text-muted-foreground">
                      Reports are generated automatically every Monday morning after your first complete week of usage.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Top Recommendations */}
          <Card className="bg-card/80 backdrop-blur-sm border shadow-soft hover-glow">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <div className="p-2 bg-accent/10 rounded-lg">
                  <Lightbulb className="h-5 w-5 text-accent" />
                </div>
                <span>Top Recommendations</span>
              </CardTitle>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => navigate('/recommendations')}
                className="hover-lift"
              >
                View All
              </Button>
            </CardHeader>
            <CardContent>
              {recommendations.length > 0 ? (
                <div className="space-y-4">
                  {recommendations.map((rec) => (
                    <div key={rec.id} className="p-4 border rounded-lg hover:bg-muted/50 transition-all duration-300 hover-lift group">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Badge 
                            variant="outline" 
                            className={`text-xs ${
                              rec.type === 'content' 
                                ? 'border-primary text-primary bg-primary/10' 
                                : rec.type === 'social' 
                                ? 'border-accent text-accent bg-accent/10'
                                : 'border-secondary text-secondary bg-secondary/10'
                            }`}
                          >
                            {rec.type === 'content' ? 'Content' : rec.type === 'social' ? 'Social' : rec.type}
                          </Badge>
                        </div>
                      </div>
                      <h4 className="font-medium text-foreground mb-2 group-hover:text-primary transition-colors">{rec.title}</h4>
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
