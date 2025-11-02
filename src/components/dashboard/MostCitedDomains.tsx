import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, TrendingUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';

interface DomainStats {
  domain: string;
  count: number;
  percentage: number;
}

interface MostCitedDomainsProps {
  orgId?: string;
}

export function MostCitedDomains({ orgId }: MostCitedDomainsProps) {
  const [domains, setDomains] = useState<DomainStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCitations, setTotalCitations] = useState(0);

  useEffect(() => {
    if (!orgId) return;
    loadMostCitedDomains();
  }, [orgId]);

  const extractDomain = (url: string): string | null => {
    try {
      const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
      return urlObj.hostname.replace(/^www\./, '');
    } catch {
      return null;
    }
  };

  const loadMostCitedDomains = async () => {
    try {
      setLoading(true);

      // Get last 30 days of responses with citations
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data, error } = await supabase
        .from('prompt_provider_responses')
        .select('citations_json')
        .eq('org_id', orgId)
        .eq('status', 'success')
        .not('citations_json', 'is', null)
        .gte('run_at', thirtyDaysAgo.toISOString())
        .order('run_at', { ascending: false })
        .limit(1000);

      if (error) {
        console.error('Error loading citations:', error);
        return;
      }

      // Aggregate domains from citations
      const domainMap = new Map<string, number>();
      let totalCount = 0;

      data?.forEach((response) => {
        const citations = response.citations_json;
        if (!citations) return;

        const citationArray = Array.isArray(citations) ? citations : [citations];
        
        citationArray.forEach((citation: any) => {
          let url: string | null = null;
          
          // Handle different citation formats
          if (typeof citation === 'string') {
            url = citation;
          } else if (citation && typeof citation === 'object') {
            url = citation.url || citation.link || citation.source || citation.domain;
          }

          if (url) {
            const domain = extractDomain(url);
            if (domain && domain.length > 3 && !domain.includes('localhost')) {
              domainMap.set(domain, (domainMap.get(domain) || 0) + 1);
              totalCount++;
            }
          }
        });
      });

      // Sort by count and get top 8
      const sortedDomains = Array.from(domainMap.entries())
        .map(([domain, count]) => ({
          domain,
          count,
          percentage: (count / totalCount) * 100
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8);

      setDomains(sortedDomains);
      setTotalCitations(totalCount);
    } catch (error) {
      console.error('Error processing citations:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="bg-card/80 backdrop-blur-sm border shadow-soft">
        <CardHeader>
          <div className="flex items-center space-x-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            <CardTitle>Most Cited Domains</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center justify-between">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-6 w-12" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (domains.length === 0) {
    return (
      <Card className="bg-card/80 backdrop-blur-sm border shadow-soft">
        <CardHeader>
          <div className="flex items-center space-x-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            <CardTitle>Most Cited Domains</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-muted-foreground">
            <ExternalLink className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No citation data available yet</p>
            <p className="text-xs mt-1">Citations will appear as AI responses include sources</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card/80 backdrop-blur-sm border shadow-soft">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div className="flex items-center space-x-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          <CardTitle>Most Cited Domains</CardTitle>
        </div>
        <Badge variant="secondary" className="text-xs">
          Last 30 days
        </Badge>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="text-xs text-muted-foreground mb-4">
          {totalCitations} total citations across all AI responses
        </div>
        
        <div className="space-y-3">
          {domains.map((domain, index) => (
            <div key={domain.domain} className="group">
              <div className="flex items-center justify-between mb-1">
                <a
                  href={`https://${domain.domain}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm font-medium hover:text-primary transition-colors"
                >
                  <span className="text-muted-foreground text-xs w-4">#{index + 1}</span>
                  <span className="truncate max-w-[200px]">{domain.domain}</span>
                  <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </a>
                <Badge variant="outline" className="text-xs">
                  {domain.count} {domain.count === 1 ? 'citation' : 'citations'}
                </Badge>
              </div>
              <div className="w-full bg-muted/30 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-primary h-full transition-all duration-500"
                  style={{ width: `${Math.min(domain.percentage, 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
