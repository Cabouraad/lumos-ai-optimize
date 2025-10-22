import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MiniSparkline } from '@/components/MiniSparkline';
import { Eye, Users, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';

interface DashboardMetricsProps {
  metrics: {
    avgScore?: number;
    trend?: number;
    totalPrompts?: number;
    activePrompts?: number;
    inactivePrompts?: number;
    promptCount?: number;
    totalRuns?: number;
    recentRunsCount?: number;
  };
  presenceStats: {
    rate: number;
    sparklineData: Array<{ value: number }>;
    totalCount: number;
    presenceCount: number;
  };
}

export function DashboardMetrics({ metrics, presenceStats }: DashboardMetricsProps) {
  // Debug logging for troubleshooting
  console.log('[DashboardMetrics] Props received:', {
    metrics,
    presenceStats,
    hasAvgScore: !!metrics?.avgScore,
    presenceRate: presenceStats.rate
  });

  const formatScore = (score: number) => Math.round(score * 10) / 10;
  
  const getTrendIcon = (trend: number) => {
    if (trend > 0) return <TrendingUp className="h-4 w-4 text-success" />;
    if (trend < 0) return <TrendingDown className="h-4 w-4 text-error" />;
    return null;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <Card className="bg-card/80 backdrop-blur-sm border shadow-soft hover-lift group h-full">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Avg Visibility Score</CardTitle>
          <div className="p-2 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
            <Eye className="h-4 w-4 text-primary" />
          </div>
        </CardHeader>
        <CardContent>
          {metrics?.avgScore ? (
            <div className="flex items-center space-x-2">
              <div className="text-2xl font-bold text-primary">{(metrics.avgScore * 10).toFixed(1)}%</div>
              {getTrendIcon(metrics?.trend || 0)}
              {(metrics?.trend || 0) !== 0 && (
                <span className="text-xs text-muted-foreground">
                  {Math.abs(metrics.trend).toFixed(1)}%
                </span>
              )}
            </div>
          ) : (
            <div className="space-y-1">
              <div className="text-2xl font-bold text-muted-foreground">-%</div>
              <p className="text-xs text-muted-foreground">No data yet</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-card/80 backdrop-blur-sm border shadow-soft hover-lift group h-full">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Brand Presence Rate</CardTitle>
          <div className="p-2 bg-secondary/10 rounded-lg group-hover:bg-secondary/20 transition-colors">
            <Users className="h-4 w-4 text-secondary" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold text-secondary">{presenceStats.rate.toFixed(1)}%</div>
              <p className="text-xs text-muted-foreground">
                {presenceStats.presenceCount} of {presenceStats.totalCount} responses
              </p>
            </div>
            <div className="w-16 h-8">
              <MiniSparkline data={presenceStats.sparklineData} color="hsl(var(--secondary))" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card/80 backdrop-blur-sm border shadow-soft hover-lift group h-full">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Active Prompts</CardTitle>
          <div className="p-2 bg-accent/10 rounded-lg group-hover:bg-accent/20 transition-colors">
            <AlertTriangle className="h-4 w-4 text-accent" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-accent">{metrics?.promptCount || metrics?.totalPrompts || 0}</div>
          <p className="text-xs text-muted-foreground">
            {metrics?.inactivePrompts || 0} inactive
          </p>
        </CardContent>
      </Card>

      <Card className="bg-card/80 backdrop-blur-sm border shadow-soft hover-lift group h-full">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Responses</CardTitle>
          <div className="p-2 bg-warning/10 rounded-lg group-hover:bg-warning/20 transition-colors">
            <TrendingUp className="h-4 w-4 text-warning" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-warning">
            {metrics?.totalRuns || metrics?.recentRunsCount || 0}
          </div>
          <p className="text-xs text-muted-foreground">total responses</p>
        </CardContent>
      </Card>
    </div>
  );
}