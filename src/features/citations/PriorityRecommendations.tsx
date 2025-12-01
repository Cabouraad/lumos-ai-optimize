import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Lightbulb, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface PriorityRecommendationsProps {
  days: number;
  brandId?: string | null;
}

interface Recommendation {
  recommendation_type: string;
  title: string;
  description: string;
  expected_impact: string;
  difficulty: string;
  priority: number;
  data_support: any;
}

export function PriorityRecommendations({ days, brandId }: PriorityRecommendationsProps) {
  const { data: recommendations, isLoading } = useQuery({
    queryKey: ['citation-recommendations', days, brandId ?? null],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: userData } = await supabase
        .from('users')
        .select('org_id')
        .eq('id', user.id)
        .single();

      if (!userData?.org_id) throw new Error('No organization found');

      const { data, error } = await supabase.rpc('get_citation_recommendations', {
        p_org_id: userData.org_id,
        p_days: days,
        p_brand_id: brandId || null,
      } as any);

      if (error) throw error;
      return data as Recommendation[];
    },
  });

  if (isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  if (!recommendations || recommendations.length === 0) {
    return (
      <Alert>
        <CheckCircle2 className="h-4 w-4" />
        <AlertTitle>Great job!</AlertTitle>
        <AlertDescription>
          No urgent recommendations at this time. Your citation strategy is performing well.
        </AlertDescription>
      </Alert>
    );
  }

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'Easy':
        return 'bg-green-500/10 text-green-600 hover:bg-green-500/20';
      case 'Medium':
        return 'bg-yellow-500/10 text-yellow-600 hover:bg-yellow-500/20';
      case 'Hard':
        return 'bg-red-500/10 text-red-600 hover:bg-red-500/20';
      default:
        return 'bg-muted';
    }
  };

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-primary" />
          Priority Actions
        </CardTitle>
        <CardDescription>
          AI-powered recommendations based on your citation performance data
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {recommendations.map((rec, idx) => (
          <div
            key={idx}
            className="border border-border rounded-lg p-4 hover:bg-accent/5 transition-colors"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className="font-semibold">
                    #{idx + 1}
                  </Badge>
                  <h3 className="font-semibold text-base">{rec.title}</h3>
                </div>
                <p className="text-sm text-muted-foreground">{rec.description}</p>
              </div>
            </div>

            <div className="flex items-center justify-between mt-4">
              <div className="flex items-center gap-3">
                <Badge className={getDifficultyColor(rec.difficulty)}>
                  {rec.difficulty}
                </Badge>
                <div className="text-sm">
                  <span className="text-muted-foreground">Expected Impact: </span>
                  <span className="font-semibold text-primary">{rec.expected_impact}</span>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </div>

            {rec.data_support && Object.keys(rec.data_support).length > 0 && (
              <div className="mt-4 pt-4 border-t border-border">
                <div className="text-xs text-muted-foreground space-y-1">
                  <p className="font-semibold">Data Insights:</p>
                  {rec.data_support.competitor_count && (
                    <p>• Competitor citations: {rec.data_support.competitor_count}</p>
                  )}
                  {rec.data_support.own_count !== undefined && (
                    <p>• Your citations: {rec.data_support.own_count}</p>
                  )}
                  {rec.data_support.avg_score && (
                    <p>• Average visibility score: {rec.data_support.avg_score}/10</p>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
