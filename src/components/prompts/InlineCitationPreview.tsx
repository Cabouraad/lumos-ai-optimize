import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface Citation {
  url: string;
  title?: string;
  domain?: string;
}

interface InlineCitationPreviewProps {
  promptId: string;
  limit?: number;
}

export function InlineCitationPreview({ promptId, limit = 2 }: InlineCitationPreviewProps) {
  const [citations, setCitations] = useState<Citation[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const fetchCitations = async () => {
      try {
        const { data: responses } = await supabase
          .from('prompt_provider_responses')
          .select('citations_json')
          .eq('prompt_id', promptId)
          .not('citations_json', 'is', null)
          .order('run_at', { ascending: false })
          .limit(10);

        if (!cancelled && responses) {
          const citationMap = new Map<string, Citation>();

          responses.forEach((response) => {
            try {
              const citationsData = response.citations_json as any;
              let citations: Citation[] = [];
              
              if (Array.isArray(citationsData)) {
                citations = citationsData;
              } else if (citationsData?.citations && Array.isArray(citationsData.citations)) {
                citations = citationsData.citations;
              }

              citations.forEach((citation: any) => {
                if (citation.url && !citationMap.has(citation.url)) {
                  citationMap.set(citation.url, {
                    url: citation.url,
                    title: citation.title,
                    domain: citation.domain || new URL(citation.url).hostname
                  });
                }
              });
            } catch (error) {
              // Skip invalid citations
            }
          });

          const allCitations = Array.from(citationMap.values());
          setTotalCount(allCitations.length);
          setCitations(allCitations.slice(0, limit));
        }
      } catch (error) {
        console.error('Error fetching inline citations:', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchCitations();
    return () => { cancelled = true; };
  }, [promptId, limit]);

  if (loading || citations.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5 animate-fade-in">
      {citations.map((citation, index) => (
        <TooltipProvider key={citation.url}>
          <Tooltip>
            <TooltipTrigger asChild>
              <a
                href={citation.url}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-md",
                  "bg-muted/50 hover:bg-muted transition-colors",
                  "border border-border/50 hover:border-border"
                )}
                onClick={(e) => e.stopPropagation()}
              >
                <ExternalLink className="h-2.5 w-2.5" />
                <span className="max-w-[100px] truncate">{citation.domain}</span>
              </a>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p className="text-xs font-medium">{citation.title || citation.domain}</p>
              <p className="text-xs text-muted-foreground truncate">{citation.url}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ))}
      {totalCount > limit && (
        <Badge variant="outline" className="text-xs px-2 py-0.5">
          +{totalCount - limit} more
        </Badge>
      )}
    </div>
  );
}
