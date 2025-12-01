import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, TrendingUp, FileText, Video, Award, Target, Info, ChevronDown, ChevronRight, Filter } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts';
import { format } from 'date-fns';
import { useState } from 'react';
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface TopCitedContentProps {
  days: number;
  brandId?: string | null;
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

interface DomainGroupProps {
  group: {
    domain: string;
    citations: CitationInsight[];
    totalMentions: number;
    avgVisibility: number;
    uniquePromptsCount: number;
  };
  getContentIcon: (type: string) => JSX.Element;
  getTrendData: (url: string) => any;
  CustomTooltip: React.ComponentType<any>;
}

function DomainGroup({ group, getContentIcon, getTrendData, CustomTooltip }: DomainGroupProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      className="border border-border rounded-lg"
    >
      <CollapsibleTrigger className="w-full p-4 hover:bg-accent/5 transition-colors">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="text-muted-foreground">
              {isOpen ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
            </div>
            <div className="flex-1 min-w-0 text-left">
              <h3 className="font-semibold text-lg mb-1">{group.domain}</h3>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <div>
                  <span className="font-semibold text-foreground">{group.citations.length}</span> URLs cited
                </div>
                <div>
                  <span className="font-semibold text-foreground">{group.totalMentions}</span> total citations
                </div>
                <div>
                  Avg visibility: <span className="font-semibold text-foreground">{group.avgVisibility.toFixed(1)}/10</span>
                </div>
                <div>
                  <span className="font-semibold text-foreground">{group.uniquePromptsCount}</span> prompts
                </div>
              </div>
            </div>
          </div>
        </div>
      </CollapsibleTrigger>
      
      <CollapsibleContent>
        <div className="border-t border-border">
          <div className="p-4 space-y-3">
            {group.citations.map((citation) => (
              <div
                key={citation.citation_url}
                className="pl-4 border-l-2 border-muted"
              >
                <div className="flex items-center gap-2 mb-2">
                  {getContentIcon(citation.content_type)}
                  <a
                    href={citation.citation_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm hover:text-primary truncate flex-1"
                  >
                    {citation.citation_url}
                  </a>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-6 text-xs text-muted-foreground">
                    <div>
                      <span>Cited </span>
                      <span className="font-semibold text-foreground">{citation.total_mentions}x</span>
                    </div>
                    <div>
                      <span>Visibility: </span>
                      <span className="font-semibold text-foreground">{Number(citation.avg_brand_visibility_score).toFixed(1)}/10</span>
                    </div>
                    <div>
                      <span>Prompts: </span>
                      <span className="font-semibold text-foreground">{citation.unique_prompts}</span>
                    </div>
                  </div>
                  {getTrendData(citation.citation_url) && (
                    <div className="w-24 h-12">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={getTrendData(citation.citation_url)!}>
                          <Tooltip content={<CustomTooltip />} />
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
            ))}
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function TopCitedContent({ days, brandId }: TopCitedContentProps) {
  const [topDomainsLimit, setTopDomainsLimit] = useState<string>('all');
  const [minCitations, setMinCitations] = useState<number>(0);

  const { data: citations, isLoading } = useQuery({
    queryKey: ['citation-performance', days, brandId ?? null],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_citation_performance_insights', {
        p_days: days,
        p_limit: 200,
        p_brand_id: brandId || null,
      });

      if (error) throw error;
      return data as CitationInsight[];
    },
  });

  const { data: trends } = useQuery({
    queryKey: ['citation-trends-detailed', days, brandId ?? null],
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
        p_limit: 200,
        p_brand_id: brandId || null,
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

  // Group competitor content by domain
  const groupedCompetitors = competitorContent.reduce((acc, citation) => {
    const domain = citation.citation_domain;
    if (!acc[domain]) {
      acc[domain] = {
        domain,
        citations: [],
        totalMentions: 0,
        avgVisibility: 0,
        uniquePrompts: new Set<number>(),
      };
    }
    acc[domain].citations.push(citation);
    acc[domain].totalMentions += citation.total_mentions;
    acc[domain].uniquePrompts.add(citation.unique_prompts);
    return acc;
  }, {} as Record<string, {
    domain: string;
    citations: CitationInsight[];
    totalMentions: number;
    avgVisibility: number;
    uniquePrompts: Set<number>;
  }>);

  // Calculate average visibility and sort by total mentions
  const groupedCompetitorArray = Object.values(groupedCompetitors).map(group => ({
    ...group,
    avgVisibility: group.citations.reduce((sum, c) => sum + Number(c.avg_brand_visibility_score), 0) / group.citations.length,
    uniquePromptsCount: Array.from(group.uniquePrompts).reduce((sum, count) => sum + count, 0),
  })).sort((a, b) => b.totalMentions - a.totalMentions);

  // Apply filters
  const filteredCompetitorArray = groupedCompetitorArray
    .filter(group => group.totalMentions >= minCitations)
    .slice(0, topDomainsLimit === 'all' ? undefined : parseInt(topDomainsLimit));

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
      date: trend.trend_data.dates[idx],
    }));
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;

    const data = payload[0].payload;
    return (
      <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
        <p className="text-xs font-medium mb-2">
          {format(new Date(data.date), 'MMM d, yyyy')}
        </p>
        <div className="space-y-1">
          <p className="text-xs">
            <span className="text-muted-foreground">Citations: </span>
            <span className="font-semibold">{data.value}</span>
          </p>
          <p className="text-xs">
            <span className="text-muted-foreground">Visibility: </span>
            <span className="font-semibold">{data.visibility}/10</span>
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
              Your Content Citations
              <TooltipProvider>
                <UITooltip>
                  <TooltipTrigger>
                    <Info className="h-4 w-4" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Number of unique URLs from your domain that AI models cite</p>
                  </TooltipContent>
                </UITooltip>
              </TooltipProvider>
            </CardTitle>
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
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
              Avg Brand Visibility
              <TooltipProvider>
                <UITooltip>
                  <TooltipTrigger>
                    <Info className="h-4 w-4" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-sm">
                    <p>How prominently your brand appears when cited. Higher scores (7-10) mean your brand is mentioned early and clearly. Target: 7+</p>
                  </TooltipContent>
                </UITooltip>
              </TooltipProvider>
            </CardTitle>
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
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
              Citation Opportunity
              <TooltipProvider>
                <UITooltip>
                  <TooltipTrigger>
                    <Info className="h-4 w-4" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-sm">
                    <p>Competitor pages getting citations that you could outrank with better content on similar topics</p>
                  </TooltipContent>
                </UITooltip>
              </TooltipProvider>
            </CardTitle>
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
                              <Tooltip content={<CustomTooltip />} />
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

      {/* Competitor Content to Target - Grouped by Domain */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Competitor Content to Outrank
              </CardTitle>
              <CardDescription>
                Competitor domains getting cited - grouped by domain with all cited URLs
              </CardDescription>
            </div>
          </div>
          
          {/* Filters */}
          <div className="flex items-end gap-4 mt-4 pt-4 border-t border-border">
            <div className="flex items-center gap-2 flex-1">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Filters:</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="top-domains" className="text-xs text-muted-foreground">
                  Show Domains
                </Label>
                <Select value={topDomainsLimit} onValueChange={setTopDomainsLimit}>
                  <SelectTrigger id="top-domains" className="w-[140px] h-9">
                    <SelectValue placeholder="All domains" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Domains</SelectItem>
                    <SelectItem value="5">Top 5</SelectItem>
                    <SelectItem value="10">Top 10</SelectItem>
                    <SelectItem value="20">Top 20</SelectItem>
                    <SelectItem value="50">Top 50</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-1.5">
                <Label htmlFor="min-citations" className="text-xs text-muted-foreground">
                  Min Citations
                </Label>
                <Input
                  id="min-citations"
                  type="number"
                  min="0"
                  value={minCitations}
                  onChange={(e) => setMinCitations(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-[120px] h-9"
                  placeholder="0"
                />
              </div>
            </div>
          </div>
          
          {/* Results count */}
          <div className="mt-3 text-sm text-muted-foreground">
            Showing {filteredCompetitorArray.length} of {groupedCompetitorArray.length} domains
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {filteredCompetitorArray.length > 0 ? (
            filteredCompetitorArray.map((group) => (
              <DomainGroup
                key={group.domain}
                group={group}
                getContentIcon={getContentIcon}
                getTrendData={getTrendData}
                CustomTooltip={CustomTooltip}
              />
            ))
          ) : (
            <Alert>
              <AlertDescription>
                No domains match the current filters. Try adjusting your filter criteria.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
