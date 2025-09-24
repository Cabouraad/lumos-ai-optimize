import { useOrgOptimizations } from '@/features/optimizations/hooks';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EnhancedOptimizationCard } from './EnhancedOptimizationCard';
import { Loader2, Target } from 'lucide-react';

export function GeneralOptimizationsCard() {
  const { data: optimizations = [], isLoading } = useOrgOptimizations();
  
  const generalOptimizations = optimizations.filter(
    opt => opt.optimization_category === 'general'
  );

  if (isLoading) {
    return (
      <Card className="h-fit">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-blue-500" />
              <CardTitle className="text-lg">General Brand Visibility Strategy</CardTitle>
            </div>
            <Badge variant="secondary" className="bg-blue-100 text-blue-700">
              <Loader2 className="h-3 w-3 animate-spin mr-1" />
              Loading
            </Badge>
          </div>
          <CardDescription>
            Comprehensive strategies to build overall brand authority and visibility across AI search results. Includes thought leadership, community engagement, and content marketing approaches.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-fit">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-blue-500" />
            <CardTitle className="text-lg">General Brand Visibility Strategy</CardTitle>
          </div>
          <Badge variant="secondary" className="bg-blue-100 text-blue-700">
            {generalOptimizations.length}
          </Badge>
        </div>
        <CardDescription>
          Comprehensive strategies to build overall brand authority and visibility across AI search results. Includes thought leadership, community engagement, and content marketing approaches.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {generalOptimizations.length === 0 ? (
          <div className="text-center py-8">
            <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              No general strategy optimizations found. Generate some using the button above.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {generalOptimizations.map((optimization) => (
              <EnhancedOptimizationCard 
                key={optimization.id} 
                optimization={optimization as any} 
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}