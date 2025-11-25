import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useCompetitors } from '@/features/competitors/hooks';
import { useMemo } from 'react';
import { Building2 } from 'lucide-react';

interface TopCompetitorsComparisonProps {
  orgId: string | undefined;
  responses: any[];
  isLoading?: boolean;
}

export function TopCompetitorsComparison({ 
  orgId, 
  responses, 
  isLoading: responsesLoading 
}: TopCompetitorsComparisonProps) {
  // Fetch competitors for the same period as brand stats (7 days) for accurate comparison
  const { data: competitors = [], isLoading: competitorsLoading } = useCompetitors({
    days: 7,
    limit: 3,
  });

  const brandStats = useMemo(() => {
    if (!responses || responses.length === 0) {
      return { rate: 0, count: 0, total: 0 };
    }

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentResponses = responses.filter((r) => {
      const date = new Date(r.run_at);
      return date >= sevenDaysAgo;
    });

    const present = recentResponses.filter((r) => r.org_brand_present).length;
    const total = recentResponses.length;
    const rate = total > 0 ? (present / total) * 100 : 0;

    return { rate, count: present, total };
  }, [responses]);

  const isLoading = responsesLoading || competitorsLoading;

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

  const topCompetitors = competitors.slice(0, 3);

  return (
    <Card className="bg-card/80 backdrop-blur-sm border shadow-soft">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">You vs Top Competitors</CardTitle>
        <p className="text-sm text-muted-foreground">
          Brand mention rate comparison (last 7 days)
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* Your Brand */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-primary/10 border border-primary/20">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-primary" />
              <div>
                <div className="font-semibold text-foreground">Your Brand</div>
                <div className="text-xs text-muted-foreground">
                  {brandStats.count} mentions
                </div>
              </div>
            </div>
            <Badge variant="default" className="text-base font-bold px-3 py-1">
              {brandStats.rate.toFixed(0)}%
            </Badge>
          </div>

          {/* Competitors */}
          {topCompetitors.length > 0 ? (
            topCompetitors.map((competitor, index) => (
              <div
                key={competitor.competitor_name}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50"
              >
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-muted-foreground" />
                  <div>
                    <div className="font-medium text-foreground">
                      {competitor.competitor_name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {competitor.total_mentions} mentions
                    </div>
                  </div>
                </div>
                <Badge variant="secondary" className="text-base font-semibold px-3 py-1">
                  {competitor.share_pct?.toFixed(0) || 0}%
                </Badge>
              </div>
            ))
          ) : (
            <div className="text-center py-6">
              <Building2 className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                No competitor data yet
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
