import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Calendar, 
  BarChart3, 
  PlayCircle,
  Edit
} from 'lucide-react';
import { format } from 'date-fns';

interface PromptWithStats {
  id: string;
  text: string;
  active: boolean;
  created_at: string;
  runs_7d?: number;
  avg_score_7d?: number;
}

interface PromptRowProps {
  prompt: PromptWithStats;
  onRunPrompt: (promptId: string) => void;
  onEdit: (prompt: PromptWithStats) => void;
  canRunPrompts: boolean;
  isRunning?: boolean;
}

const getScoreColor = (score: number) => {
  if (score >= 7) return 'text-green-600 bg-green-50 border-green-200';
  if (score >= 5) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
  return 'text-red-600 bg-red-50 border-red-200';
};

const getScoreIcon = (score: number) => {
  if (score >= 7) return '🏆';
  if (score >= 5) return '⚡';
  return '📊';
};

export function PromptRow({ prompt, onRunPrompt, onEdit, canRunPrompts, isRunning = false }: PromptRowProps) {
  return (
    <Card className="hover:shadow-md transition-all duration-200 border-l-4 border-l-primary/20">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium leading-none line-clamp-2 mb-2">
              {prompt.text}
            </p>
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                <span>Created {format(new Date(prompt.created_at), 'MMM d, yyyy')}</span>
              </div>
              {prompt.runs_7d !== undefined && (
                <div className="flex items-center gap-1">
                  <BarChart3 className="h-3 w-3" />
                  <span>{prompt.runs_7d} runs (7d)</span>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge 
              variant="outline" 
              className={`${getScoreColor(prompt.avg_score_7d || 0)} font-medium`}
            >
              {getScoreIcon(prompt.avg_score_7d || 0)} {(prompt.avg_score_7d || 0).toFixed(1)}
            </Badge>
            <div className="flex gap-2">
              <Button
                onClick={() => onRunPrompt(prompt.id)}
                disabled={!canRunPrompts || isRunning}
                size="sm"
                className="flex items-center gap-2"
              >
                <PlayCircle className="h-4 w-4" />
                {isRunning ? 'Running...' : 'Run Now'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onEdit(prompt)}
              >
                <Edit className="h-4 w-4 mr-1" />
                Edit
              </Button>
            </div>
          </div>
        </div>
      </CardHeader>
    </Card>
  );
}