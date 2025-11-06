import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface DomainStats {
  domain: string;
  total_citations: number;
  percentage: number;
}

interface MostCitedDomainsProps {
  orgId?: string;
  brandId?: string | null;
}

export function MostCitedDomains({ orgId, brandId }: MostCitedDomainsProps) {
  const [domains, setDomains] = useState<DomainStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCitations, setTotalCitations] = useState(0);

  useEffect(() => {
    if (!orgId) {
      setDomains([]);
      setLoading(false);
      return;
    }
    loadMostCitedDomains();
  }, [orgId, brandId]);

  const loadMostCitedDomains = async () => {
    try {
      setLoading(true);

      // Use ai_sources_top_domains view for efficient domain aggregation
      let query = supabase
        .from('ai_sources_top_domains')
        .select('domain, total_citations, brand_id')
        .eq('org_id', orgId)
        .order('total_citations', { ascending: false })
        .limit(8);

      // Filter by brand if specified
      if (brandId) {
        query = query.or(`brand_id.eq.${brandId},brand_id.is.null`);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error loading cited domains:', error);
        return;
      }

      if (!data || data.length === 0) {
        setDomains([]);
        setTotalCitations(0);
        return;
      }

      // Calculate total and percentages
      const total = data.reduce((sum, item) => sum + (item.total_citations || 0), 0);
      const domainStats: DomainStats[] = data.map(item => ({
        domain: item.domain,
        total_citations: item.total_citations || 0,
        percentage: total > 0 ? ((item.total_citations || 0) / total) * 100 : 0
      }));

      setDomains(domainStats);
      setTotalCitations(total);
    } catch (error) {
      console.error('Error in loadMostCitedDomains:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Most Cited Domains</CardTitle>
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

  if (domains.length === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Most Cited Domains</CardTitle>
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
          <CardTitle>Most Cited Domains</CardTitle>
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
          {domains.map((domain, index) => (
            <div key={domain.domain} className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className="text-muted-foreground font-medium">
                    #{index + 1}
                  </span>
                  <a
                    href={`https://${domain.domain}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium hover:underline truncate flex items-center gap-1 group"
                  >
                    {domain.domain}
                    <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                  </a>
                </div>
                <span className="text-muted-foreground font-mono flex-shrink-0 ml-2">
                  {domain.total_citations} ({domain.percentage.toFixed(1)}%)
                </span>
              </div>
              <Progress value={domain.percentage} className="h-2" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
