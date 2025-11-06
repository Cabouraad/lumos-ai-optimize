import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface PageStats {
  url: string;
  title: string;
  domain: string;
  total_citations: number;
  percentage: number;
}

interface MostCitedDomainsProps {
  orgId?: string;
  brandId?: string | null;
}

export function MostCitedDomains({ orgId, brandId }: MostCitedDomainsProps) {
  const [pages, setPages] = useState<PageStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCitations, setTotalCitations] = useState(0);

  useEffect(() => {
    if (!orgId) {
      setPages([]);
      setLoading(false);
      return;
    }
    loadMostCitedPages();
  }, [orgId, brandId]);

  const loadMostCitedPages = async () => {
    try {
      setLoading(true);

      // Query citations from prompt_provider_responses
      let query = supabase
        .from('prompt_provider_responses')
        .select('citations_json, brand_id')
        .eq('org_id', orgId)
        .gte('run_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .not('citations_json', 'is', null);

      // Filter by brand if specified
      if (brandId && brandId !== 'null') {
        query = query.or(`brand_id.eq.${brandId},brand_id.is.null`);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error loading cited pages:', error);
        return;
      }

      if (!data || data.length === 0) {
        setPages([]);
        setTotalCitations(0);
        return;
      }

      // Extract and count citations
      const citationCounts = new Map<string, { url: string; title: string; domain: string; count: number }>();
      
      data.forEach(response => {
        const citationsData = response.citations_json as any;
        const citations = citationsData?.citations || [];
        citations.forEach((citation: any) => {
          const url = citation.url;
          if (!url) return;
          
          const existing = citationCounts.get(url);
          if (existing) {
            existing.count++;
          } else {
            citationCounts.set(url, {
              url,
              title: citation.title || url,
              domain: citation.domain || new URL(url).hostname,
              count: 1
            });
          }
        });
      });

      // Convert to array and sort by count
      const sortedPages = Array.from(citationCounts.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 8);

      const total = sortedPages.reduce((sum, page) => sum + page.count, 0);
      const pageStats: PageStats[] = sortedPages.map(page => ({
        url: page.url,
        title: page.title,
        domain: page.domain,
        total_citations: page.count,
        percentage: total > 0 ? (page.count / total) * 100 : 0
      }));

      setPages(pageStats);
      setTotalCitations(total);
    } catch (error) {
      console.error('Error in loadMostCitedPages:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Most Cited Pages</CardTitle>
            <Badge variant="outline" className="text-xs">
              Last 30 days
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="space-y-2">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-16" />
                </div>
                <Skeleton className="h-2 w-full" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (pages.length === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Most Cited Pages</CardTitle>
            <Badge variant="outline" className="text-xs">
              Last 30 days
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No citation data available yet. Citations will appear here after responses are generated.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Most Cited Pages</CardTitle>
          <Badge variant="outline" className="text-xs">
            Last 30 days
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <p className="text-2xl font-bold">{totalCitations}</p>
          <p className="text-sm text-muted-foreground">Total Citations</p>
        </div>
        <div className="space-y-4">
          {pages.map((page, index) => (
            <div key={page.url} className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className="text-muted-foreground font-medium">
                    #{index + 1}
                  </span>
                  <a
                    href={page.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium hover:underline truncate flex items-center gap-1 group"
                    title={page.url}
                  >
                    <span className="truncate">{page.url}</span>
                    <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                  </a>
                </div>
                <span className="text-muted-foreground font-mono flex-shrink-0 ml-2">
                  {page.total_citations} ({page.percentage.toFixed(1)}%)
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="truncate">{page.domain}</span>
              </div>
              <Progress value={page.percentage} className="h-2" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
