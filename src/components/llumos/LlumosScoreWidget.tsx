import { useLlumosScore, getScoreColor } from '@/hooks/useLlumosScore';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Info, TrendingUp } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LlumosScoreDrawer } from './LlumosScoreDrawer';

interface LlumosScoreWidgetProps {
  promptId?: string;
  compact?: boolean;
}

export function LlumosScoreWidget({ promptId, compact = false }: LlumosScoreWidgetProps) {
  const { data: scoreData, isLoading, error } = useLlumosScore(promptId);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const navigate = useNavigate();
  
  // For org-level scores (no promptId), navigate to the detail page
  // For prompt-level scores, use the drawer
  const handleViewDetails = () => {
    if (promptId) {
      setDrawerOpen(true);
    } else {
      navigate('/llumos-score');
    }
  };

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

  return (
    <>
      <Card className="bg-card/80 backdrop-blur-sm border shadow-soft hover-lift group">
        <CardContent className={compact ? 'p-0' : 'p-6'}>
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center gap-2">
              <h3 className="text-sm font-medium">
                {promptId ? 'Prompt Score' : 'Llumos Score'}
              </h3>
            </div>
            
            {/* Score Dial */}
            <div className="relative inline-flex items-center justify-center">
              <svg className="w-32 h-32 transform -rotate-90">
                {/* Background circle */}
                <circle
                  cx="64"
                  cy="64"
                  r="52"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="none"
                  className="text-muted opacity-20"
                />
                {/* Progress circle */}
                <circle
                  cx="64"
                  cy="64"
                  r="52"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="none"
                  strokeDasharray={`${(scoreData.composite / 100) * 326.7} 326.7`}
                  className={scoreColor}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className={`text-4xl font-bold ${scoreColor}`}>
                    {scoreData.score}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {scoreData.tier}
                  </div>
                </div>
              </div>
            </div>

            {/* View details button */}
            {!compact && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleViewDetails}
                className="w-full"
              >
                <TrendingUp className="h-4 w-4 mr-2" />
                {promptId ? 'View Details' : 'View Full Analysis'}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Only show drawer for prompt-level scores */}
      {promptId && (
        <LlumosScoreDrawer
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          scoreData={scoreData}
          promptId={promptId}
        />
      )}
    </>
  );
}
