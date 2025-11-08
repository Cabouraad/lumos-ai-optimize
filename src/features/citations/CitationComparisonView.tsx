import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, FileText, Video } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface CitationComparisonViewProps {
  promptId: string;
}

interface CitationComparison {
  provider: string;
  response_id: string;
  run_at: string;
  citation_url: string;
  citation_domain: string;
  citation_title: string | null;
  from_provider: boolean;
  source_type: string;
}

export function CitationComparisonView({ promptId }: CitationComparisonViewProps) {
  const { data: citations, isLoading } = useQuery({
    queryKey: ['citation-comparison', promptId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_citation_comparison', {
        p_prompt_id: promptId,
      });

      if (error) throw error;
      return data as CitationComparison[];
    },
    enabled: !!promptId,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-96 mt-2" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!citations || citations.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Citation Comparison</CardTitle>
          <CardDescription>No citations found for this prompt</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // Group citations by URL
  const citationsByUrl = citations.reduce((acc, citation) => {
    if (!acc[citation.citation_url]) {
      acc[citation.citation_url] = {
        url: citation.citation_url,
        domain: citation.citation_domain,
        title: citation.citation_title,
        source_type: citation.source_type,
        providers: [],
      };
    }
    acc[citation.citation_url].providers.push({
      provider: citation.provider,
      from_provider: citation.from_provider,
      run_at: citation.run_at,
    });
    return acc;
  }, {} as Record<string, any>);

  const groupedCitations = Object.values(citationsByUrl);
  const providers = Array.from(new Set(citations.map(c => c.provider)));

  const getSourceIcon = (type: string) => {
    switch (type) {
      case 'pdf':
        return <FileText className="h-4 w-4" />;
      case 'video':
        return <Video className="h-4 w-4" />;
      default:
        return <ExternalLink className="h-4 w-4" />;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Citation Comparison</CardTitle>
        <CardDescription>
          Comparing how {providers.length} provider(s) cite sources for this prompt
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {groupedCitations.map((citation) => (
          <div
            key={citation.url}
            className="border border-border rounded-lg p-4 space-y-3 hover:bg-accent/5 transition-colors"
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5">{getSourceIcon(citation.source_type)}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm truncate">
                      {citation.title || 'Untitled'}
                    </h4>
                    <a
                      href={citation.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-muted-foreground hover:text-primary truncate block"
                    >
                      {citation.domain}
                    </a>
                  </div>
                  <Badge variant="outline" className="shrink-0">
                    {citation.source_type}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-2 mt-3">
                  {providers.map((provider) => {
                    const providerCitation = citation.providers.find(
                      (p: any) => p.provider === provider
                    );
                    return (
                      <Badge
                        key={provider}
                        variant={providerCitation ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {provider}
                        {providerCitation?.from_provider && ' ✓'}
                      </Badge>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
