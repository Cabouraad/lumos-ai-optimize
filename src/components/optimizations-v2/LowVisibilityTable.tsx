import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, TrendingDown } from "lucide-react";
import { useLowVisibilityPrompts } from "@/features/optimizations/hooks-v2";
import { Skeleton } from "@/components/ui/skeleton";

export function LowVisibilityTable() {
  const { data: prompts, isLoading } = useLowVisibilityPrompts(10);

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
              <TableHead className="text-right">Last Checked</TableHead>
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
                <TableCell className="text-right text-sm text-muted-foreground">
                  {new Date(prompt.last_checked_at).toLocaleDateString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}