import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useCitationTrends } from '@/hooks/useCitationTrends';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts';
import { format } from 'date-fns';

interface CitationTrendsProps {
  orgId: string | undefined;
  days: number;
  brandId?: string | null;
}

export function CitationTrends({ orgId, days, brandId }: CitationTrendsProps) {
  const { data, isLoading } = useCitationTrends(orgId, days, brandId);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Citation Trends
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const { trends, totalCitations, percentageChange, isGrowing } = data;

  const getTrendIcon = () => {
    if (percentageChange === 0) return <Minus className="h-5 w-5 text-muted-foreground" />;
    if (isGrowing) return <TrendingUp className="h-5 w-5 text-green-500" />;
    return <TrendingDown className="h-5 w-5 text-red-500" />;
  };

  const getTrendColor = () => {
    if (percentageChange === 0) return 'text-muted-foreground';
    if (isGrowing) return 'text-green-500';
    return 'text-red-500';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Citation Trends
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats */}
        <div className="flex items-center justify-between">
          <div>
            <div className="text-3xl font-bold">{totalCitations}</div>
            <div className="text-sm text-muted-foreground">Total Citations</div>
          </div>
          <div className="text-right">
            <div className={`flex items-center gap-1 text-2xl font-bold ${getTrendColor()}`}>
              {getTrendIcon()}
              {Math.abs(percentageChange)}%
            </div>
            <div className="text-sm text-muted-foreground">
              vs previous period
            </div>
          </div>
        </div>

        {/* Mini Chart */}
        <div className="h-24">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trends}>
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.[0]) return null;
                  return (
                    <div className="bg-card border border-border rounded-lg p-2 shadow-lg">
                      <p className="text-sm font-medium">
                        {format(new Date(payload[0].payload.date), 'MMM d')}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {payload[0].value} citations
                      </p>
                    </div>
                  );
                }}
              />
              <Line
                type="monotone"
                dataKey="citations"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
