import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, TrendingUp } from 'lucide-react';
import { useTopAISources } from '@/hooks/useAISources';
import { Skeleton } from '@/components/ui/skeleton';
import { useNavigate } from 'react-router-dom';

interface AISourceIntelligenceProps {
  orgId: string | undefined;
}

export function AISourceIntelligence({ orgId }: AISourceIntelligenceProps) {
  const { data: sources, isLoading } = useTopAISources(orgId, 5);
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <Card className="bg-card/80 backdrop-blur-sm border shadow-soft">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!sources || sources.length === 0) {
    return (
      <Card className="bg-card/80 backdrop-blur-sm border shadow-soft">
        <CardHeader>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            <CardTitle>AI Source Intelligence</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground">
              No citation data available yet. Sources will appear here once your prompts start getting cited by AI models.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const maxCitations = Math.max(...sources.map(s => s.total_citations), 1);

  return (
    <Card className="bg-card/80 backdrop-blur-sm border shadow-soft">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
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
          <ExternalLink className="h-4 w-4 mr-1" />
          View all
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Top 5 domains cited by AI models
          </p>
          <div className="space-y-3">
            {sources.map((source, index) => (
              <div key={source.domain} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-xs font-medium text-muted-foreground">
                      #{index + 1}
                    </span>
                    <span className="text-sm font-medium truncate">
                      {source.domain}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      {source.total_citations} citations
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {source.model_count} {source.model_count === 1 ? 'model' : 'models'}
                    </Badge>
                  </div>
                </div>
                <div className="relative h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="absolute h-full bg-primary rounded-full transition-all"
                    style={{ 
                      width: `${(source.total_citations / maxCitations) * 100}%` 
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
