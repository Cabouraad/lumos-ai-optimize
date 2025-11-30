import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, TrendingDown, Sparkles } from "lucide-react";
import { useLowVisibilityPrompts } from "@/features/optimizations/hooks-v2";
import { Skeleton } from "@/components/ui/skeleton";
import { useGenerateContentStudioItem, canUseContentStudio } from "@/features/content-studio/hooks";
import { ContentStudioDrawer, ContentStudioItem } from "@/features/content-studio";
import { useSubscriptionGate } from "@/hooks/useSubscriptionGate";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export function LowVisibilityTable() {
  const { data: prompts, isLoading } = useLowVisibilityPrompts(10);
  const [studioItem, setStudioItem] = useState<ContentStudioItem | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [generatingPromptId, setGeneratingPromptId] = useState<string | null>(null);
  const generateStudioItem = useGenerateContentStudioItem();
  const { limits } = useSubscriptionGate();
  const canUseStudio = canUseContentStudio(limits.hasRecommendations ? 'growth' : 'starter');

  const handleContentStudio = async (promptId: string) => {
    setGeneratingPromptId(promptId);
    try {
      const result = await generateStudioItem.mutateAsync({ promptId });
      if (result.item) {
        setStudioItem(result.item);
        setDrawerOpen(true);
      }
    } catch (error) {
      console.error('Failed to generate content studio item:', error);
    } finally {
      setGeneratingPromptId(null);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72 mt-2" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!prompts || prompts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5" />
            Low Visibility Prompts
          </CardTitle>
          <CardDescription>
            No low visibility prompts found. Great job!
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            Low Visibility Prompts
          </CardTitle>
          <CardDescription>
            These prompts have visibility rates below 75% and need optimization
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Prompt</TableHead>
                <TableHead className="text-center">Visibility</TableHead>
                <TableHead className="text-center">Total Runs</TableHead>
                <TableHead className="text-center">Avg Score</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {prompts.map((prompt) => (
                <TableRow key={prompt.prompt_id}>
                  <TableCell className="font-medium max-w-md">
                    {prompt.prompt_text}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge 
                      variant={prompt.presence_rate < 25 ? "destructive" : prompt.presence_rate < 50 ? "secondary" : "outline"}
                      className="font-mono"
                    >
                      {prompt.presence_rate.toFixed(1)}%
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center font-mono">
                    {prompt.total_runs}
                  </TableCell>
                  <TableCell className="text-center font-mono">
                    {prompt.avg_score_when_present ? `${(prompt.avg_score_when_present * 10).toFixed(1)}%` : "N/A"}
                  </TableCell>
                  <TableCell className="text-right">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleContentStudio(prompt.prompt_id)}
                              disabled={!canUseStudio || generatingPromptId === prompt.prompt_id}
                              className="gap-1"
                            >
                              {generatingPromptId === prompt.prompt_id ? (
                                <>
                                  <div className="h-4 w-4 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
                                  <span>Generating Blueprint...</span>
                                </>
                              ) : (
                                <>
                                  <Sparkles className="h-4 w-4 text-rose-500" />
                                  <span>Content Studio</span>
                                </>
                              )}
                            </Button>
                          </span>
                        </TooltipTrigger>
                        {!canUseStudio && (
                          <TooltipContent>
                            <p>Upgrade to Growth or Pro to access Content Studio</p>
                          </TooltipContent>
                        )}
                      </Tooltip>
                    </TooltipProvider>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <ContentStudioDrawer
        item={studioItem}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
    </>
  );
}