import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sparkline } from '@/components/Sparkline';
import { getDashboardData } from '../../lib/dashboard/data';
import { TrendingUp, TrendingDown, Activity, AlertCircle } from 'lucide-react';

export default function Dashboard() {
  const { orgData } = useAuth();
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (orgData?.organizations?.id) {
      getDashboardData(orgData.organizations.id)
        .then(setDashboardData)
        .finally(() => setLoading(false));
    }
  }, [orgData]);

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
              <CardTitle className="text-sm font-medium">Today's Score</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{dashboardData.todayScore}</div>
              <div className="flex items-center mt-2">
                <Sparkline data={dashboardData.sparklineData} width={60} height={20} />
                <span className="text-xs text-muted-foreground ml-2">7 days</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Missing Prompts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{dashboardData.missingPrompts.length}</div>
              <p className="text-xs text-muted-foreground">Brand not found today</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Top Competitors</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{dashboardData.topCompetitors.length}</div>
              <p className="text-xs text-muted-foreground">Active this week</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">System Health</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-1">
                {dashboardData.health.errorRate < 10 ? (
                  <Activity className="h-4 w-4 text-green-500" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-red-500" />
                )}
                <span className="text-sm">{dashboardData.health.errorRate}% error</span>
              </div>
              <p className="text-xs text-muted-foreground">{dashboardData.health.tokenSpend} tokens today</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Missing prompts */}
          <Card>
            <CardHeader>
              <CardTitle>Top Missing Prompts</CardTitle>
              <CardDescription>Where your brand was not mentioned today</CardDescription>
            </CardHeader>
            <CardContent>
              {dashboardData.missingPrompts.length > 0 ? (
                <div className="space-y-2">
                  {dashboardData.missingPrompts.slice(0, 5).map((prompt: any, index: number) => (
                    <div key={index} className="text-sm p-2 bg-muted rounded">
                      {prompt.text.slice(0, 80)}...
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 text-muted-foreground">
                  Great! Your brand was found in all today's prompts.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top competitors */}
          <Card>
            <CardHeader>
              <CardTitle>Top Competitors</CardTitle>
              <CardDescription>Most mentioned brands this week</CardDescription>
            </CardHeader>
            <CardContent>
              {dashboardData.topCompetitors.length > 0 ? (
                <div className="space-y-2">
                  {dashboardData.topCompetitors.map((competitor: any, index: number) => (
                    <div key={index} className="flex justify-between items-center text-sm">
                      <span>{competitor.name}</span>
                      <Badge variant="secondary">{competitor.count}</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 text-muted-foreground">
                  No competitor data available yet.
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Health panel */}
        <Card>
          <CardHeader>
            <CardTitle>System Health</CardTitle>
            <CardDescription>Provider status and usage metrics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <h4 className="font-medium mb-2">Providers</h4>
                <div className="space-y-1">
                  {dashboardData.health.providers.map((provider: any) => (
                    <div key={provider.name} className="flex items-center justify-between text-sm">
                      <span className="capitalize">{provider.name}</span>
                      <Badge variant={provider.enabled ? "default" : "secondary"}>
                        {provider.enabled ? "Enabled" : "Disabled"}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
              
              <div>
                <h4 className="font-medium mb-2">Today's Usage</h4>
                <div className="text-2xl font-bold">{dashboardData.health.tokenSpend.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">Total tokens</p>
              </div>
              
              <div>
                <h4 className="font-medium mb-2">Error Rate</h4>
                <div className="text-2xl font-bold">{dashboardData.health.errorRate}%</div>
                <p className="text-xs text-muted-foreground">Failed requests</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}