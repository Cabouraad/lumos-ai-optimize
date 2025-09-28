import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Loader2, 
  Zap, 
  Target, 
  FileText, 
  Share2, 
  Users, 
  BarChart3,
  Lightbulb,
  Plus
} from 'lucide-react';
import { OptimizationCard } from './OptimizationCard';
import { useContentOptimizations, useBatchGenerateOptimizations } from '@/features/visibility-optimizer/hooks';
import { useUser } from '@/contexts/UserProvider';
import { ContentOptimization } from '@/features/visibility-optimizer/types';

const contentTypeFilters = [
  { value: 'all', label: 'All Types', icon: Target },
  { value: 'blog_post', label: 'Blog Posts', icon: FileText },
  { value: 'social_post', label: 'Social Posts', icon: Share2 },
  { value: 'video_content', label: 'Video Content', icon: Users },
  { value: 'case_study', label: 'Case Studies', icon: BarChart3 },
  { value: 'community_answer', label: 'Community Answers', icon: Lightbulb },
];

export function OptimizationsGrid() {
  const { data: optimizations = [], isLoading, error } = useContentOptimizations();
  const batchGenerate = useBatchGenerateOptimizations();
  const { userData } = useUser();

  const handleBatchGenerate = async () => {
    if (!userData?.org_id) return;
    
    await batchGenerate.mutateAsync({
      orgContext: {
        name: userData.organizations?.name || 'Your Company',
        description: undefined // Remove non-existent property
      },
      maxPrompts: 5 // Generate for top 5 lowest visibility prompts
    });
  };

  const groupOptimizationsByType = (opts: ContentOptimization[]) => {
    return opts.reduce((acc, opt) => {
      if (!acc[opt.type]) {
        acc[opt.type] = [];
      }
      acc[opt.type].push(opt);
      return acc;
    }, {} as Record<string, ContentOptimization[]>);
  };

  const groupedOptimizations = groupOptimizationsByType(optimizations);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Content Optimizations
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

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Content Optimizations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-destructive">Failed to load optimizations</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              AI Visibility Optimizations
            </CardTitle>
            <CardDescription>
              Specific, actionable content recommendations to improve your AI search visibility
            </CardDescription>
          </div>
          <Button 
            onClick={handleBatchGenerate}
            disabled={batchGenerate.isPending}
            className="flex items-center gap-2"
          >
            {batchGenerate.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            {batchGenerate.isPending ? 'Generating...' : 'Generate New'}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {optimizations.length === 0 ? (
          <div className="text-center py-12">
            <Zap className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No Optimizations Yet</h3>
            <p className="text-muted-foreground mb-4">
              Generate AI-powered content recommendations to improve your visibility for prompts under 100%
            </p>
            <Button 
              onClick={handleBatchGenerate}
              disabled={batchGenerate.isPending}
              size="lg"
            >
              {batchGenerate.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Zap className="h-4 w-4 mr-2" />
              )}
              Generate Optimizations
            </Button>
          </div>
        ) : (
          <Tabs defaultValue="all" className="w-full">
            <TabsList className="grid w-full grid-cols-6">
              {contentTypeFilters.map((filter) => {
                const Icon = filter.icon;
                const count = filter.value === 'all' 
                  ? optimizations.length 
                  : (groupedOptimizations[filter.value]?.length || 0);
                
                return (
                  <TabsTrigger 
                    key={filter.value} 
                    value={filter.value}
                    className="flex items-center gap-1 text-xs"
                  >
                    <Icon className="h-3 w-3" />
                    {filter.label}
                    <Badge variant="secondary" className="ml-1 text-xs">
                      {count}
                    </Badge>
                  </TabsTrigger>
                );
              })}
            </TabsList>

            <TabsContent value="all" className="mt-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                {optimizations
                  .sort((a, b) => b.priority_score - a.priority_score)
                  .map((optimization) => (
                    <OptimizationCard 
                      key={optimization.id} 
                      optimization={optimization} 
                    />
                  ))
                }
              </div>
            </TabsContent>

            {contentTypeFilters.slice(1).map((filter) => (
              <TabsContent key={filter.value} value={filter.value} className="mt-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                  {(groupedOptimizations[filter.value] || [])
                    .sort((a, b) => b.priority_score - a.priority_score)
                    .map((optimization) => (
                      <OptimizationCard 
                        key={optimization.id} 
                        optimization={optimization} 
                      />
                    ))
                  }
                </div>
                {(!groupedOptimizations[filter.value] || groupedOptimizations[filter.value].length === 0) && (
                  <div className="text-center py-8">
                    <filter.icon className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-muted-foreground">
                      No {filter.label.toLowerCase()} optimizations yet
                    </p>
                  </div>
                )}
              </TabsContent>
            ))}
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}