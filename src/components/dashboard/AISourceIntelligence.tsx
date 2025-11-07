import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, TrendingUp } from 'lucide-react';
import { useAISourceIntelligence } from '@/hooks/useAISourceIntelligence';
import { Skeleton } from '@/components/ui/skeleton';
import { useNavigate } from 'react-router-dom';

interface AISourceIntelligenceProps {
  orgId: string | undefined;
}

export function AISourceIntelligence({ orgId }: AISourceIntelligenceProps) {
  const navigate = useNavigate();
  const { data: sources, isLoading } = useAISourceIntelligence(orgId, 5);

  if (isLoading) {
    return (
      <Card className="bg-card/80 backdrop-blur-sm border shadow-soft">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!sources || sources.length === 0) {
    return (
      <Card className="bg-card/80 backdrop-blur-sm border shadow-soft">
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            <CardTitle>AI Source Intelligence</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <ExternalLink className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No citation data available yet</p>
            <p className="text-xs text-muted-foreground mt-2">
              Sources will appear here once AI responses include citations
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const maxCitations = Math.max(...sources.map(s => s.total_citations));

  return (
    <Card className="bg-card/80 backdrop-blur-sm border shadow-soft">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          <CardTitle>AI Source Intelligence</CardTitle>
        </div>
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => navigate('/sources')}
          className="hover-lift"
        >
          View All
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {sources.map((source, index) => {
          const barWidth = (source.total_citations / maxCitations) * 100;
          
          return (
            <div key={source.domain} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground w-4">
                    #{index + 1}
                  </span>
                  <span className="text-sm font-medium truncate max-w-[200px]">
                    {source.domain}
                  </span>
                  <Badge variant="secondary" className="text-xs">
                    {source.total_citations} citations
                  </Badge>
                </div>
              </div>
              <div className="relative h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary to-primary/70 rounded-full transition-all duration-500"
                  style={{ width: `${barWidth}%` }}
                />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
