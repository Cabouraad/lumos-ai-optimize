import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { CheckCircle2, ChevronDown, Clock, Target, Zap } from "lucide-react";
import { useState } from "react";
import type { OptimizationV2 } from "@/features/optimizations/api-v2";
import { useUpdateOptimizationStatus } from "@/features/optimizations/hooks-v2";

interface OptimizationCardProps {
  optimization: OptimizationV2;
}

const contentTypeIcons: Record<string, string> = {
  blog_post: "📝",
  case_study: "📊",
  guide: "📘",
  video: "🎥",
  podcast: "🎙️",
  reddit_post: "🗨️",
  quora_answer: "❓",
  whitepaper: "📄",
};

const difficultyColors: Record<string, string> = {
  easy: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  hard: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

const statusColors: Record<string, string> = {
  open: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  in_progress: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  completed: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  dismissed: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
};

export function OptimizationCard({ optimization }: OptimizationCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const updateStatus = useUpdateOptimizationStatus();

  const handleStatusChange = (status: 'in_progress' | 'completed' | 'dismissed') => {
    updateStatus.mutate({ id: optimization.id, status });
  };

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">{contentTypeIcons[optimization.content_type] || "📌"}</span>
              <Badge className={statusColors[optimization.status]}>
                {optimization.status}
              </Badge>
              <Badge className={difficultyColors[optimization.difficulty_level]}>
                {optimization.difficulty_level}
              </Badge>
            </div>
            <CardTitle className="text-xl">{optimization.title}</CardTitle>
            <CardDescription className="mt-2">{optimization.description}</CardDescription>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Target className="h-4 w-4" />
              <span className="font-semibold">{optimization.priority_score}/100</span>
            </div>
            {optimization.estimated_hours && (
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>{optimization.estimated_hours}h</span>
              </div>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
          <div>
            <p className="text-sm text-muted-foreground">Content Type</p>
            <p className="font-medium capitalize">{optimization.content_type.replace('_', ' ')}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Category</p>
            <p className="font-medium capitalize">{optimization.optimization_category}</p>
          </div>
        </div>

        {/* Content Specs */}
        {optimization.content_specs && Object.keys(optimization.content_specs).length > 0 && (
          <div className="space-y-2">
            <h4 className="font-semibold text-sm flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Content Specifications
            </h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {optimization.content_specs.word_count && (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Word Count:</span>
                  <span className="font-medium">{optimization.content_specs.word_count}</span>
                </div>
              )}
              {optimization.content_specs.tone && (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Tone:</span>
                  <span className="font-medium capitalize">{optimization.content_specs.tone}</span>
                </div>
              )}
            </div>
            {optimization.content_specs.key_points && (
              <div className="mt-2">
                <p className="text-sm font-medium mb-1">Key Points:</p>
                <ul className="list-disc list-inside text-sm space-y-1">
                  {optimization.content_specs.key_points.slice(0, 3).map((point: string, idx: number) => (
                    <li key={idx} className="text-muted-foreground">{point}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Expandable Details */}
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between">
              {isExpanded ? "Hide" : "Show"} Implementation Details
              <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-4 mt-4">
            {/* Implementation Steps */}
            {optimization.implementation_steps && optimization.implementation_steps.length > 0 && (
              <div>
                <h4 className="font-semibold text-sm mb-2">Implementation Steps</h4>
                <ol className="space-y-2">
                  {optimization.implementation_steps.map((step: any, idx: number) => (
                    <li key={idx} className="flex items-start gap-2 text-sm">
                      <span className="font-medium text-primary">{step.step}.</span>
                      <div className="flex-1">
                        <p>{step.action}</p>
                        {step.time && (
                          <p className="text-xs text-muted-foreground mt-1">Est. time: {step.time}</p>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* Distribution Channels */}
            {optimization.distribution_channels && optimization.distribution_channels.length > 0 && (
              <div>
                <h4 className="font-semibold text-sm mb-2">Distribution Channels</h4>
                <div className="space-y-2">
                  {optimization.distribution_channels.map((channel: any, idx: number) => (
                    <div key={idx} className="p-3 bg-muted/30 rounded-md text-sm">
                      <p className="font-medium">{channel.channel}</p>
                      {channel.posting_tips && (
                        <p className="text-muted-foreground mt-1">{channel.posting_tips}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Success Metrics */}
            {optimization.success_metrics && Object.keys(optimization.success_metrics).length > 0 && (
              <div>
                <h4 className="font-semibold text-sm mb-2">Success Metrics</h4>
                <div className="p-3 bg-muted/30 rounded-md text-sm space-y-1">
                  {optimization.success_metrics.primary_kpi && (
                    <p><span className="font-medium">KPI:</span> {optimization.success_metrics.primary_kpi}</p>
                  )}
                  {optimization.success_metrics.timeframe && (
                    <p><span className="font-medium">Timeframe:</span> {optimization.success_metrics.timeframe}</p>
                  )}
                </div>
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>
      </CardContent>

      <CardFooter className="flex gap-2">
        {optimization.status === 'open' && (
          <Button 
            onClick={() => handleStatusChange('in_progress')}
            className="flex-1"
            disabled={updateStatus.isPending}
          >
            Start Working
          </Button>
        )}
        {optimization.status === 'in_progress' && (
          <Button 
            onClick={() => handleStatusChange('completed')}
            className="flex-1"
            disabled={updateStatus.isPending}
          >
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Mark Complete
          </Button>
        )}
        {optimization.status !== 'dismissed' && optimization.status !== 'completed' && (
          <Button 
            onClick={() => handleStatusChange('dismissed')}
            variant="outline"
            disabled={updateStatus.isPending}
          >
            Dismiss
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}