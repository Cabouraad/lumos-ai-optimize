import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useMemo } from 'react';

interface BrandPresenceRateProps {
  responses: any[];
  isLoading?: boolean;
}

export function BrandPresenceRate({ responses, isLoading }: BrandPresenceRateProps) {
  const stats = useMemo(() => {
    if (!responses || responses.length === 0) {
      return {
        currentRate: 0,
        previousRate: 0,
        change: 0,
        currentCount: 0,
        currentTotal: 0,
      };
    }

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    // Current week (last 7 days)
    const currentWeekResponses = responses.filter((r) => {
      const date = new Date(r.run_at);
      return date >= sevenDaysAgo && date <= now;
    });

    // Previous week (8-14 days ago)
    const previousWeekResponses = responses.filter((r) => {
      const date = new Date(r.run_at);
      return date >= fourteenDaysAgo && date < sevenDaysAgo;
    });

    const currentPresent = currentWeekResponses.filter((r) => r.org_brand_present).length;
    const currentTotal = currentWeekResponses.length;
    const currentRate = currentTotal > 0 ? (currentPresent / currentTotal) * 100 : 0;

    const previousPresent = previousWeekResponses.filter((r) => r.org_brand_present).length;
    const previousTotal = previousWeekResponses.length;
    const previousRate = previousTotal > 0 ? (previousPresent / previousTotal) * 100 : 0;

    const change = previousRate > 0 ? currentRate - previousRate : 0;

    return {
      currentRate,
      previousRate,
      change,
      currentCount: currentPresent,
      currentTotal,
    };
  }, [responses]);

  if (isLoading) {
    return (
      <Card className="bg-card/80 backdrop-blur-sm border shadow-soft">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  const getTrendIcon = () => {
    if (stats.change > 0) {
      return <TrendingUp className="h-5 w-5 text-success" />;
    } else if (stats.change < 0) {
      return <TrendingDown className="h-5 w-5 text-destructive" />;
    }
    return <Minus className="h-5 w-5 text-muted-foreground" />;
  };

  const getTrendColor = () => {
    if (stats.change > 0) return 'text-success';
    if (stats.change < 0) return 'text-destructive';
    return 'text-muted-foreground';
  };

  return (
    <Card className="bg-card/80 backdrop-blur-sm border shadow-soft">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Brand Presence Rate</CardTitle>
        <p className="text-sm text-muted-foreground">
          How often AI mentions your brand
        </p>
      </CardHeader>
      <CardContent>
        <div className="flex items-end justify-between">
          <div className="space-y-1">
            <div className="text-5xl font-bold text-foreground">
              {stats.currentRate.toFixed(0)}%
            </div>
            <div className="text-sm text-muted-foreground">
              {stats.currentCount} of {stats.currentTotal} responses
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-2">
              {getTrendIcon()}
              <span className={`text-lg font-semibold ${getTrendColor()}`}>
                {stats.change > 0 ? '+' : ''}
                {stats.change.toFixed(1)}%
              </span>
            </div>
            <span className="text-xs text-muted-foreground">vs last week</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
