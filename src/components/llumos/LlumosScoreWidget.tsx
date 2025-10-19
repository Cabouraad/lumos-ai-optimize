import { useLlumosScore, getScoreColor, getScoreBgColor } from '@/hooks/useLlumosScore';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Info, TrendingUp } from 'lucide-react';
import { useState } from 'react';
import { LlumosScoreDrawer } from './LlumosScoreDrawer';

interface LlumosScoreWidgetProps {
  promptId?: string;
  compact?: boolean;
}

export function LlumosScoreWidget({ promptId, compact = false }: LlumosScoreWidgetProps) {
  const { data: scoreData, isLoading, error } = useLlumosScore(promptId);
  const [drawerOpen, setDrawerOpen] = useState(false);

  if (isLoading) {
    return (
      <Card className={compact ? 'p-4' : ''}>
        <CardContent className={compact ? 'p-0' : 'p-6'}>
          <div className="space-y-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-20 w-20 rounded-full mx-auto" />
            <Skeleton className="h-4 w-24 mx-auto" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !scoreData) {
    return (
      <Card className={compact ? 'p-4' : ''}>
        <CardContent className={compact ? 'p-0' : 'p-6'}>
          <div className="text-center text-muted-foreground">
            <Info className="h-8 w-8 mx-auto mb-2" />
            <p className="text-sm">Score not available</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const scoreColor = getScoreColor(scoreData.score);
  const scoreBg = getScoreBgColor(scoreData.score);

  return (
    <>
      <Card className={`${scoreBg} border ${compact ? 'p-3' : ''}`}>
        <CardContent className={compact ? 'p-0' : 'p-6'}>
          <div className="text-center space-y-3">
            <div className="flex items-center justify-center gap-2">
              <h3 className="text-sm font-medium text-muted-foreground">
                {promptId ? 'Prompt Score' : 'Llumos Score'}
              </h3>
              {scoreData.cached && (
                <span className="text-xs px-2 py-0.5 bg-muted rounded">cached</span>
              )}
            </div>
            
            {/* Score Dial */}
            <div className="relative inline-flex items-center justify-center">
              <svg className="w-24 h-24 transform -rotate-90">
                {/* Background circle */}
                <circle
                  cx="48"
                  cy="48"
                  r="40"
                  stroke="currentColor"
                  strokeWidth="6"
                  fill="none"
                  className="text-muted opacity-20"
                />
                {/* Progress circle */}
                <circle
                  cx="48"
                  cy="48"
                  r="40"
                  stroke="currentColor"
                  strokeWidth="6"
                  fill="none"
                  strokeDasharray={`${(scoreData.composite / 100) * 251.2} 251.2`}
                  className={scoreColor}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className={`text-2xl font-bold ${scoreColor}`}>
                    {scoreData.score}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {scoreData.tier}
                  </div>
                </div>
              </div>
            </div>

            {/* Composite percentage */}
            <div className="text-sm text-muted-foreground">
              {scoreData.composite.toFixed(1)}% composite
            </div>

            {/* View details button */}
            {!compact && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDrawerOpen(true)}
                className="w-full"
              >
                <TrendingUp className="h-4 w-4 mr-2" />
                View Details
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <LlumosScoreDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        scoreData={scoreData}
        promptId={promptId}
      />
    </>
  );
}
