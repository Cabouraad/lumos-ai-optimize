import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Sparkles, 
  TrendingDown, 
  Activity,
  Loader2
} from 'lucide-react';
import { useLowVisibilityPrompts, useGenerateOptimizations } from '@/features/optimizations/hooks-v2';

export function LowVisibilityPromptsTable() {
  const { data: prompts, isLoading } = useLowVisibilityPrompts();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5" />
            Low-Visibility Prompts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
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
            Low-Visibility Prompts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Great visibility!</h3>
            <p className="text-sm text-muted-foreground">
              All your prompts have good brand presence (≥50%). Keep up the excellent work!
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingDown className="h-5 w-5" />
          Low-Visibility Prompts
          <Badge variant="secondary" className="ml-auto">
            up to 10 lowest performing prompts
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Prompt</TableHead>
              <TableHead className="text-center">Presence Rate</TableHead>
              <TableHead className="text-center">Runs (14d)</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {prompts.map((prompt) => (
              <PromptRow key={prompt.prompt_id} prompt={prompt} />
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function PromptRow({ prompt }: { prompt: any }) {
  const generateMutation = useGenerateOptimizations();

  const handleGenerate = () => {
    generateMutation.mutate({ limit: 10 });
  };

  const getPresenceColor = (rate: number) => {
    if (rate >= 30) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    if (rate >= 10) return 'text-orange-600 bg-orange-50 border-orange-200';
    return 'text-red-600 bg-red-50 border-red-200';
  };

  return (
    <TableRow>
      <TableCell className="max-w-md">
        <div className="text-sm font-medium truncate" title={prompt.prompt_text}>
          {prompt.prompt_text}
        </div>
      </TableCell>
      <TableCell className="text-center">
        <Badge variant="outline" className={getPresenceColor(prompt.presence_rate)}>
          {prompt.presence_rate.toFixed(1)}%
        </Badge>
      </TableCell>
      <TableCell className="text-center text-sm text-muted-foreground">
        {prompt.runs || 0}
      </TableCell>
      <TableCell className="text-right">
        <Button
          size="sm"
          variant="outline"
          onClick={handleGenerate}
          disabled={generateMutation.isPending}
          className="h-7"
        >
          {generateMutation.isPending ? (
            <Loader2 className="h-3 w-3 animate-spin mr-1" />
          ) : (
            <Sparkles className="h-3 w-3 mr-1" />
          )}
          {generateMutation.isPending ? 'Generating...' : 'Generate'}
        </Button>
      </TableCell>
    </TableRow>
  );
}
