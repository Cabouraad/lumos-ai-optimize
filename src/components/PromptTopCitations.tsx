import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { CitationsDisplay, Citation } from './CitationsDisplay';
import { ExternalLink } from 'lucide-react';

interface PromptTopCitationsProps {
  promptId: string;
  limit?: number;
}

export function PromptTopCitations({ promptId, limit = 5 }: PromptTopCitationsProps) {
  const [citations, setCitations] = useState<Citation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchTopCitations = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch recent responses for this prompt with citations
        const { data: responses, error: fetchError } = await supabase
          .from('prompt_provider_responses')
          .select('citations_json, provider')
          .eq('prompt_id', promptId)
          .not('citations_json', 'is', null)
          .order('run_at', { ascending: false })
          .limit(20); // Get recent responses

        if (fetchError) {
          throw fetchError;
        }

        if (!cancelled && responses) {
          // Aggregate and dedupe citations
          const citationMap = new Map<string, Citation & { score: number }>();

          responses.forEach((response) => {
            const citations = (response.citations_json as unknown as Citation[]) || [];
            citations.forEach((citation) => {
              const key = citation.url;
              const existing = citationMap.get(key);
              
              if (existing) {
                // Boost score for repeated citations
                existing.score += 1;
              } else {
                // Score based on brand mention and type
                let score = 1;
                if (citation.brand_mention === 'yes') score += 2;
                if (citation.resolved_brand?.type === 'known') score += 1;
                if (citation.from_provider) score += 0.5;
                
                citationMap.set(key, { ...citation, score });
              }
            });
          });

          // Sort by score and take top N
          const topCitations = Array.from(citationMap.values())
            .sort((a, b) => b.score - a.score)
            .slice(0, limit)
            .map(({ score, ...citation }) => citation); // Remove score from final result

          setCitations(topCitations);
        }
      } catch (err) {
        console.error('Error fetching prompt citations:', err);
        if (!cancelled) {
          setError('Failed to load citations');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    if (promptId) {
      fetchTopCitations();
    }

    return () => {
      cancelled = true;
    };
  }, [promptId, limit]);

  if (loading) {
    return (
      <div className="space-y-2">
        <div className="text-xs font-semibold text-muted-foreground mb-2">Top Citations</div>
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex items-center gap-2">
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-4 w-32" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-xs text-muted-foreground">
        Failed to load citation data
      </div>
    );
  }

  if (citations.length === 0) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <ExternalLink className="h-4 w-4" />
        <span className="text-sm">No citations found in recent responses</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="text-xs font-semibold text-muted-foreground mb-2">
        Top Citations ({citations.length})
      </div>
      
      <CitationsDisplay 
        citations={citations} 
        provider="aggregated" 
        isCompact={true}
      />
    </div>
  );
}