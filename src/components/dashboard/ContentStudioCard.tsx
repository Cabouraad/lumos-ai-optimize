import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { PenTool, FileText, ArrowRight, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { listContentStudioItems } from '@/features/content-studio/api';

interface ContentStudioCardProps {
  brandId?: string | null;
}

export function ContentStudioCard({ brandId }: ContentStudioCardProps) {
  const navigate = useNavigate();
  
  const { data: items, isLoading } = useQuery({
    queryKey: ['content-studio-items-dashboard', brandId],
    queryFn: () => listContentStudioItems(5, brandId),
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PenTool className="h-5 w-5" />
            Content Studio
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </CardContent>
      </Card>
    );
  }

  const drafts = items?.filter(item => item.status === 'draft') || [];
  const inProgress = items?.filter(item => item.status === 'in_progress') || [];
  const completed = items?.filter(item => item.status === 'completed') || [];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-muted text-muted-foreground';
      case 'in_progress': return 'bg-amber-500/20 text-amber-500';
      case 'completed': return 'bg-green-500/20 text-green-500';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <PenTool className="h-5 w-5 text-primary" />
            Content Studio
          </CardTitle>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate('/content-studio')}
            className="text-primary hover:text-primary/80"
          >
            View All
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-2 rounded-lg bg-muted/50">
            <div className="text-2xl font-bold">{drafts.length}</div>
            <div className="text-xs text-muted-foreground">Drafts</div>
          </div>
          <div className="text-center p-2 rounded-lg bg-amber-500/10">
            <div className="text-2xl font-bold text-amber-500">{inProgress.length}</div>
            <div className="text-xs text-muted-foreground">In Progress</div>
          </div>
          <div className="text-center p-2 rounded-lg bg-green-500/10">
            <div className="text-2xl font-bold text-green-500">{completed.length}</div>
            <div className="text-xs text-muted-foreground">Completed</div>
          </div>
        </div>

        {/* Recent Items */}
        {items && items.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground font-medium">Recent Blueprints</p>
            {items.slice(0, 3).map((item) => (
              <div 
                key={item.id} 
                className="flex items-center gap-3 p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer"
                onClick={() => navigate('/content-studio')}
              >
                <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm truncate flex-1">{item.topic_key}</span>
                <Badge variant="secondary" className={`text-xs ${getStatusColor(item.status)}`}>
                  {item.status.replace('_', ' ')}
                </Badge>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-4">
            <Sparkles className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground mb-3">
              Create AI-optimized content from your visibility insights
            </p>
            <Button 
              size="sm" 
              onClick={() => navigate('/optimizations')}
              className="gap-2"
            >
              <PenTool className="h-4 w-4" />
              Start Creating
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
