import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useMemo } from 'react';
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { format, startOfWeek, subWeeks } from 'date-fns';

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
        weeklyData: [],
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

    // Calculate weekly data for the past 4 weeks
    const weeklyData = [];
    for (let i = 3; i >= 0; i--) {
      const weekStart = subWeeks(startOfWeek(now, { weekStartsOn: 1 }), i);
      const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
      
      const weekResponses = responses.filter((r) => {
        const date = new Date(r.run_at);
        return date >= weekStart && date < weekEnd;
      });
      
      const weekPresent = weekResponses.filter((r) => r.org_brand_present).length;
      const weekTotal = weekResponses.length;
      const weekRate = weekTotal > 0 ? (weekPresent / weekTotal) * 100 : 0;
      
      weeklyData.push({
        week: format(weekStart, 'MMM d'),
        rate: weekRate,
      });
    }

    return {
      currentRate,
      previousRate,
      change,
      currentCount: currentPresent,
      currentTotal,
      weeklyData,
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
      <CardContent className="space-y-4">
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

        {/* Weekly Trend Chart */}
        {stats.weeklyData.length > 0 && (
          <div className="h-24 mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats.weeklyData}>
                <XAxis 
                  dataKey="week" 
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis 
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  domain={[0, 100]}
                  ticks={[0, 25, 50, 75, 100]}
                />
                <Line
                  type="monotone"
                  dataKey="rate"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={{ fill: 'hsl(var(--primary))', r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
