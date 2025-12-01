import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Target, Award, Info } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface HealthDashboardProps {
  days: number;
  brandId?: string | null;
}

interface HealthData {
  health_score: number;
  total_citations: number;
  avg_visibility_score: number;
  market_share_pct: number;
  week_over_week_change: number;
  total_own_citations: number;
  total_competitor_citations: number;
  trending_up: boolean;
}

export function CitationHealthDashboard({ days, brandId }: HealthDashboardProps) {
  const { data: health, isLoading } = useQuery({
    queryKey: ['citation-health-dashboard', days, brandId ?? null],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: userData } = await supabase
        .from('users')
        .select('org_id')
        .eq('id', user.id)
        .single();

      if (!userData?.org_id) throw new Error('No organization found');

      const { data, error } = await supabase.rpc('get_citation_health_dashboard', {
        p_org_id: userData.org_id,
        p_days: days,
        p_brand_id: brandId || null,
      } as any);

      if (error) throw error;
      return data?.[0] as HealthData;
    },
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
    );
  }

  if (!health) return null;

  const getHealthColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    if (score >= 40) return 'text-orange-600';
    return 'text-red-600';
  };

  const getHealthLabel = (score: number) => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Fair';
    return 'Needs Attention';
  };

  const getBenchmarkStatus = (value: number, benchmark: number, higherBetter: boolean = true) => {
    const diff = higherBetter ? value - benchmark : benchmark - value;
    if (diff >= 10) return { label: 'Above Average', color: 'text-green-600' };
    if (diff >= 0) return { label: 'Average', color: 'text-yellow-600' };
    return { label: 'Below Average', color: 'text-red-600' };
  };

  const visibilityBenchmark = getBenchmarkStatus(health.avg_visibility_score, 6.2);
  const marketShareBenchmark = getBenchmarkStatus(health.market_share_pct, 25);

  return (
    <div className="space-y-6">
      {/* Hero Health Score */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-background">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="text-2xl">Citation Health Score</span>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-5 w-5 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent className="max-w-sm">
                  <p>Composite score based on visibility (40%), market share (30%), and growth trend (30%). Scores above 60 are considered healthy.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </CardTitle>
          <CardDescription>Overall performance across all citation metrics</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <div className={`text-6xl font-bold ${getHealthColor(health.health_score)}`}>
                {health.health_score}
                <span className="text-2xl text-muted-foreground">/100</span>
              </div>
              <Badge variant={health.health_score >= 60 ? 'default' : 'destructive'} className="mt-2">
                {getHealthLabel(health.health_score)}
              </Badge>
            </div>
            <div className="text-right space-y-2">
              <div className="flex items-center gap-2">
                {health.trending_up ? (
                  <TrendingUp className="h-5 w-5 text-green-600" />
                ) : (
                  <TrendingDown className="h-5 w-5 text-red-600" />
                )}
                <span className={health.trending_up ? 'text-green-600' : 'text-red-600'}>
                  {health.week_over_week_change >= 0 ? '+' : ''}
                  {health.week_over_week_change.toFixed(1)}%
                </span>
              </div>
              <p className="text-xs text-muted-foreground">vs. previous period</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center justify-between">
              Total Citations
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Total unique citations across all AI responses in the selected period</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{health.total_citations}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {health.total_own_citations} yours · {health.total_competitor_citations} competitors
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center justify-between">
              Impact Score
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-sm">
                    <p>Average brand visibility when your content is cited. Scores of 6+ indicate strong presence. Industry average: 6.2</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {health.avg_visibility_score.toFixed(1)}
              <span className="text-lg text-muted-foreground">/10</span>
            </div>
            <Badge variant="outline" className={visibilityBenchmark.color + ' mt-1'}>
              {visibilityBenchmark.label}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center justify-between">
              Market Share
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-sm">
                    <p>Percentage of citations that are your content vs. competitors. Higher is better. Target: 25%+</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {health.market_share_pct.toFixed(1)}%
            </div>
            <Badge variant="outline" className={marketShareBenchmark.color + ' mt-1'}>
              {marketShareBenchmark.label}
            </Badge>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
