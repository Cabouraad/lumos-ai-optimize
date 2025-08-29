
import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface PromptCompetitor {
  name: string;
  mentions: number;
  share: number;
  trend: 'up' | 'down' | 'stable';
  recent_appearances: number;
}

interface PromptData {
  id: string;
  text: string;
  createdAt: string;
  category: string;
  providers: Array<{ name: string; enabled: boolean; lastRun?: string }>;
  lastRunAt?: string;
  visibilityScore: number;
  brandPct: number;
  competitorPct: number;
  sentimentDelta: number;
  active: boolean;
}

interface PromptCompetitorsProps {
  prompt: PromptData;
}

export function PromptCompetitors({ prompt }: PromptCompetitorsProps) {
  const [competitors, setCompetitors] = useState<PromptCompetitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCompetitors();
  }, [prompt.id]);

  const loadCompetitors = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: rpcError } = await supabase.rpc('get_prompt_competitors', {
        p_prompt_id: prompt.id,
        p_days: 30
      });

      if (rpcError) {
        console.error('Error loading prompt competitors:', rpcError);
        setError(rpcError.message);
        return;
      }

      // Transform the RPC response to match our interface
      const transformedCompetitors = (data || []).map((item: any) => ({
        name: item.competitor_name,
        mentions: item.total_mentions,
        share: Math.round(item.share_percentage),
        trend: item.trend_direction as 'up' | 'down' | 'stable',
        recent_appearances: item.recent_appearances
      }));

      setCompetitors(transformedCompetitors);
    } catch (err: any) {
      console.error('Failed to load prompt competitors:', err);
      setError(err.message || 'Failed to load competitors');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="text-sm font-medium text-muted-foreground">Top Competitors</div>
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-5 w-16" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-3">
        <div className="text-sm font-medium text-muted-foreground">Top Competitors</div>
        <div className="text-xs text-muted-foreground">
          Unable to load competitor data: {error}
        </div>
      </div>
    );
  }

  if (competitors.length === 0) {
    return (
      <div className="space-y-3">
        <div className="text-sm font-medium text-muted-foreground">Top Competitors</div>
        <div className="text-xs text-muted-foreground">
          No competitors detected in recent responses
        </div>
      </div>
    );
  }

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="h-3 w-3 text-success" />;
      case 'down':
        return <TrendingDown className="h-3 w-3 text-destructive" />;
      default:
        return <Minus className="h-3 w-3 text-muted-foreground" />;
    }
  };

  return (
    <div className="space-y-3">
      <div className="text-sm font-medium text-muted-foreground">
        Top Competitors ({competitors.length})
      </div>
      
      <div className="space-y-2">
        {competitors.slice(0, 5).map((competitor, index) => (
          <div key={`${competitor.name}-${index}`} className="flex items-center justify-between group">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">#{index + 1}</span>
                {getTrendIcon(competitor.trend)}
              </div>
              <span className="text-sm font-medium truncate" title={competitor.name}>
                {competitor.name}
              </span>
            </div>
            
            <div className="flex items-center gap-2 flex-shrink-0">
              <Badge variant="outline" className="text-xs px-2 py-0 h-5">
                {competitor.share}%
              </Badge>
              <span className="text-xs text-muted-foreground">
                {competitor.mentions} mentions
              </span>
            </div>
          </div>
        ))}
      </div>

      {competitors.length > 5 && (
        <div className="text-xs text-muted-foreground text-center pt-1 border-t border-border/30">
          +{competitors.length - 5} more competitors
        </div>
      )}
    </div>
  );
}
