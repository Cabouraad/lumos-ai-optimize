import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useWeeklyVisibilityTrend } from '@/hooks/useWeeklyVisibilityTrend';
import { Skeleton } from '@/components/ui/skeleton';

interface WeeklyVisibilityTrendProps {
  orgId: string | undefined;
}

export function WeeklyVisibilityTrend({ orgId }: WeeklyVisibilityTrendProps) {
  const { data, isLoading } = useWeeklyVisibilityTrend(orgId);

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

  if (!data || data.dailyData.length === 0) {
    return null;
  }

  const getTrendIcon = () => {
    if (data.percentageChange > 0) {
      return <TrendingUp className="h-4 w-4 text-success" />;
    } else if (data.percentageChange < 0) {
      return <TrendingDown className="h-4 w-4 text-destructive" />;
    }
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  const getTrendColor = () => {
    if (data.percentageChange > 0) return 'text-success';
    if (data.percentageChange < 0) return 'text-destructive';
    return 'text-muted-foreground';
  };

  return (
    <Card className="bg-card/80 backdrop-blur-sm border shadow-soft">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Weekly Visibility Trend</CardTitle>
          <div className="flex items-center gap-2">
            {getTrendIcon()}
            <span className={`text-sm font-semibold ${getTrendColor()}`}>
              {data.percentageChange > 0 ? '+' : ''}
              {data.percentageChange.toFixed(1)}% vs last week
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-32">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.dailyData}>
              <XAxis 
                dataKey="date" 
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis 
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                domain={[0, 10]}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  padding: '8px 12px',
                }}
                labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 600 }}
                itemStyle={{ color: 'hsl(var(--primary))' }}
                formatter={(value: number) => [`${value.toFixed(1)}`, 'Avg Score']}
              />
              <Line
                type="monotone"
                dataKey="avgScore"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={{ fill: 'hsl(var(--primary))', r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
          <div>
            <span className="font-medium text-foreground">Current:</span> {data.currentWeekAvg.toFixed(1)} avg
          </div>
          <div>
            <span className="font-medium text-foreground">Previous:</span> {data.previousWeekAvg.toFixed(1)} avg
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
