import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { OptimizationCard } from './OptimizationCard';
import { 
  Lightbulb, 
  FileText, 
  MessageSquare, 
  Share2, 
  Target,
  Loader2
} from 'lucide-react';
import { useOrgOptimizations } from '@/features/optimizations/hooks';

const contentTypeTabs = [
  { value: 'all', label: 'All', icon: Lightbulb },
  { value: 'social_post', label: 'Social Posts', icon: Share2 },
  { value: 'blog_outline', label: 'Blog Outlines', icon: FileText },
  { value: 'talking_points', label: 'Talking Points', icon: MessageSquare },
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

  // Group optimizations by content type
  const groupedOptimizations = optimizations.reduce((acc, opt) => {
    if (!acc[opt.content_type]) {
      acc[opt.content_type] = [];
    }
    acc[opt.content_type].push(opt);
    return acc;
  }, {} as Record<string, typeof optimizations>);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5" />
          Generated Optimizations
          <Badge variant="secondary" className="ml-auto">
            {optimizations.length} items
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="all" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            {contentTypeTabs.map((tab) => {
              const Icon = tab.icon;
              const count = tab.value === 'all' 
                ? optimizations.length 
                : groupedOptimizations[tab.value]?.length || 0;
              
              return (
                <TabsTrigger key={tab.value} value={tab.value} className="text-xs">
                  <Icon className="h-3 w-3 mr-1" />
                  {tab.label} ({count})
                </TabsTrigger>
              );
            })}
          </TabsList>

          <TabsContent value="all" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {optimizations.map((optimization) => (
                <OptimizationCard 
                  key={optimization.id} 
                  optimization={{
                    ...optimization,
                    content_type: optimization.content_type as 'social_post' | 'blog_outline' | 'talking_points' | 'cta_snippets',
                    sources: JSON.stringify(optimization.sources || {})
                  }} 
                />
              ))}
            </div>
          </TabsContent>

          {contentTypeTabs.slice(1).map((tab) => (
            <TabsContent key={tab.value} value={tab.value} className="mt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {(groupedOptimizations[tab.value] || []).map((optimization) => (
                  <OptimizationCard 
                    key={optimization.id} 
                    optimization={{
                      ...optimization,
                      content_type: optimization.content_type as 'social_post' | 'blog_outline' | 'talking_points' | 'cta_snippets',
                      sources: JSON.stringify(optimization.sources || {})
                    }} 
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