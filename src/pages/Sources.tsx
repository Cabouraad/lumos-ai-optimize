import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Calendar } from 'lucide-react';
import { useAllAISources } from '@/hooks/useAISources';
import { useAuth } from '@/contexts/AuthContext';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';

export default function Sources() {
  const { orgData } = useAuth();
  const { data: sources, isLoading } = useAllAISources(orgData?.organizations?.id);

  if (isLoading) {
    return (
      <Layout>
        <div className="container mx-auto p-6 space-y-6">
          <div className="space-y-2">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-6 w-96" />
          </div>
          <Card>
            <CardContent className="p-6">
              <div className="space-y-4">
                {[...Array(10)].map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
        <div className="container mx-auto p-6 space-y-6">
          {/* Header */}
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-8 w-8 text-primary" />
              <h1 className="text-4xl font-bold text-foreground">AI Source Intelligence</h1>
            </div>
            <p className="text-muted-foreground">
              Comprehensive view of all domains cited by AI models when answering your prompts
            </p>
          </div>

          {/* Stats Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="bg-card/80 backdrop-blur-sm border shadow-soft">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Unique Sources
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{sources?.length || 0}</div>
              </CardContent>
            </Card>
            <Card className="bg-card/80 backdrop-blur-sm border shadow-soft">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Citations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {sources?.reduce((acc, s) => acc + s.total_citations, 0) || 0}
                </div>
              </CardContent>
            </Card>
            <Card className="bg-card/80 backdrop-blur-sm border shadow-soft">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Active Models
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {sources ? new Set(sources.flatMap(s => s.models)).size : 0}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sources Table */}
          <Card className="bg-card/80 backdrop-blur-sm border shadow-soft">
            <CardHeader>
              <CardTitle>All Citation Sources</CardTitle>
            </CardHeader>
            <CardContent>
              {!sources || sources.length === 0 ? (
                <div className="text-center py-12">
                  <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    No citation sources yet. Run some prompts to see which domains AI models cite.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {sources.map((source, index) => (
                    <div 
                      key={source.domain}
                      className="p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-medium text-muted-foreground">
                              #{index + 1}
                            </span>
                            <h3 className="text-lg font-semibold">{source.domain}</h3>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              <span>Last cited: {format(new Date(source.last_cited), 'MMM dd, yyyy')}</span>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {source.models.map(model => (
                              <Badge key={model} variant="outline" className="text-xs">
                                {model}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <div className="text-right space-y-1">
                          <Badge className="text-sm">
                            {source.total_citations} citations
                          </Badge>
                          <p className="text-xs text-muted-foreground">
                            {source.model_count} {source.model_count === 1 ? 'model' : 'models'}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
