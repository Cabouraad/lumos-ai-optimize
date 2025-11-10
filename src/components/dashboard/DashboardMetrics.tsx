import { Card, CardContent, CardTitle } from '@/components/ui/card';
import { MiniSparkline } from '@/components/MiniSparkline';
import { HelpTooltip } from '@/components/HelpTooltip';
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
  promptLimit?: number;
}

export function DashboardMetrics({ metrics, presenceStats, promptLimit }: DashboardMetricsProps) {
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
    <>
      <Card className="bg-card/80 backdrop-blur-sm border shadow-soft hover-lift group h-full">
        <CardContent className="p-6 h-full flex flex-col">
          <div className="flex items-center justify-center gap-2 mb-4">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              Avg Visibility Score
              <HelpTooltip content="Average visibility score across all prompts. Higher scores indicate better AI presence and citation quality." />
            </CardTitle>
            <div className="p-2 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
              <Eye className="h-5 w-5 text-primary" />
            </div>
          </div>
          {metrics?.avgScore ? (
            <div className="flex-1 flex flex-col items-center justify-center space-y-3">
              <div className="flex items-baseline gap-2">
                <div className="text-4xl font-bold text-primary">{(metrics.avgScore * 10).toFixed(1)}%</div>
                {getTrendIcon(metrics?.trend || 0)}
              </div>
              {(metrics?.trend || 0) !== 0 && (
                <p className="text-sm text-muted-foreground text-center">
                  {Math.abs(metrics.trend).toFixed(1)}% {metrics.trend > 0 ? 'increase' : 'decrease'}
                </p>
              )}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center space-y-2">
              <div className="text-4xl font-bold text-muted-foreground">-%</div>
              <p className="text-sm text-muted-foreground">No data yet</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-card/80 backdrop-blur-sm border shadow-soft hover-lift group h-full">
        <CardContent className="p-6 h-full flex flex-col">
          <div className="flex items-center justify-center gap-2 mb-4">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              Brand Presence Rate
              <HelpTooltip content="Percentage of AI responses that mention your brand. Tracks your visibility across all monitored prompts." />
            </CardTitle>
            <div className="p-2 bg-secondary/10 rounded-lg group-hover:bg-secondary/20 transition-colors">
              <Users className="h-5 w-5 text-secondary" />
            </div>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center space-y-3">
            <div className="text-4xl font-bold text-secondary mt-4">{presenceStats.rate.toFixed(1)}%</div>
            <div className="w-20 h-10">
              <MiniSparkline data={presenceStats.sparklineData} color="hsl(var(--secondary))" />
            </div>
            <p className="text-sm text-muted-foreground text-center">
              {presenceStats.presenceCount} of {presenceStats.totalCount} responses
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card/80 backdrop-blur-sm border shadow-soft hover-lift group h-full">
        <CardContent className="p-6 h-full flex flex-col">
          <div className="flex items-center justify-center gap-2 mb-4">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              Active Prompts
              <HelpTooltip content="Number of prompts currently being monitored. Each prompt represents a query being tracked across multiple AI providers." />
            </CardTitle>
            <div className="p-2 bg-accent/10 rounded-lg group-hover:bg-accent/20 transition-colors">
              <AlertTriangle className="h-5 w-5 text-accent" />
            </div>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center space-y-3">
            <div className="text-4xl font-bold text-accent">
              {metrics?.activePrompts || 0}
              {promptLimit && <span className="text-muted-foreground"> / {promptLimit}</span>}
            </div>
            <p className="text-sm text-muted-foreground text-center">
              {metrics?.inactivePrompts || 0} inactive
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card/80 backdrop-blur-sm border shadow-soft hover-lift group h-full">
        <CardContent className="p-6 h-full flex flex-col">
          <div className="flex items-center justify-center gap-2 mb-4">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              Responses
              <HelpTooltip content="Total number of AI responses analyzed. Each response is evaluated for brand mentions, citations, and visibility metrics." />
            </CardTitle>
            <div className="p-2 bg-warning/10 rounded-lg group-hover:bg-warning/20 transition-colors">
              <TrendingUp className="h-5 w-5 text-warning" />
            </div>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center space-y-3">
            <div className="text-4xl font-bold text-warning">
              {metrics?.totalRuns || metrics?.recentRunsCount || 0}
            </div>
            <p className="text-sm text-muted-foreground text-center">total responses</p>
          </div>
        </CardContent>
      </Card>
    </>
  );
}