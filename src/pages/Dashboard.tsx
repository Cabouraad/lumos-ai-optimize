import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CircularGauge } from '@/components/CircularGauge';
import { ProviderLogo } from '@/components/ProviderLogo';
import { MiniSparkline } from '@/components/MiniSparkline';
import { QuickInsights } from '@/components/QuickInsights';
import { getSafeDashboardData } from '@/lib/dashboard/safe-data';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, Activity, AlertCircle, Eye, BarChart3, Zap, Target, Users, Clock } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export default function Dashboard() {
  const { orgData, user, loading: authLoading } = useAuth();
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [insightsOpen, setInsightsOpen] = useState(false);

  useEffect(() => {
    if (orgData?.organizations?.id) {
      getSafeDashboardData()
        .then((data) => {
          setDashboardData(data);
        })
        .catch((err) => {
          setError(err?.message || 'Failed to load dashboard');
        })
        .finally(() => {
          setLoading(false);
        });
    } else if (!authLoading) {
      setLoading(false);
    }
  }, [orgData, authLoading]);

  const getSystemHealthStatus = (data: any) => {
    if (!data) return { status: 'error', label: 'Unknown', color: 'bg-error' };
    
    const totalRuns = data.totalRuns || 0;
    const recentRuns = data.recentRunsCount || 0;
    
    if (totalRuns === 0) return { status: 'warning', label: 'No Data', color: 'bg-warning' };
    if (recentRuns < 5) return { status: 'warning', label: 'Warning', color: 'bg-warning' };
    return { status: 'healthy', label: 'Healthy', color: 'bg-success' };
  };

  const generateSparklineData = (count: number) => {
    // Generate mock 7-day data for sparkline
    const data = [];
    for (let i = 6; i >= 0; i--) {
      const variation = Math.random() * 0.3 + 0.85; // Random between 0.85-1.15
      data.push({ value: Math.round(count * variation / 7) });
    }
    return data;
  };

  if (loading) {
    return (
      <Layout>
        <div className="min-h-screen bg-background p-6">
          <div className="max-w-7xl mx-auto space-y-8">
            {/* Header Skeleton */}
            <div className="space-y-2">
              <Skeleton className="h-9 w-48" />
              <Skeleton className="h-5 w-96" />
            </div>

            {/* Metrics Grid Skeleton */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {[...Array(4)].map((_, i) => (
                <Card key={i} className="shadow-soft">
                  <CardContent className="p-6">
                    <Skeleton className="h-24 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Chart Skeleton */}
            <Card className="shadow-soft">
              <CardHeader>
                <Skeleton className="h-6 w-48" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-80 w-full" />
              </CardContent>
            </Card>
          </div>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="min-h-screen bg-background p-6">
          <div className="max-w-7xl mx-auto">
            <div className="text-center py-12">
              <AlertCircle className="h-12 w-12 text-error mx-auto mb-4" />
              <h1 className="text-2xl font-semibold mb-2">Unable to Load Dashboard</h1>
              <p className="text-muted-foreground mb-6">{error}</p>
              <Button onClick={() => window.location.reload()}>
                Try Again
              </Button>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (!dashboardData) {
    return (
      <Layout>
        <div className="min-h-screen bg-background p-6">
          <div className="max-w-7xl mx-auto">
            <div className="text-center py-12">
              <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h1 className="text-2xl font-semibold mb-2">No Data Available</h1>
              <p className="text-muted-foreground">Start by creating some prompts to see your dashboard.</p>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  const healthStatus = getSystemHealthStatus(dashboardData);

  return (
    <Layout>
      <div className="min-h-screen bg-background">
        <div className={`${insightsOpen ? 'pr-80' : ''} transition-all duration-300`}>
          <div className="p-6">
            <div className="max-w-7xl mx-auto space-y-8">
              {/* Header */}
              <div className="space-y-2">
                <h1 className="text-4xl font-display font-bold text-foreground">Dashboard</h1>
                <p className="text-lg text-muted-foreground">
                  AI search optimization performance overview
                </p>
              </div>

              {/* Main Metrics Grid */}
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                {/* Today's Score - Circular Gauge */}
                <Card className="shadow-soft rounded-2xl border-0">
                  <CardHeader className="pb-4">
                    <CardTitle className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                      <Target className="h-4 w-4" />
                      Today's Score
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex justify-center pb-6">
                    <CircularGauge 
                      value={dashboardData.avgScore || 0} 
                      maxValue={10}
                      size={120}
                      label="Current Performance"
                    />
                  </CardContent>
                </Card>

                {/* Prompts Tracked - With Sparkline */}
                <Card className="shadow-soft rounded-2xl border-0">
                  <CardHeader className="pb-4">
                    <CardTitle className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                      <Zap className="h-4 w-4" />
                      Prompts Tracked
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="text-3xl font-bold text-foreground">
                        {dashboardData.promptCount}
                      </div>
                      <MiniSparkline 
                        data={generateSparklineData(dashboardData.promptCount)} 
                        color="hsl(var(--chart-1))"
                        className="h-8 w-20"
                      />
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Active monitoring
                    </div>
                  </CardContent>
                </Card>

                {/* Providers - Logo Display */}
                <Card className="shadow-soft rounded-2xl border-0">
                  <CardHeader className="pb-4">
                    <CardTitle className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                      <Activity className="h-4 w-4" />
                      Providers
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex gap-3">
                      {dashboardData.providers.slice(0, 2).map((provider: any) => (
                        <div key={provider.name} className="flex flex-col items-center">
                          <div className={`
                            w-8 h-8 rounded-lg flex items-center justify-center text-xs font-semibold
                            ${provider.name.toLowerCase() === 'openai' ? 'bg-gray-100 text-gray-900' : 'bg-blue-100 text-blue-900'}
                          `}>
                            {provider.name.toLowerCase() === 'openai' ? '🤖' : '🔍'}
                          </div>
                          <Badge 
                            variant={provider.enabled ? "default" : "secondary"} 
                            className={`
                              mt-1 text-xs px-2 py-0.5 
                              ${provider.enabled 
                                ? 'bg-success/10 text-success border-success/20' 
                                : 'bg-muted text-muted-foreground'
                              }
                            `}
                          >
                            {provider.enabled ? '✓' : '○'}
                          </Badge>
                        </div>
                      ))}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {dashboardData.providers.filter((p: any) => p.enabled).length} active
                    </div>
                  </CardContent>
                </Card>

                {/* System Health - Color-coded Badge */}
                <Card className="shadow-soft rounded-2xl border-0">
                  <CardHeader className="pb-4">
                    <CardTitle className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                      <Activity className="h-4 w-4" />
                      System Health
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${healthStatus.color}`} />
                      <Badge 
                        variant={healthStatus.status === 'healthy' ? 'default' : 'secondary'}
                        className={`
                          ${healthStatus.status === 'healthy' 
                            ? 'bg-success/10 text-success border-success/20' 
                            : healthStatus.status === 'warning'
                            ? 'bg-warning/10 text-warning border-warning/20'
                            : 'bg-error/10 text-error border-error/20'
                          }
                        `}
                      >
                        {healthStatus.status === 'healthy' && '✅'}
                        {healthStatus.status === 'warning' && '⚠️'}
                        {healthStatus.status === 'error' && '❌'}
                        {' '}{healthStatus.label}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {dashboardData.recentRunsCount} runs (7 days)
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Visibility Trends Chart */}
              {dashboardData.chartData && dashboardData.chartData.length > 0 && (
                <Card className="shadow-soft rounded-2xl border-0">
                  <CardHeader className="pb-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2 text-xl font-semibold">
                          <BarChart3 className="h-5 w-5 text-primary" />
                          Visibility Trends
                        </CardTitle>
                        <CardDescription className="mt-1">
                          Daily performance metrics and growth patterns
                        </CardDescription>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setInsightsOpen(!insightsOpen)}
                        className="bg-primary/5 border-primary/20 hover:bg-primary/10"
                      >
                        <TrendingUp className="mr-2 h-4 w-4" />
                        Quick Insights
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="h-80 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={dashboardData.chartData}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" />
                          <XAxis 
                            dataKey="date" 
                            tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            className="text-xs fill-muted-foreground"
                            axisLine={false}
                            tickLine={false}
                          />
                          <YAxis 
                            domain={[0, 10]} 
                            className="text-xs fill-muted-foreground"
                            axisLine={false}
                            tickLine={false}
                          />
                          <Tooltip 
                            labelFormatter={(value) => new Date(value).toLocaleDateString()}
                            formatter={(value: any, name) => [`${value}/10`, 'Visibility Score']}
                            contentStyle={{ 
                              backgroundColor: 'hsl(var(--card))', 
                              border: '1px solid hsl(var(--border))',
                              borderRadius: '12px',
                              boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.08)'
                            }}
                          />
                          <Line 
                            type="monotone" 
                            dataKey="score" 
                            stroke="hsl(var(--primary))" 
                            strokeWidth={3}
                            dot={{ fill: "hsl(var(--primary))", strokeWidth: 2, r: 4 }}
                            activeDot={{ r: 6, fill: "hsl(var(--primary))", stroke: "hsl(var(--card))", strokeWidth: 3 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                    
                    <div className="mt-6 grid grid-cols-3 gap-6">
                      <div className="text-center p-4 bg-muted/30 rounded-xl">
                        <div className="text-2xl font-bold text-success">
                          {dashboardData.chartData.length > 0 ? Math.max(...dashboardData.chartData.map((d: any) => d.score)) : 0}
                        </div>
                        <div className="text-sm font-medium text-muted-foreground">Peak Score</div>
                      </div>
                      <div className="text-center p-4 bg-muted/30 rounded-xl">
                        <div className="text-2xl font-bold text-primary">
                          {dashboardData.chartData.length > 0 ? 
                            Math.round((dashboardData.chartData.reduce((sum: number, d: any) => sum + d.score, 0) / dashboardData.chartData.length) * 10) / 10 
                            : 0
                          }
                        </div>
                        <div className="text-sm font-medium text-muted-foreground">Average</div>
                      </div>
                      <div className="text-center p-4 bg-muted/30 rounded-xl">
                        <div className="text-2xl font-bold text-warning">
                          {dashboardData.totalRuns}
                        </div>
                        <div className="text-sm font-medium text-muted-foreground">Total Runs</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Recent Prompts Table */}
              {dashboardData.prompts && dashboardData.prompts.length > 0 && (
                <Card className="shadow-soft rounded-2xl border-0">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Eye className="h-5 w-5 text-accent" />
                      Recent Prompts
                    </CardTitle>
                    <CardDescription>
                      Latest prompt performance and provider coverage
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {dashboardData.prompts.slice(0, 5).map((prompt: any) => (
                        <div key={prompt.id} className="flex items-center justify-between p-4 bg-muted/20 rounded-xl hover:bg-muted/30 transition-colors">
                          <div className="flex-1">
                            <div className="font-medium text-sm mb-1 truncate pr-4">
                              {prompt.text}
                            </div>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {new Date(prompt.created_at).toLocaleDateString()}
                              </span>
                              <span className="flex items-center gap-1">
                                <Activity className="h-3 w-3" />
                                Last Run Provider
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge 
                              variant={prompt.active ? "default" : "secondary"}
                              className={`
                                ${prompt.active 
                                  ? 'bg-success/10 text-success border-success/20' 
                                  : 'bg-muted text-muted-foreground'
                                }
                              `}
                            >
                              {prompt.active ? 'Active' : 'Inactive'}
                            </Badge>
                            <div className="w-12 h-8 bg-primary/10 rounded-md flex items-center justify-center">
                              <span className="text-xs font-semibold text-primary">8.2</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>

        {/* Quick Insights Sidebar */}
        <QuickInsights
          isOpen={insightsOpen}
          onToggle={() => setInsightsOpen(!insightsOpen)}
          trendData={dashboardData.chartData}
        />
      </div>
    </Layout>
  );
}