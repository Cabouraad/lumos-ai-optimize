import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { TrendingUp, Calendar } from 'lucide-react';
import { format } from 'date-fns';

interface TrendDataPoint {
  period_start: string;
  competitor_name: string;
  mentions_count: number;
}

interface CompetitorTrendsChartProps {
  brandId?: string | null;
}

const COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

export function CompetitorTrendsChart({ brandId }: CompetitorTrendsChartProps) {
  const [timeInterval, setTimeInterval] = useState<'week' | 'month'>('week');
  const [loading, setLoading] = useState(true);
  const [rawData, setRawData] = useState<TrendDataPoint[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [competitors, setCompetitors] = useState<string[]>([]);

  useEffect(() => {
    fetchTrendData();
  }, [timeInterval, brandId]);

  const fetchTrendData = async () => {
    try {
      setLoading(true);
      
      // Get current user's org_id
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('No user found');
        return;
      }

      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('org_id')
        .eq('id', user.id)
        .single();

      if (userError || !userData?.org_id) {
        console.error('Failed to get org_id:', userError);
        return;
      }

      const { data, error } = await supabase.rpc('get_competitor_trends', {
        p_org_id: userData.org_id,
        p_interval: timeInterval === 'week' ? 'week' : 'month',
        p_days: timeInterval === 'week' ? 90 : 180,
        p_limit: 5,
        p_brand_id: brandId || null
      });

      if (error) {
        console.error('Error fetching competitor trends:', error);
        return;
      }

      if (!data || data.length === 0) {
        setRawData([]);
        setChartData([]);
        setCompetitors([]);
        return;
      }

      setRawData(data);

      // Get unique competitors
      const uniqueCompetitors = Array.from(new Set(data.map(d => d.competitor_name)));
      setCompetitors(uniqueCompetitors);

      // Transform data for recharts
      const periodMap = new Map<string, any>();
      
      data.forEach((item: TrendDataPoint) => {
        const period = item.period_start;
        if (!periodMap.has(period)) {
          periodMap.set(period, { 
            period,
            date: format(new Date(period), timeInterval === 'week' ? 'MMM d' : 'MMM yyyy')
          });
        }
        periodMap.get(period)[item.competitor_name] = item.mentions_count;
      });

      const transformed = Array.from(periodMap.values()).sort((a, b) => 
        new Date(a.period).getTime() - new Date(b.period).getTime()
      );

      setChartData(transformed);
    } catch (error) {
      console.error('Error in fetchTrendData:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Competitor Trends
            </CardTitle>
            <Skeleton className="h-10 w-40" />
          </div>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Competitor Trends
            </CardTitle>
            <Tabs value={timeInterval} onValueChange={(v) => setTimeInterval(v as 'week' | 'month')}>
              <TabsList>
                <TabsTrigger value="week">Weekly</TabsTrigger>
                <TabsTrigger value="month">Monthly</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">No trend data available</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              Run more prompts over time to see how competitor mentions change. Trends will appear once you have data from multiple {timeInterval === 'week' ? 'weeks' : 'months'}.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Competitor Trends
            </CardTitle>
            <Badge variant="secondary">
              Top {competitors.length} competitors
            </Badge>
          </div>
          <Tabs value={timeInterval} onValueChange={(v) => setTimeInterval(v as 'week' | 'month')}>
            <TabsList>
              <TabsTrigger value="week">Weekly</TabsTrigger>
              <TabsTrigger value="month">Monthly</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <p className="text-sm text-muted-foreground mt-2">
          Track how competitor mention frequency changes over time
        </p>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={350}>
          <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis 
              dataKey="date" 
              className="text-xs"
              stroke="hsl(var(--muted-foreground))"
            />
            <YAxis 
              className="text-xs"
              stroke="hsl(var(--muted-foreground))"
              label={{ 
                value: 'Mentions', 
                angle: -90, 
                position: 'insideLeft',
                className: 'fill-muted-foreground text-xs'
              }}
            />
            <Tooltip 
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '0.5rem',
                color: 'hsl(var(--foreground))'
              }}
            />
            <Legend 
              wrapperStyle={{
                paddingTop: '20px'
              }}
            />
            {competitors.map((competitor, index) => (
              <Line
                key={competitor}
                type="monotone"
                dataKey={competitor}
                stroke={COLORS[index % COLORS.length]}
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
                name={competitor}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
