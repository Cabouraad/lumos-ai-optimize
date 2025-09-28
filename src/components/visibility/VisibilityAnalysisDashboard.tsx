import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { TrendingDown, Target, Users, Zap } from 'lucide-react';
import { useVisibilityAnalysis } from '@/features/visibility-optimizer/hooks';
import { Skeleton } from '@/components/ui/skeleton';

export function VisibilityAnalysisDashboard() {
  const { data: analysis, isLoading, error } = useVisibilityAnalysis();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-8 w-16" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-4 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-destructive">Failed to load visibility analysis</p>
        </CardContent>
      </Card>
    );
  }

  if (!analysis) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Prompts</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analysis.total_prompts}</div>
            <p className="text-xs text-muted-foreground">
              Tracked across all LLMs
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Visibility Gaps</CardTitle>
            <TrendingDown className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {analysis.prompts_under_100_visibility}
            </div>
            <p className="text-xs text-muted-foreground">
              Prompts under 100% visibility
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Visibility</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analysis.average_visibility}%</div>
            <Progress 
              value={analysis.average_visibility} 
              className="mt-2" 
              max={100}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Top Competitors</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analysis.competitor_dominance.length}
            </div>
            <p className="text-xs text-muted-foreground">
              Active in your space
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Competitor Analysis */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Competitor Dominance
          </CardTitle>
          <CardDescription>
            Competitors appearing most frequently in your prompt responses
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {analysis.competitor_dominance.slice(0, 5).map((competitor, index) => (
              <div key={competitor.competitor} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Badge variant="secondary">#{index + 1}</Badge>
                  <div>
                    <p className="font-medium">{competitor.competitor}</p>
                    <p className="text-sm text-muted-foreground">
                      Appears in {competitor.prompts_affected.length} prompts
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold">
                    {Math.round(competitor.dominance_score)}%
                  </div>
                  <Progress 
                    value={competitor.dominance_score} 
                    className="w-24 mt-1" 
                    max={100}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

    </div>
  );
}