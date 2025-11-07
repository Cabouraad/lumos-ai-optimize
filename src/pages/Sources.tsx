import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, ExternalLink } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useAISourceIntelligence } from '@/hooks/useAISourceIntelligence';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { useBrand } from '@/contexts/BrandContext';
import { BrandFilterIndicator } from '@/components/dashboard/BrandFilterIndicator';

export default function Sources() {
  const { orgData } = useAuth();
  const { selectedBrand } = useBrand();
  const { data: sources, isLoading } = useAISourceIntelligence(
    orgData?.organizations?.id, 
    50, 
    selectedBrand?.id || null
  );

  const maxCitations = sources ? Math.max(...sources.map(s => s.total_citations)) : 0;

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
        <div className="container mx-auto p-6 space-y-8">
          {/* Brand Filter Indicator */}
          <BrandFilterIndicator />
          
          {/* Header */}
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-8 w-8 text-primary" />
              <h1 className="text-4xl font-bold text-foreground">AI Source Intelligence</h1>
            </div>
            <p className="text-muted-foreground">
              Track which sources AI models cite when mentioning your brand
            </p>
          </div>

          {/* Sources Table */}
          <Card className="bg-card/80 backdrop-blur-sm border shadow-soft">
            <CardHeader>
              <CardTitle>All Citation Sources (Last 30 Days)</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : !sources || sources.length === 0 ? (
                <div className="text-center py-12">
                  <ExternalLink className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <p className="text-lg font-medium mb-2">No Citation Data Available</p>
                  <p className="text-muted-foreground">
                    Sources will appear here once AI responses include citations
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {sources.map((source, index) => {
                    const barWidth = (source.total_citations / maxCitations) * 100;
                    
                    return (
                      <div 
                        key={source.domain} 
                        className="p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                      >
                        <div className="space-y-3">
                          {/* Header Row */}
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <span className="text-lg font-bold text-muted-foreground">
                                #{index + 1}
                              </span>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <a
                                    href={`https://${source.domain}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-lg font-semibold hover:text-primary transition-colors truncate"
                                  >
                                    {source.domain}
                                  </a>
                                  <ExternalLink className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  Last cited: {format(new Date(source.last_cited), 'MMM d, yyyy')}
                                </p>
                              </div>
                            </div>
                            
                            {/* Stats */}
                            <div className="flex items-center gap-3 flex-shrink-0">
                              <Badge variant="default" className="text-sm font-semibold">
                                {source.total_citations} citations
                              </Badge>
                            </div>
                          </div>

                          {/* Citation Bar */}
                          <div className="relative h-3 bg-muted rounded-full overflow-hidden">
                            <div 
                              className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary to-primary/70 rounded-full transition-all duration-500"
                              style={{ width: `${barWidth}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
