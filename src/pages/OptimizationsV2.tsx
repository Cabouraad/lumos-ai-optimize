import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Sparkles, RefreshCw, CheckCircle2, Clock, XCircle, Lightbulb } from "lucide-react";
import { OptimizationCard } from "@/components/optimizations-v2/OptimizationCard";
import { LowVisibilityTable } from "@/components/optimizations-v2/LowVisibilityTable";
import { useOptimizations, useGenerateOptimizations, useGenerationJob } from "@/features/optimizations/hooks-v2";
import { useToast } from "@/hooks/use-toast";

export default function OptimizationsV2() {
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const { data: optimizations, isLoading } = useOptimizations({ status: 'open', limit: 50 });
  const generateMutation = useGenerateOptimizations();
  const { data: job } = useGenerationJob(activeJobId);
  const { toast } = useToast();

  const handleGenerate = async () => {
    try {
      const result = await generateMutation.mutateAsync({ scope: 'org' });
      setActiveJobId(result.jobId);
      toast({
        title: "Generation started",
        description: `Job ${result.jobId} is processing your optimizations...`,
      });
    } catch (error) {
      console.error("Generation error:", error);
    }
  };

  // Group optimizations by status
  const openOptimizations = optimizations?.filter(o => o.status === 'open') || [];
  const inProgressOptimizations = optimizations?.filter(o => o.status === 'in_progress') || [];
  const completedOptimizations = optimizations?.filter(o => o.status === 'completed') || [];

  return (
    <Layout>
      <div className="container mx-auto py-8 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold flex items-center gap-3">
              <Lightbulb className="h-8 w-8 text-primary" />
              AI Optimizations
            </h1>
            <p className="text-muted-foreground mt-2">
              Actionable recommendations to improve your LLM visibility
            </p>
          </div>
          <Button 
            onClick={handleGenerate} 
            disabled={generateMutation.isPending || job?.status === 'running'}
            size="lg"
            className="gap-2"
          >
            {generateMutation.isPending || job?.status === 'running' ? (
              <>
                <RefreshCw className="h-5 w-5 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="h-5 w-5" />
                Generate Recommendations
              </>
            )}
          </Button>
        </div>

        {/* Generation Status */}
        {job && job.status !== 'completed' && (
          <Card className="border-primary/50 bg-primary/5">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <RefreshCw className="h-5 w-5 animate-spin text-primary" />
                  <CardTitle>Generation in Progress</CardTitle>
                </div>
                <Badge variant="outline">{job.status}</Badge>
              </div>
              <CardDescription>
                Processing your optimization recommendations...
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Open Tasks</CardDescription>
              <CardTitle className="text-3xl flex items-center gap-2">
                <Clock className="h-6 w-6 text-blue-500" />
                {openOptimizations.length}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>In Progress</CardDescription>
              <CardTitle className="text-3xl flex items-center gap-2">
                <RefreshCw className="h-6 w-6 text-purple-500" />
                {inProgressOptimizations.length}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Completed</CardDescription>
              <CardTitle className="text-3xl flex items-center gap-2">
                <CheckCircle2 className="h-6 w-6 text-green-500" />
                {completedOptimizations.length}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Total Generated</CardDescription>
              <CardTitle className="text-3xl flex items-center gap-2">
                <Sparkles className="h-6 w-6 text-yellow-500" />
                {optimizations?.length || 0}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="open" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="open" className="gap-2">
              <Clock className="h-4 w-4" />
              Open ({openOptimizations.length})
            </TabsTrigger>
            <TabsTrigger value="in-progress" className="gap-2">
              <RefreshCw className="h-4 w-4" />
              In Progress ({inProgressOptimizations.length})
            </TabsTrigger>
            <TabsTrigger value="completed" className="gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Completed ({completedOptimizations.length})
            </TabsTrigger>
            <TabsTrigger value="insights" className="gap-2">
              <Lightbulb className="h-4 w-4" />
              Insights
            </TabsTrigger>
          </TabsList>

          <TabsContent value="open" className="space-y-4">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, idx) => (
                <Skeleton key={idx} className="h-64 w-full" />
              ))
            ) : openOptimizations.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                  <CheckCircle2 className="h-16 w-16 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Open Optimizations</h3>
                  <p className="text-muted-foreground mb-4">
                    Generate new recommendations to see actionable tasks here
                  </p>
                  <Button onClick={handleGenerate} disabled={generateMutation.isPending}>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Generate Recommendations
                  </Button>
                </CardContent>
              </Card>
            ) : (
              openOptimizations.map((opt) => (
                <OptimizationCard key={opt.id} optimization={opt} />
              ))
            )}
          </TabsContent>

          <TabsContent value="in-progress" className="space-y-4">
            {inProgressOptimizations.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                  <RefreshCw className="h-16 w-16 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Tasks In Progress</h3>
                  <p className="text-muted-foreground">
                    Start working on an open optimization to see it here
                  </p>
                </CardContent>
              </Card>
            ) : (
              inProgressOptimizations.map((opt) => (
                <OptimizationCard key={opt.id} optimization={opt} />
              ))
            )}
          </TabsContent>

          <TabsContent value="completed" className="space-y-4">
            {completedOptimizations.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                  <XCircle className="h-16 w-16 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Completed Tasks</h3>
                  <p className="text-muted-foreground">
                    Complete optimizations to see your achievements here
                  </p>
                </CardContent>
              </Card>
            ) : (
              completedOptimizations.map((opt) => (
                <OptimizationCard key={opt.id} optimization={opt} />
              ))
            )}
          </TabsContent>

          <TabsContent value="insights" className="space-y-6">
            <LowVisibilityTable />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}