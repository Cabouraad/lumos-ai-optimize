import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Loader2, Lightbulb, Target, TrendingDown } from 'lucide-react';
import { useOrgOptimizations } from '@/features/optimizations/hooks';
import { EnhancedOptimizationCard } from './EnhancedOptimizationCard';

const contentTypeTabs = [
  { value: 'social_post', label: 'Social Posts', icon: Target },
  { value: 'blog_outline', label: 'Blog Outlines', icon: Target },
  { value: 'talking_points', label: 'Talking Points', icon: Target },
  { value: 'cta_snippets', label: 'CTA Snippets', icon: Target },
];

export function OptimizationsGrid() {
  const { data: optimizations, isLoading } = useOrgOptimizations();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5" />
            Generated Optimizations
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

  if (!optimizations || optimizations.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5" />
            Generated Optimizations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Lightbulb className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No optimizations yet</h3>
            <p className="text-sm text-muted-foreground">
              Generate AI-powered content recommendations to see them here.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Separate optimizations by category
  const lowVisibilityOptimizations = optimizations.filter(
    opt => opt.optimization_category === 'low_visibility'
  );
  const generalOptimizations = optimizations.filter(
    opt => opt.optimization_category === 'general'
  );

  // Group by content type for the "All" tab
  const groupedOptimizations = optimizations.reduce((acc, opt) => {
    const type = opt.content_type;
    if (!acc[type]) {
      acc[type] = [];
    }
    acc[type].push(opt);
    return acc;
  }, {} as Record<string, typeof optimizations>);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5" />
          AI Visibility Optimizations
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="low_visibility" className="w-full">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="low_visibility" className="flex items-center gap-1">
              <TrendingDown className="h-3 w-3" />
              Low-Visibility Fixes
              <Badge variant="secondary" className="ml-1 text-xs">
                {lowVisibilityOptimizations.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="general" className="flex items-center gap-1">
              <Target className="h-3 w-3" />
              General Strategy
              <Badge variant="secondary" className="ml-1 text-xs">
                {generalOptimizations.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="all">
              All ({optimizations.length})
            </TabsTrigger>
            {contentTypeTabs.map((tab) => {
              const count = groupedOptimizations[tab.value]?.length || 0;
              const Icon = tab.icon;
              return (
                <TabsTrigger key={tab.value} value={tab.value} className="flex items-center gap-1">
                  <Icon className="h-3 w-3" />
                  {tab.label} ({count})
                </TabsTrigger>
              );
            })}
          </TabsList>

          <TabsContent value="low_visibility" className="mt-6">
            <div className="mb-4 p4 bg-amber-50 border border-amber-200 rounded-lg">
              <h3 className="font-medium text-amber-800 mb-2">📈 Low-Visibility Prompt Fixes</h3>
              <p className="text-sm text-amber-700">
                Targeted optimizations to improve visibility for prompts with less than 50% presence rate. 
                Limited to 10 most impactful optimizations.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {lowVisibilityOptimizations.map((optimization) => (
                <EnhancedOptimizationCard 
                  key={optimization.id} 
                  optimization={optimization as any} 
                />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="general" className="mt-6">
            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h3 className="font-medium text-blue-800 mb-2">🎯 General Brand Visibility</h3>
              <p className="text-sm text-blue-700">
                Comprehensive strategies to build overall brand authority and visibility across AI search results.
                Includes thought leadership, community engagement, and content marketing approaches.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {generalOptimizations.map((optimization) => (
                <EnhancedOptimizationCard 
                  key={optimization.id} 
                  optimization={optimization as any} 
                />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="all" className="mt-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {optimizations.map((optimization) => (
                <EnhancedOptimizationCard 
                  key={optimization.id} 
                  optimization={optimization as any} 
                />
              ))}
            </div>
          </TabsContent>

          {contentTypeTabs.map((tab) => (
            <TabsContent key={tab.value} value={tab.value} className="mt-6">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {(groupedOptimizations[tab.value] || []).map((optimization) => (
                  <EnhancedOptimizationCard 
                    key={optimization.id} 
                    optimization={optimization as any} 
                  />
                ))}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}