import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Minus, Award, Link as LinkIcon } from 'lucide-react';

interface CitationMetrics {
  org_id: string;
  provider: string;
  metric_date: string;
  total_responses: number;
  responses_with_citations: number;
  citation_success_rate: number;
  avg_citations_per_response: number;
  total_citations: number;
  grounded_responses: number;
  grounding_success_rate: number;
}

export function CitationQualityDashboard() {
  const { data: metrics, isLoading } = useQuery({
    queryKey: ['citation-quality-metrics'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('citation_quality_metrics')
        .select('*')
        .order('metric_date', { ascending: true });

      if (error) throw error;
      return data as CitationMetrics[];
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-64 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  if (!metrics || metrics.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Citation Quality Metrics</CardTitle>
          <CardDescription>No data available yet</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // Calculate summary statistics
  const totalCitations = metrics.reduce((sum, m) => sum + (Number(m.total_citations) || 0), 0);
  const avgSuccessRate = metrics.reduce((sum, m) => sum + (Number(m.citation_success_rate) || 0), 0) / metrics.length;
  const avgGroundingRate = metrics.reduce((sum, m) => sum + (Number(m.grounding_success_rate) || 0), 0) / metrics.length;

  // Group by provider for comparison
  const providerStats = metrics.reduce((acc, m) => {
    if (!acc[m.provider]) {
      acc[m.provider] = {
        provider: m.provider,
        total_citations: 0,
        avg_citations: 0,
        grounding_rate: 0,
        count: 0,
      };
    }
    acc[m.provider].total_citations += Number(m.total_citations) || 0;
    acc[m.provider].avg_citations += Number(m.avg_citations_per_response) || 0;
    acc[m.provider].grounding_rate += Number(m.grounding_success_rate) || 0;
    acc[m.provider].count += 1;
    return acc;
  }, {} as Record<string, any>);

  const providerData = Object.values(providerStats).map((stat: any) => ({
    provider: stat.provider,
    total_citations: stat.total_citations,
    avg_citations: (stat.avg_citations / stat.count).toFixed(2),
    grounding_rate: (stat.grounding_rate / stat.count).toFixed(1),
  }));

  // Prepare time series data
  const timeSeriesData = metrics.map(m => ({
    date: new Date(m.metric_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    [m.provider]: Number(m.citation_success_rate) || 0,
  }));

  // Merge data by date
  const mergedTimeSeries = timeSeriesData.reduce((acc, item) => {
    const existing = acc.find(a => a.date === item.date);
    if (existing) {
      Object.assign(existing, item);
    } else {
      acc.push(item);
    }
    return acc;
  }, [] as any[]);

  const getTrendIcon = (rate: number) => {
    if (rate >= 70) return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (rate >= 40) return <Minus className="h-4 w-4 text-yellow-500" />;
    return <TrendingDown className="h-4 w-4 text-red-500" />;
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Citations</CardTitle>
            <LinkIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCitations.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Across all providers
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Citation Success Rate</CardTitle>
            {getTrendIcon(avgSuccessRate)}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgSuccessRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              Responses with citations
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Grounding Success Rate</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgGroundingRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              Provider-grounded citations
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Citation Success Rate Trend */}
      <Card>
        <CardHeader>
          <CardTitle>Citation Success Rate Trend</CardTitle>
          <CardDescription>
            Percentage of responses with citations over time
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={mergedTimeSeries}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis domain={[0, 100]} />
              <Tooltip />
              <Legend />
              {Object.keys(providerStats).map((provider, idx) => (
                <Line
                  key={provider}
                  type="monotone"
                  dataKey={provider}
                  stroke={`hsl(${idx * 137.5}, 70%, 50%)`}
                  strokeWidth={2}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Provider Comparison */}
      <Card>
        <CardHeader>
          <CardTitle>Provider Performance</CardTitle>
          <CardDescription>
            Comparing citation metrics across providers
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={providerData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="provider" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="total_citations" fill="hsl(var(--primary))" name="Total Citations" />
              <Bar dataKey="avg_citations" fill="hsl(var(--secondary))" name="Avg per Response" />
            </BarChart>
          </ResponsiveContainer>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            {providerData.map((provider: any) => (
              <div key={provider.provider} className="border border-border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <Badge variant="outline">{provider.provider}</Badge>
                  {getTrendIcon(Number(provider.grounding_rate))}
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total:</span>
                    <span className="font-medium">{provider.total_citations}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Avg/Response:</span>
                    <span className="font-medium">{provider.avg_citations}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Grounding:</span>
                    <span className="font-medium">{provider.grounding_rate}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
