import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sparkline } from '@/components/Sparkline';
import { getSafeDashboardData } from '@/lib/dashboard/safe-data';
import { TrendingUp, TrendingDown, Activity, AlertCircle } from 'lucide-react';

export default function Dashboard() {
  const { orgData, user, loading: authLoading } = useAuth();
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  console.log('Dashboard: Component render', { 
    hasOrgData: !!orgData, 
    hasUser: !!user, 
    authLoading, 
    orgId: orgData?.organizations?.id 
  });

  useEffect(() => {
    console.log('Dashboard: useEffect triggered', { orgData });
    
    if (orgData?.organizations?.id) {
      console.log('Dashboard: Loading dashboard data for org:', orgData.organizations.id);
      getSafeDashboardData()
        .then((data) => {
          console.log('Dashboard: Data loaded successfully', data);
          setDashboardData(data);
        })
        .catch((err) => {
          console.error('Dashboard: Error loading data', err);
          setError(err?.message || 'Failed to load dashboard');
        })
        .finally(() => {
          console.log('Dashboard: Finished loading');
          setLoading(false);
        });
    } else if (!authLoading) {
      console.log('Dashboard: No org data and not loading, stopping');
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
              <CardTitle className="text-sm font-medium">Providers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{dashboardData.providers.filter(p => p.enabled).length}</div>
              <p className="text-xs text-muted-foreground">Enabled providers</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">System Health</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-1">
                <Activity className="h-4 w-4 text-green-500" />
                <span className="text-sm">Operational</span>
              </div>
              <p className="text-xs text-muted-foreground">All systems running</p>
            </CardContent>
          </Card>
        </div>

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