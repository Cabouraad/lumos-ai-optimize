import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sparkline } from '@/components/Sparkline';
import { getSafeDashboardData } from '@/lib/dashboard/safe-data';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, Activity, AlertCircle, Eye, BarChart3 } from 'lucide-react';

export default function Dashboard() {
  const { orgData, user, loading: authLoading } = useAuth();
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  if (loading) {
    return (
      <Layout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
            <div className="mt-4 p-4 bg-destructive/10 text-destructive rounded-lg">
              {error}
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (!dashboardData) {
    return (
      <Layout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
            <p className="text-muted-foreground">No data available</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">
            Overview of your AI search optimization performance
          </p>
        </div>

        {/* Main metrics */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Overall Visibility Score</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                <div className="text-2xl font-bold">{dashboardData.overallScore}</div>
                <div className="text-sm text-muted-foreground">/10</div>
                {dashboardData.trend !== 0 && (
                  <div className={`flex items-center text-xs ${dashboardData.trend > 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {dashboardData.trend > 0 ? (
                      <TrendingUp className="h-3 w-3 mr-1" />
                    ) : (
                      <TrendingDown className="h-3 w-3 mr-1" />
                    )}
                    {Math.abs(dashboardData.trend)}%
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground">7-day average</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Today's Score</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{dashboardData.avgScore}</div>
              <p className="text-xs text-muted-foreground">Today's average</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Prompts Tracked</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{dashboardData.promptCount}</div>
              <p className="text-xs text-muted-foreground">Active prompts</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Recent Runs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{dashboardData.recentRunsCount}</div>
              <p className="text-xs text-muted-foreground">Last 7 days</p>
            </CardContent>
          </Card>
        </div>

        {/* Visibility Trends Chart */}
        {dashboardData.chartData && dashboardData.chartData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Visibility Trends
              </CardTitle>
              <CardDescription>Daily average visibility scores over time</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dashboardData.chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      className="text-xs"
                    />
                    <YAxis 
                      domain={[0, 10]} 
                      className="text-xs"
                    />
                    <Tooltip 
                      labelFormatter={(value) => new Date(value).toLocaleDateString()}
                      formatter={(value: any, name) => [`${value}/10`, 'Visibility Score']}
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--background))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '6px'
                      }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="score" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      dot={{ fill: "hsl(var(--primary))", strokeWidth: 2, r: 4 }}
                      activeDot={{ r: 6, fill: "hsl(var(--primary))" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
                <div className="text-center">
                  <div className="text-lg font-semibold text-green-600">
                    {dashboardData.chartData.length > 0 ? Math.max(...dashboardData.chartData.map(d => d.score)) : 0}
                  </div>
                  <div className="text-muted-foreground">Peak Score</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-semibold text-blue-600">
                    {dashboardData.chartData.length > 0 ? 
                      Math.round((dashboardData.chartData.reduce((sum, d) => sum + d.score, 0) / dashboardData.chartData.length) * 10) / 10 
                      : 0
                    }
                  </div>
                  <div className="text-muted-foreground">Average</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-semibold text-orange-600">
                    {dashboardData.totalRuns}
                  </div>
                  <div className="text-muted-foreground">Total Runs</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Providers overview */}
        <Card>
          <CardHeader>
            <CardTitle>Providers</CardTitle>
            <CardDescription>LLM provider status and configuration</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              {dashboardData.providers.map((provider: any) => (
                <div key={provider.name} className="flex items-center justify-between p-3 border rounded-lg">
                  <span className="capitalize font-medium">{provider.name}</span>
                  <Badge variant={provider.enabled ? "default" : "secondary"}>
                    {provider.enabled ? "Enabled" : "Disabled"}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Prompts overview */}
        {dashboardData.prompts.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Recent Prompts</CardTitle>
              <CardDescription>Your latest monitored prompts</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {dashboardData.prompts.slice(0, 5).map((prompt: any) => (
                  <div key={prompt.id} className="text-sm p-2 bg-muted rounded">
                    <div className="flex items-center justify-between">
                      <span className="truncate flex-1">{prompt.text}</span>
                      <Badge variant={prompt.active ? "default" : "secondary"} className="ml-2">
                        {prompt.active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-4">
                <h4 className="font-medium">No prompts yet</h4>
                <p className="text-sm text-muted-foreground">Add prompts on the Prompts page to start tracking.</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}