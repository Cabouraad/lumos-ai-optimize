import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { TrialBanner } from '@/components/TrialBanner';
import { useSubscriptionGate } from '@/hooks/useSubscriptionGate';
import { CircularGauge } from '@/components/CircularGauge';
import { QuickInsights } from '@/components/QuickInsights';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, Activity, FileText, Users, Zap, Loader2 } from 'lucide-react';
import { getSafeDashboardData } from '@/lib/dashboard/safe-data';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export default function Dashboard() {
  const { hasAccessToApp, isOnTrial, daysRemainingInTrial } = useSubscriptionGate();
  const appAccess = hasAccessToApp();
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [insightsOpen, setInsightsOpen] = useState(false);
  const [isRunningAll, setIsRunningAll] = useState(false);
  const { toast } = useToast();

  const handleRunAllPrompts = async () => {
    setIsRunningAll(true);
    try {
      const { data, error } = await supabase.functions.invoke('daily-scan', {
        body: { manualRun: true }
      });
      if (error) throw error;
      const result = (data as any)?.result;
      toast({
        title: 'Manual run completed',
        description: result
          ? `Processed ${result.organizations} orgs · ${result.successfulRuns}/${result.totalRuns} successful`
          : 'Completed successfully',
      });
      // Refresh dashboard data
      const refreshed = await getSafeDashboardData();
      setDashboardData(refreshed);
    } catch (e: any) {
      console.error('Manual run failed:', e);
      toast({ title: 'Manual run failed', description: e.message || 'Unknown error' });
    } finally {
      setIsRunningAll(false);
    }
  };

  useEffect(() => {
    async function loadDashboardData() {
      try {
        setLoading(true);
        const data = await getSafeDashboardData();
        setDashboardData(data);
      } catch (err) {
        console.error('Dashboard data error:', err);
        setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    }

    if (appAccess.hasAccess) {
      loadDashboardData();
    }
  }, [appAccess.hasAccess]);

  // Block access if trial expired
  if (!appAccess.hasAccess) {
    return (
      <Layout>
        <div className="container mx-auto p-6">
          <div className="max-w-md mx-auto text-center py-12">
            <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
              <h2 className="text-xl font-bold text-red-800 mb-2">Trial Expired</h2>
              <p className="text-red-600 mb-4">
                Your 7-day free trial has ended. Upgrade to continue using Llumos.
              </p>
              <button 
                onClick={() => window.location.href = '/pricing'}
                className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 transition-colors"
              >
                Upgrade to Continue
              </button>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (loading) {
    return (
      <Layout>
        <div className="space-y-6">
          {isOnTrial && daysRemainingInTrial && daysRemainingInTrial > 0 && (
            <TrialBanner daysRemaining={daysRemainingInTrial} />
          )}
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-muted rounded w-1/3"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-32 bg-muted rounded"></div>
              ))}
            </div>
            <div className="h-64 bg-muted rounded"></div>
          </div>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="space-y-6">
          {isOnTrial && daysRemainingInTrial && daysRemainingInTrial > 0 && (
            <TrialBanner daysRemaining={daysRemainingInTrial} />
          )}
          <div className="text-center py-12">
            <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md mx-auto">
              <h3 className="text-lg font-medium text-red-800 mb-2">Unable to Load Dashboard</h3>
              <p className="text-red-600 text-sm mb-4">{error}</p>
              <button 
                onClick={() => window.location.reload()}
                className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  const trendIcon = dashboardData?.trend > 0 ? TrendingUp : TrendingDown;
  const trendColor = dashboardData?.trend > 0 ? 'text-success' : 'text-destructive';

  return (
    <Layout>
      <div className="space-y-6">
        {/* Show trial banner if user is on trial */}
        {isOnTrial && daysRemainingInTrial && daysRemainingInTrial > 0 && (
          <TrialBanner daysRemaining={daysRemainingInTrial} />
        )}
        
        {/* Dashboard Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Dashboard</h1>
          <p className="text-muted-foreground">
            Your brand visibility performance overview
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Manual Run All Prompts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Button
              onClick={handleRunAllPrompts}
              disabled={isRunningAll}
              className="w-full"
              variant="secondary"
            >
              {isRunningAll ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Running All Prompts...
                </>
              ) : (
                <>
                  <Zap className="mr-2 h-4 w-4" />
                  Run All Prompts Now
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Today's Average Score */}
          <Card>
            <CardContent className="flex items-center justify-center p-6">
              <CircularGauge
                value={dashboardData?.avgScore || 0}
                maxValue={10}
                size={100}
                label="Today's Avg"
                showValue={true}
              />
            </CardContent>
          </Card>

          {/* Overall Score */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Overall Score</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{dashboardData?.overallScore?.toFixed(1) || '0.0'}</div>
              <div className="flex items-center text-xs text-muted-foreground">
                {dashboardData?.trend > 0 ? (
                  <TrendingUp className={`w-3 h-3 mr-1 ${trendColor}`} />
                ) : (
                  <TrendingDown className={`w-3 h-3 mr-1 ${trendColor}`} />
                )}
                <span className={trendColor}>
                  {Math.abs(dashboardData?.trend || 0).toFixed(1)}% vs last week
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Active Prompts */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Prompts</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{dashboardData?.promptCount || 0}</div>
              <p className="text-xs text-muted-foreground">
                {dashboardData?.totalRuns || 0} total runs
              </p>
            </CardContent>
          </Card>

          {/* LLM Providers */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">LLM Providers</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {dashboardData?.providers?.filter((p: any) => p.enabled).length || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                of {dashboardData?.providers?.length || 0} available
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Chart */}
        {dashboardData?.chartData?.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Visibility Trend (30 Days)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dashboardData.chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 12 }}
                      tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    />
                    <YAxis 
                      domain={[0, 10]}
                      tick={{ fontSize: 12 }}
                    />
                    <Tooltip 
                      labelFormatter={(value) => new Date(value).toLocaleDateString()}
                      formatter={(value: any) => [value.toFixed(1), 'Score']}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="score" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2, r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="text-center py-12">
              <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No Data Yet</h3>
              <p className="text-muted-foreground mb-4">
                Run some prompts to start seeing your visibility trends
              </p>
              <button 
                onClick={() => window.location.href = '/prompts'}
                className="bg-primary text-primary-foreground px-4 py-2 rounded hover:bg-primary/90 transition-colors"
              >
                Create Your First Prompt
              </button>
            </CardContent>
          </Card>
        )}

        {/* Quick Insights Sidebar */}
        <QuickInsights
          isOpen={insightsOpen}
          onToggle={() => setInsightsOpen(!insightsOpen)}
          trendData={dashboardData?.chartData || []}
        />
      </div>
    </Layout>
  );
}