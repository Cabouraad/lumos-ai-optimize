import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ExternalLink, TrendingUp, TrendingDown, Minus, Award, Target } from 'lucide-react';

interface CompetitiveCitationInsightsProps {
  days: number;
  brandId?: string | null;
}

interface CompetitiveData {
  domain: string;
  domain_type: string;
  total_citations: number;
  content_types: Record<string, number>;
  avg_impact_score: number;
  citation_trend: string;
  top_cited_pages: Array<{ url: string; title: string }>;
}

export function CompetitiveCitationInsights({ days, brandId }: CompetitiveCitationInsightsProps) {
  const { data: competitiveData, isLoading } = useQuery({
    queryKey: ['citation-competitive-insights', days, brandId ?? null],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_citation_competitive_insights', {
        p_days: days,
        p_brand_id: brandId || null,
      });

      if (error) throw error;
      return data as CompetitiveData[];
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-40 w-full" />
        ))}
      </div>
    );
  }

  if (!competitiveData || competitiveData.length === 0) {
    return (
      <Alert>
        <AlertDescription>
          No competitive citation data available for the selected time period.
        </AlertDescription>
      </Alert>
    );
  }

  const yourContent = competitiveData.filter(d => d.domain_type === 'Your Content');
  const competitors = competitiveData.filter(d => d.domain_type === 'Competitor');
  const thirdParty = competitiveData.filter(d => d.domain_type === 'Third Party');

  const topCompetitor = competitors[0];

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'Growing':
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'Declining':
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      default:
        return <Minus className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getDomainTypeBadge = (type: string) => {
    switch (type) {
      case 'Your Content':
        return <Badge variant="default">Your Domain</Badge>;
      case 'Competitor':
        return <Badge variant="destructive">Competitor</Badge>;
      default:
        return <Badge variant="secondary">Third Party</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Strategic Insights */}
      {topCompetitor && (
        <Alert>
          <Target className="h-4 w-4" />
          <AlertTitle>Competitive Intelligence</AlertTitle>
          <AlertDescription>
            <strong>{topCompetitor.domain}</strong> is your top competitor with {topCompetitor.total_citations} citations
            and an average impact score of {Number(topCompetitor.avg_impact_score).toFixed(1)}/10.
            Their most cited content types are:{' '}
            {Object.entries(topCompetitor.content_types)
              .sort(([, a], [, b]) => (b as number) - (a as number))
              .slice(0, 2)
              .map(([type]) => type)
              .join(', ')}.
          </AlertDescription>
        </Alert>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Your Domain Citations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {yourContent.reduce((sum, d) => sum + Number(d.total_citations), 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              across {yourContent.length} domains
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Competitor Citations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {competitors.reduce((sum, d) => sum + Number(d.total_citations), 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              across {competitors.length} competitors
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Market Share</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {competitiveData.length > 0
                ? ((yourContent.reduce((sum, d) => sum + Number(d.total_citations), 0) /
                    competitiveData.reduce((sum, d) => sum + Number(d.total_citations), 0)) * 100).toFixed(1)
                : 0}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              of total citations
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Your Domain Performance */}
      {yourContent.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5 text-primary" />
              Your Domain Performance
            </CardTitle>
            <CardDescription>
              How your content is performing across different domains and subdomains
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {yourContent.map((domain) => (
              <div
                key={domain.domain}
                className="border border-primary/20 bg-primary/5 rounded-lg p-4"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{domain.domain}</h3>
                    {getDomainTypeBadge(domain.domain_type)}
                  </div>
                  <div className="flex items-center gap-2">
                    {getTrendIcon(domain.citation_trend)}
                    <span className="text-sm text-muted-foreground">{domain.citation_trend}</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-3">
                  <div>
                    <div className="text-xs text-muted-foreground">Total Citations</div>
                    <div className="text-lg font-bold">{domain.total_citations}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Avg Impact Score</div>
                    <div className="text-lg font-bold">{Number(domain.avg_impact_score).toFixed(1)}/10</div>
                  </div>
                </div>
                {domain.top_cited_pages && domain.top_cited_pages.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <div className="text-xs text-muted-foreground mb-2">Top Cited Pages:</div>
                    <div className="space-y-1">
                      {domain.top_cited_pages.slice(0, 3).map((page, idx) => (
                        <a
                          key={idx}
                          href={page.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline flex items-center gap-1 truncate"
                        >
                          <ExternalLink className="h-3 w-3 shrink-0" />
                          {page.title || page.url}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Competitor Analysis */}
      {competitors.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Competitive Landscape
            </CardTitle>
            <CardDescription>
              Competitor domains getting cited - analyze their content strategy
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {competitors.slice(0, 10).map((domain, idx) => (
              <div
                key={domain.domain}
                className="border border-border rounded-lg p-4 hover:bg-accent/5 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{domain.domain}</h3>
                    {getDomainTypeBadge(domain.domain_type)}
                  </div>
                  <div className="flex items-center gap-2">
                    {getTrendIcon(domain.citation_trend)}
                    <span className="text-sm text-muted-foreground">{domain.citation_trend}</span>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4 mb-3">
                  <div>
                    <div className="text-xs text-muted-foreground">Citations</div>
                    <div className="font-semibold">{domain.total_citations}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Impact Score</div>
                    <div className="font-semibold">{Number(domain.avg_impact_score).toFixed(1)}/10</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Content Types</div>
                    <div className="font-semibold">{Object.keys(domain.content_types).length}</div>
                  </div>
                </div>
                {domain.top_cited_pages && domain.top_cited_pages.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <div className="text-xs text-muted-foreground mb-2">Their Top Pages:</div>
                    <div className="space-y-1">
                      {domain.top_cited_pages.slice(0, 2).map((page, idx) => (
                        <a
                          key={idx}
                          href={page.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline flex items-center gap-1 truncate"
                        >
                          <ExternalLink className="h-3 w-3 shrink-0" />
                          {page.title || page.url}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Third Party Authority Sites */}
      {thirdParty.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Authority Sites & Industry Resources</CardTitle>
            <CardDescription>
              Third-party sites AI models trust - consider partnerships or content placement
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {thirdParty.slice(0, 8).map((domain) => (
              <div
                key={domain.domain}
                className="border border-border rounded-lg p-3 hover:bg-accent/5 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <h4 className="font-medium text-sm truncate">{domain.domain}</h4>
                    {getDomainTypeBadge(domain.domain_type)}
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    <div>
                      <span className="text-muted-foreground">Citations: </span>
                      <span className="font-semibold">{domain.total_citations}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Score: </span>
                      <span className="font-semibold">{Number(domain.avg_impact_score).toFixed(1)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
