/**
 * Dialog for generating and viewing prompt-specific optimizations
 */
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useGeneratePromptOptimizations, usePromptOptimizations } from '@/features/optimizations/hooks';
import { useGenerateContentStudioItem } from '@/features/content-studio/hooks';
import { Sparkles, ArrowRight, Clock, Target, TrendingUp, Loader2 } from 'lucide-react';
import type { OptimizationV2 } from '@/features/optimizations/api-v2';

interface OptimizePromptDialogProps {
  promptId: string;
  promptText: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const difficultyColors = {
  easy: 'bg-green-100 text-green-700 border-green-200',
  medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  hard: 'bg-red-100 text-red-700 border-red-200',
};

export function OptimizePromptDialog({ promptId, promptText, open, onOpenChange }: OptimizePromptDialogProps) {
  const generateMutation = useGeneratePromptOptimizations();
  const { data: optimizations, isLoading } = usePromptOptimizations(promptId);
  const generateContentMutation = useGenerateContentStudioItem();
  const [generatingContentFor, setGeneratingContentFor] = useState<string | null>(null);

  const handleGenerate = () => {
    generateMutation.mutate(promptId);
  };

  const handleMoveToContentStudio = async (optimization: OptimizationV2) => {
    setGeneratingContentFor(optimization.id);
    try {
      await generateContentMutation.mutateAsync({
        promptId: optimization.prompt_id || undefined,
      });
      // Success toast is handled by the hook
    } finally {
      setGeneratingContentFor(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Optimize Prompt Visibility
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            "{promptText}"
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Generate Button */}
          {(!optimizations || optimizations.length === 0) && !isLoading && (
            <Card className="border-dashed">
              <CardContent className="pt-6 text-center">
                <p className="text-sm text-muted-foreground mb-4">
                  Generate AI-powered optimization recommendations to improve visibility for this prompt.
                </p>
                <Button 
                  onClick={handleGenerate}
                  disabled={generateMutation.isPending}
                  className="w-full sm:w-auto"
                >
                  {generateMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Generate Optimizations
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <Skeleton key={i} className="h-48 w-full" />
              ))}
            </div>
          )}

          {/* Optimizations List */}
          {optimizations && optimizations.length > 0 && (
            <>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-muted-foreground">
                  {optimizations.length} Optimization{optimizations.length !== 1 ? 's' : ''} Available
                </h3>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleGenerate}
                  disabled={generateMutation.isPending}
                >
                  {generateMutation.isPending ? (
                    <>
                      <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3 w-3 mr-2" />
                      Generate More
                    </>
                  )}
                </Button>
              </div>

              <div className="space-y-3">
                {optimizations.map((opt) => (
                  <Card key={opt.id} className="overflow-hidden">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <CardTitle className="text-base mb-2">{opt.title}</CardTitle>
                          <p className="text-sm text-muted-foreground">{opt.description}</p>
                        </div>
                        <div className="flex flex-col gap-2 items-end">
                          <Badge className={difficultyColors[opt.difficulty_level as keyof typeof difficultyColors]}>
                            {opt.difficulty_level}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {opt.content_type}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Metrics */}
                      <div className="flex flex-wrap gap-4 text-sm">
                        <div className="flex items-center gap-1.5">
                          <TrendingUp className="h-4 w-4 text-primary" />
                          <span className="font-medium">Priority:</span>
                          <span className="text-muted-foreground">{opt.priority_score}/100</span>
                        </div>
                        {opt.estimated_hours && (
                          <div className="flex items-center gap-1.5">
                            <Clock className="h-4 w-4 text-blue-500" />
                            <span className="font-medium">Est. Time:</span>
                            <span className="text-muted-foreground">{opt.estimated_hours}h</span>
                          </div>
                        )}
                      </div>

                      {/* Implementation Steps Preview */}
                      {opt.implementation_steps && opt.implementation_steps.length > 0 && (
                        <div className="bg-muted/30 rounded-lg p-3">
                          <p className="text-xs font-medium text-muted-foreground mb-2">
                            {opt.implementation_steps.length} Implementation Steps
                          </p>
                          <ol className="text-sm space-y-1 list-decimal list-inside">
                            {opt.implementation_steps.slice(0, 3).map((step: any, idx: number) => (
                              <li key={idx} className="text-muted-foreground">
                                {step.action}
                              </li>
                            ))}
                            {opt.implementation_steps.length > 3 && (
                              <li className="text-xs text-muted-foreground italic">
                                +{opt.implementation_steps.length - 3} more steps...
                              </li>
                            )}
                          </ol>
                        </div>
                      )}

                      {/* Action Button */}
                      <Button
                        onClick={() => handleMoveToContentStudio(opt)}
                        disabled={generatingContentFor === opt.id}
                        className="w-full"
                        variant="default"
                      >
                        {generatingContentFor === opt.id ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Creating Content Blueprint...
                          </>
                        ) : (
                          <>
                            <Target className="h-4 w-4 mr-2" />
                            Move to Content Studio
                            <ArrowRight className="h-4 w-4 ml-2" />
                          </>
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
