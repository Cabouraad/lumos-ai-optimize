import { useOrgOptimizations } from '@/features/optimizations/hooks';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EnhancedOptimizationCard } from './EnhancedOptimizationCard';
import { Loader2, TrendingUp } from 'lucide-react';

export function LowVisibilityOptimizationsCard() {
  const { data: optimizations = [], isLoading } = useOrgOptimizations();
  
  const lowVisibilityOptimizations = optimizations.filter(
    opt => opt.optimization_category === 'low_visibility'
  );

  if (isLoading) {
    return (
      <Card className="h-fit">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-amber-500" />
              <CardTitle className="text-lg">Low-Visibility Prompt Fixes</CardTitle>
            </div>
            <Badge variant="secondary" className="bg-amber-100 text-amber-700">
              <Loader2 className="h-3 w-3 animate-spin mr-1" />
              Loading
            </Badge>
          </div>
          <CardDescription>
            Targeted optimizations to improve visibility for prompts with less than 50% presence rate. Limited to 10 most impactful optimizations.
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
            <TrendingUp className="h-5 w-5 text-amber-500" />
            <CardTitle className="text-lg">Low-Visibility Prompt Fixes</CardTitle>
          </div>
          <Badge variant="secondary" className="bg-amber-100 text-amber-700">
            {lowVisibilityOptimizations.length}
          </Badge>
        </div>
        <CardDescription>
          Targeted optimizations to improve visibility for prompts with less than 50% presence rate. Limited to 10 most impactful optimizations.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {lowVisibilityOptimizations.length === 0 ? (
          <div className="text-center py-8">
            <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              No low-visibility optimizations found. Generate some using the button above.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {lowVisibilityOptimizations.map((optimization) => (
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