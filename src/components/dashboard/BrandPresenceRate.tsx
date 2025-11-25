import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Minus, BarChart3 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useMemo, useState } from 'react';
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Legend, Tooltip } from 'recharts';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface BrandPresenceRateProps {
  responses: any[];
  isLoading?: boolean;
}

const CHART_COLORS = [
  'hsl(var(--primary))',
  'hsl(25, 95%, 53%)', // Orange
  'hsl(48, 96%, 53%)', // Yellow
  'hsl(142, 71%, 45%)', // Green
  'hsl(280, 100%, 70%)', // Purple
  'hsl(340, 75%, 55%)', // Pink
];

export function BrandPresenceRate({ responses, isLoading }: BrandPresenceRateProps) {
  const [disabledCompetitors, setDisabledCompetitors] = useState<Set<string>>(new Set());
  
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

    // Calculate daily data for the past 14 days with competitor comparison
    const competitorStats = new Map<string, { name: string; dailyRates: Map<string, number> }>();
    const weeklyData = [];
    
    // First pass: identify all competitors and initialize their data
    responses.forEach((r) => {
      try {
        const competitors = Array.isArray(r.competitors_json) ? r.competitors_json : [];
        competitors.forEach((comp: any) => {
          const compName = typeof comp === 'string' ? comp : comp?.name || comp?.brand;
          if (compName && !competitorStats.has(compName)) {
            competitorStats.set(compName, {
              name: compName,
              dailyRates: new Map(),
            });
          }
        });
      } catch (e) {
        // Skip invalid competitor data
      }
    });
    
    // Second pass: calculate daily rates for brand and competitors
    for (let i = 13; i >= 0; i--) {
      const dayStart = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
      const dateKey = format(dayStart, 'MMM d');
      
      const dayResponses = responses.filter((r) => {
        const date = new Date(r.run_at);
        return date >= dayStart && date < dayEnd;
      });
      
      if (dayResponses.length > 0) {
        // Calculate brand presence rate
        const dayPresent = dayResponses.filter((r) => r.org_brand_present).length;
        const brandRate = (dayPresent / dayResponses.length) * 100;
        
        // Calculate competitor presence rates
        const competitorMentions = new Map<string, number>();
        dayResponses.forEach((r) => {
          try {
            const competitors = Array.isArray(r.competitors_json) ? r.competitors_json : [];
            competitors.forEach((comp: any) => {
              const compName = typeof comp === 'string' ? comp : comp?.name || comp?.brand;
              if (compName) {
                competitorMentions.set(compName, (competitorMentions.get(compName) || 0) + 1);
              }
            });
          } catch (e) {
            // Skip invalid data
          }
        });
        
        const dataPoint: any = {
          date: dateKey,
          'Your Brand': brandRate,
        };
        
        // Add competitor rates
        competitorStats.forEach((stat, compName) => {
          const mentions = competitorMentions.get(compName) || 0;
          const rate = (mentions / dayResponses.length) * 100;
          dataPoint[compName] = rate;
        });
        
        weeklyData.push(dataPoint);
      }
    }
    
    // Get top 5 competitors by total mentions
    const topCompetitors = Array.from(competitorStats.entries())
      .map(([name, stat]) => {
        const totalMentions = Array.from(stat.dailyRates.values()).reduce((a, b) => a + b, 0);
        return { name, totalMentions };
      })
      .sort((a, b) => b.totalMentions - a.totalMentions)
      .slice(0, 5)
      .map(c => c.name);

    return {
      currentRate,
      previousRate,
      change,
      currentCount: currentPresent,
      currentTotal,
      weeklyData,
      topCompetitors,
    };
  }, [responses]);
  
  const toggleCompetitor = (competitor: string) => {
    setDisabledCompetitors(prev => {
      const next = new Set(prev);
      if (next.has(competitor)) {
        next.delete(competitor);
      } else {
        next.add(competitor);
      }
      return next;
    });
  };

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
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Brand Presence vs Competitors
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Daily presence rate comparison
            </p>
          </div>
        </div>
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

        {/* Competitor Toggles */}
        {stats.topCompetitors && stats.topCompetitors.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            <Badge 
              variant="default" 
              className="cursor-pointer hover:opacity-80"
              style={{ backgroundColor: CHART_COLORS[0] }}
            >
              Your Brand
            </Badge>
            {stats.topCompetitors.map((competitor, index) => (
              <Badge
                key={competitor}
                variant={disabledCompetitors.has(competitor) ? "outline" : "secondary"}
                className="cursor-pointer hover:opacity-80 transition-opacity"
                style={
                  !disabledCompetitors.has(competitor)
                    ? { backgroundColor: CHART_COLORS[(index + 1) % CHART_COLORS.length] }
                    : undefined
                }
                onClick={() => toggleCompetitor(competitor)}
              >
                {competitor}
              </Badge>
            ))}
          </div>
        )}

        {/* Comparison Chart */}
        {stats.weeklyData.length > 0 && (
          <div className="h-48 mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats.weeklyData}>
                <XAxis 
                  dataKey="date" 
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis 
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  domain={[0, 100]}
                  ticks={[0, 25, 50, 75, 100]}
                  label={{ value: 'Presence %', angle: -90, position: 'insideLeft', fontSize: 10 }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px',
                    fontSize: '12px',
                  }}
                  formatter={(value: any) => `${Number(value).toFixed(1)}%`}
                />
                <Line
                  type="monotone"
                  dataKey="Your Brand"
                  stroke={CHART_COLORS[0]}
                  strokeWidth={2.5}
                  dot={{ fill: CHART_COLORS[0], r: 3 }}
                  activeDot={{ r: 5 }}
                />
                {stats.topCompetitors?.map((competitor, index) => (
                  !disabledCompetitors.has(competitor) && (
                    <Line
                      key={competitor}
                      type="monotone"
                      dataKey={competitor}
                      stroke={CHART_COLORS[(index + 1) % CHART_COLORS.length]}
                      strokeWidth={2}
                      dot={{ fill: CHART_COLORS[(index + 1) % CHART_COLORS.length], r: 2 }}
                      activeDot={{ r: 4 }}
                    />
                  )
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
