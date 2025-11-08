import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, TrendingUp, FileText, Video, Award, Target } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LineChart, Line, ResponsiveContainer } from 'recharts';

interface TopCitedContentProps {
  days: number;
}

interface CitationInsight {
  citation_url: string;
  citation_domain: string;
  citation_title: string;
  content_type: string;
  total_mentions: number;
  unique_prompts: number;
  avg_brand_visibility_score: number;
  brand_present_rate: number;
  is_own_domain: boolean;
  providers: string[];
}

interface CitationTrend {
  citation_url: string;
  trend_data: {
    dates: string[];
    citation_counts: number[];
    visibility_scores: number[];
  };
}

export function TopCitedContent({ days }: TopCitedContentProps) {
  const { data: citations, isLoading } = useQuery({
    queryKey: ['citation-performance', days],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_citation_performance_insights', {
        p_days: days,
        p_limit: 20,
      });

      if (error) throw error;
      return data as CitationInsight[];
    },
  });

  const { data: trends } = useQuery({
    queryKey: ['citation-trends', days],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: userData } = await supabase
        .from('users')
        .select('org_id')
        .eq('id', user.id)
        .single();

      if (!userData?.org_id) throw new Error('No organization found');

      const { data, error } = await supabase.rpc('get_citation_trends', {
        p_org_id: userData.org_id,
        p_days: days,
        p_limit: 20,
      });

      if (error) throw error;
      return data as CitationTrend[];
    },
    enabled: !!citations,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  if (!citations || citations.length === 0) {
    return (
      <Alert>
        <AlertDescription>
          No citation data available for the selected time period. Run more prompts to see which content gets cited.
        </AlertDescription>
      </Alert>
    );
  }

  const ownContent = citations.filter(c => c.is_own_domain);
  const competitorContent = citations.filter(c => !c.is_own_domain);

  const getContentIcon = (type: string) => {
    switch (type) {
      case 'video':
        return <Video className="h-4 w-4" />;
      case 'pdf':
        return <FileText className="h-4 w-4" />;
      default:
        return <ExternalLink className="h-4 w-4" />;
    }
  };

  const getInsightBadge = (citation: CitationInsight) => {
    if (citation.brand_present_rate >= 80) {
      return <Badge variant="default" className="gap-1"><Award className="h-3 w-3" /> High Impact</Badge>;
    }
    if (citation.total_mentions >= 5) {
      return <Badge variant="secondary" className="gap-1"><TrendingUp className="h-3 w-3" /> Frequently Cited</Badge>;
    }
    return null;
  };

  const getTrendData = (url: string) => {
    const trend = trends?.find(t => t.citation_url === url);
    if (!trend?.trend_data) return null;

    return trend.trend_data.citation_counts.map((count, idx) => ({
      value: count,
      visibility: trend.trend_data.visibility_scores[idx],
    }));
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Your Content Citations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{ownContent.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              of {citations.length} top citations
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg Brand Visibility</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {ownContent.length > 0
                ? (ownContent.reduce((sum, c) => sum + Number(c.avg_brand_visibility_score), 0) / ownContent.length).toFixed(1)
                : '0'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              when your content is cited
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Citation Opportunity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{competitorContent.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              competitor pages to outrank
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Your Top Performing Content */}
      {ownContent.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5 text-primary" />
              Your Top Performing Content
            </CardTitle>
            <CardDescription>
              Your content that AI models cite most frequently - double down on these content strategies
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {ownContent.map((citation, idx) => (
              <div
                key={citation.citation_url}
                className="border border-border rounded-lg p-4 hover:bg-accent/5 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {getContentIcon(citation.content_type)}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-base truncate">
                            {citation.citation_title || citation.citation_domain}
                          </h3>
                          <Badge variant="outline" className="mt-1">{citation.citation_domain}</Badge>
                        </div>
                      </div>
                      {getInsightBadge(citation)}
                    </div>
                    <a
                      href={citation.citation_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-muted-foreground hover:text-primary truncate block mb-2"
                    >
                      {citation.citation_url}
                    </a>
                    <div className="flex items-start gap-4 mt-3">
                      <div className="grid grid-cols-3 gap-4 flex-1 text-sm">
                        <div>
                          <div className="text-muted-foreground text-xs">Citations</div>
                          <div className="font-semibold">{citation.total_mentions}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground text-xs">Visibility Score</div>
                          <div className="font-semibold">{Number(citation.avg_brand_visibility_score).toFixed(1)}/10</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground text-xs">Brand Mention Rate</div>
                          <div className="font-semibold">{Number(citation.brand_present_rate).toFixed(0)}%</div>
                        </div>
                      </div>
                      {getTrendData(citation.citation_url) && (
                        <div className="w-24 h-12">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={getTrendData(citation.citation_url)!}>
                              <Line
                                type="monotone"
                                dataKey="value"
                                stroke="hsl(var(--primary))"
                                strokeWidth={2}
                                dot={false}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Competitor Content to Target */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Competitor Content to Outrank
          </CardTitle>
          <CardDescription>
            These competitor pages are getting cited - create better content on these topics
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {competitorContent.slice(0, 10).map((citation, idx) => (
            <div
              key={citation.citation_url}
              className="border border-border rounded-lg p-4 hover:bg-accent/5 transition-colors"
            >
              <div className="flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {getContentIcon(citation.content_type)}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-base truncate">
                          {citation.citation_title || citation.citation_domain}
                        </h3>
                        <Badge variant="outline" className="mt-1">{citation.citation_domain}</Badge>
                      </div>
                    </div>
                  </div>
                  <a
                    href={citation.citation_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-muted-foreground hover:text-primary truncate block mb-2"
                  >
                    {citation.citation_url}
                  </a>
                  <div className="flex items-center justify-between mt-3">
                    <div className="flex items-center gap-6 text-xs">
                      <div>
                        <span className="text-muted-foreground">Cited </span>
                        <span className="font-semibold">{citation.total_mentions}x</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Visibility Score: </span>
                        <span className="font-semibold">{Number(citation.avg_brand_visibility_score).toFixed(1)}/10</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Across </span>
                        <span className="font-semibold">{citation.unique_prompts} prompts</span>
                      </div>
                    </div>
                    {getTrendData(citation.citation_url) && (
                      <div className="w-24 h-12">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={getTrendData(citation.citation_url)!}>
                            <Line
                              type="monotone"
                              dataKey="value"
                              stroke="hsl(var(--muted-foreground))"
                              strokeWidth={2}
                              dot={false}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
