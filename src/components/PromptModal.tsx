import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { ExternalLink, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface PromptData {
  id: string;
  text: string;
  recent_scores: number[];
  avg_score: number;
}

interface PromptModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  promptIds: string[];
  orgId?: string;
}

export function PromptModal({ open, onOpenChange, promptIds, orgId }: PromptModalProps) {
  const [prompts, setPrompts] = useState<PromptData[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && promptIds.length > 0) {
      loadPrompts();
    }
  }, [open, promptIds]);

  const loadPrompts = async () => {
    if (!orgId || promptIds.length === 0) return;

    setLoading(true);
    try {
      // Load basic prompt data
      const { data: promptsData } = await supabase
        .from('prompts')
        .select('id, text')
        .in('id', promptIds)
        .eq('org_id', orgId);

      if (!promptsData) {
        setPrompts([]);
        return;
      }

      // Load recent visibility scores for each prompt
      const promptsWithScores = await Promise.all(
        promptsData.map(async (prompt) => {
          const { data: visibilityData } = await supabase
            .from('visibility_results')
            .select(`
              score,
              prompt_runs!inner(prompt_id, run_at)
            `)
            .eq('prompt_runs.prompt_id', prompt.id)
            .order('prompt_runs.run_at', { ascending: false })
            .limit(10);

          const scores = visibilityData?.map(v => v.score) || [];
          const avgScore = scores.length > 0 ? scores.reduce((sum, s) => sum + s, 0) / scores.length : 0;

          return {
            ...prompt,
            recent_scores: scores,
            avg_score: avgScore
          };
        })
      );

      setPrompts(promptsWithScores);
    } catch (error) {
      console.error('Error loading prompt data:', error);
      setPrompts([]);
    } finally {
      setLoading(false);
    }
  };

  const getScoreTrend = (scores: number[]) => {
    if (scores.length < 2) return 'stable';
    
    const recent = scores.slice(0, Math.min(3, scores.length));
    const older = scores.slice(Math.min(3, scores.length));
    
    if (older.length === 0) return 'stable';
    
    const recentAvg = recent.reduce((sum, s) => sum + s, 0) / recent.length;
    const olderAvg = older.reduce((sum, s) => sum + s, 0) / older.length;
    
    const diff = recentAvg - olderAvg;
    
    if (Math.abs(diff) < 0.5) return 'stable';
    return diff > 0 ? 'improving' : 'declining';
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving':
        return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'declining':
        return <TrendingDown className="h-4 w-4 text-red-600" />;
      default:
        return <Minus className="h-4 w-4 text-gray-600" />;
    }
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'improving':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'declining':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ExternalLink className="h-5 w-5" />
            Linked Prompts ({promptIds.length})
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {loading ? (
            Array.from({ length: Math.min(3, promptIds.length) }).map((_, i) => (
              <div key={i} className="space-y-3 p-4 border rounded-lg">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-16 w-full" />
                <div className="flex gap-2">
                  <Skeleton className="h-6 w-20" />
                  <Skeleton className="h-6 w-16" />
                </div>
              </div>
            ))
          ) : prompts.length > 0 ? (
            prompts.map((prompt) => {
              const trend = getScoreTrend(prompt.recent_scores);
              
              return (
                <div key={prompt.id} className="p-4 border rounded-lg space-y-3">
                  <div className="flex items-start justify-between">
                    <h4 className="font-medium text-foreground line-clamp-2">
                      {prompt.text}
                    </h4>
                  </div>
                  
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline">
                      Avg Score: {prompt.avg_score.toFixed(1)}
                    </Badge>
                    <Badge className={getTrendColor(trend)}>
                      {getTrendIcon(trend)}
                      <span className="ml-1 capitalize">{trend}</span>
                    </Badge>
                    {prompt.recent_scores.length > 0 && (
                      <Badge variant="secondary">
                        {prompt.recent_scores.length} recent runs
                      </Badge>
                    )}
                  </div>
                  
                  {prompt.recent_scores.length > 0 && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <span>Recent scores:</span>
                      {prompt.recent_scores.slice(0, 5).map((score, i) => (
                        <span key={i} className="bg-muted px-1 py-0.5 rounded">
                          {score.toFixed(1)}
                        </span>
                      ))}
                      {prompt.recent_scores.length > 5 && (
                        <span className="text-muted-foreground">
                          +{prompt.recent_scores.length - 5} more
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p>No prompt data available</p>
            </div>
          )}
        </div>

        <div className="flex justify-end pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}