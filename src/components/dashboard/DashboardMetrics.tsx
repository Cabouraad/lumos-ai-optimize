import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MiniSparkline } from '@/components/MiniSparkline';
import { Eye, Users, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';

interface DashboardMetricsProps {
  metrics: {
    avgScore?: number;
    trend?: number;
    totalPrompts?: number;
    activePrompts?: number;
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
    if (trend > 0) return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (trend < 0) return <TrendingDown className="h-4 w-4 text-red-500" />;
    return null;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
      <Card className="bg-card/80 backdrop-blur-sm border shadow-soft hover-lift group">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Avg Visibility Score</CardTitle>
          <div className="p-2 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
            <Eye className="h-4 w-4 text-primary" />
          </div>
        </CardHeader>
        <CardContent>
          {metrics?.avgScore ? (
            <div className="flex items-center space-x-2">
              <div className="text-2xl font-bold text-primary">{formatScore(metrics.avgScore)}/10</div>
              {getTrendIcon(metrics?.trend || 0)}
              {(metrics?.trend || 0) !== 0 && (
                <span className="text-xs text-muted-foreground">
                  {Math.abs(metrics.trend).toFixed(1)}%
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
          <CardTitle className="text-sm font-medium">Brand Presence</CardTitle>
          <div className="p-2 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
            <Users className="h-4 w-4 text-primary" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold text-primary">{presenceStats.rate.toFixed(1)}%</div>
              <p className="text-xs text-muted-foreground">
                {presenceStats.presenceCount} of {presenceStats.totalCount} responses
              </p>
            </div>
            <div className="w-16 h-8">
              <MiniSparkline data={presenceStats.sparklineData} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card/80 backdrop-blur-sm border shadow-soft hover-lift group">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Prompts</CardTitle>
          <div className="p-2 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
            <AlertTriangle className="h-4 w-4 text-primary" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-primary">{metrics?.totalPrompts || 0}</div>
          <p className="text-xs text-muted-foreground">
            {metrics?.activePrompts || 0} active
          </p>
        </CardContent>
      </Card>

      <Card className="bg-card/80 backdrop-blur-sm border shadow-soft hover-lift group">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Recent Activity</CardTitle>
          <div className="p-2 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
            <TrendingUp className="h-4 w-4 text-primary" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-primary">
            {presenceStats.totalCount || 0}
          </div>
          <p className="text-xs text-muted-foreground">responses in 7 days</p>
        </CardContent>
      </Card>
    </div>
  );
}