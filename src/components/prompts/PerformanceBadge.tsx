import { Badge } from '@/components/ui/badge';
import { Trophy, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface PerformanceBadgeProps {
  avgScore: number;
  trend?: number;
}

export function PerformanceBadge({ avgScore, trend = 0 }: PerformanceBadgeProps) {
  const score = avgScore * 10; // Convert to 0-10 scale
  
  if (score >= 8.0) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className="bg-success/10 text-success border-success/20 animate-scale-in">
              <Trophy className="h-3 w-3 mr-1" />
              Top Performer
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">Excellent visibility (Score: {score.toFixed(1)})</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }
  
  if (score < 5.0) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 animate-scale-in">
              <AlertTriangle className="h-3 w-3 mr-1" />
              Needs Attention
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">Low visibility (Score: {score.toFixed(1)})</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }
  
  if (trend > 0.5) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className="bg-success/10 text-success border-success/20 animate-scale-in">
              <TrendingUp className="h-3 w-3 mr-1" />
              Improving
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">Positive trend (+{trend.toFixed(1)})</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }
  
  if (trend < -0.5) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20 animate-scale-in">
              <TrendingDown className="h-3 w-3 mr-1" />
              Declining
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">Negative trend ({trend.toFixed(1)})</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }
  
  return null;
}
