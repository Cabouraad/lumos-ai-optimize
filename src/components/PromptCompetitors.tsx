
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { CompetitorChip, isValidCompetitor } from './CompetitorChip';
import { Building2 } from 'lucide-react';
import { useCatalogCompetitors } from '@/hooks/useCatalogCompetitors';

interface CompetitorData {
  competitor_name: string;
  mentions: number;
  share: number;
}

interface PromptCompetitorsProps {
  promptId: string;
}

export function PromptCompetitors({ promptId }: PromptCompetitorsProps) {
  const [competitors, setCompetitors] = useState<CompetitorData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { competitors: catalogCompetitors, isCompetitorInCatalog } = useCatalogCompetitors();
  const isMountedRef = useRef(true);
  const inFlightRef = useRef(false);

  useEffect(() => {
    const fetchCompetitors = async () => {
      // Prevent duplicate requests
      if (inFlightRef.current) return;
      inFlightRef.current = true;

      try {
        // Only show loading on initial load or when no competitors exist
        if (competitors.length === 0) {
          setLoading(true);
        }
        setError(null);

        const { data, error: rpcError } = await supabase
          .rpc('get_prompt_competitors', { 
            p_prompt_id: promptId,
            p_days: 30 
          });

        if (rpcError) {
          console.error('Error fetching prompt competitors:', rpcError);
          setError('Failed to load competitors');
          return;
        }

        // Show all valid competitors, not just catalog ones
        const validCompetitors = (data || []).filter((competitor: CompetitorData) => {
          return isValidCompetitor(competitor.competitor_name);
        });

        // Only update if component is still mounted
        if (isMountedRef.current) {
          setCompetitors(validCompetitors);
        }
      } catch (err) {
        console.error('Error in fetchCompetitors:', err);
        if (isMountedRef.current) {
          setError('Failed to load competitors');
        }
      } finally {
        if (isMountedRef.current) {
          setLoading(false);
        }
        inFlightRef.current = false;
      }
    };

    if (promptId) {
      fetchCompetitors();
    }

    // Cleanup function
    return () => {
      isMountedRef.current = false;
    };
  }, [promptId]); // Removed isCompetitorInCatalog from dependencies

  if (loading) {
    return (
      <div className="space-y-2">
        <div className="text-xs font-semibold text-muted-foreground mb-2">Top Competitors</div>
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex items-center justify-between">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-8" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-xs text-muted-foreground">
        Failed to load competitor data
      </div>
    );
  }

  if (competitors.length === 0) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Building2 className="h-4 w-4" />
        <span className="text-sm">No competitors found in recent responses</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-2">
        <span>Competitors ({competitors.length})</span>
        <Badge variant="outline" className="text-xs px-1.5 py-0 bg-secondary/10 text-foreground border-border">
          All Detected
        </Badge>
      </div>
      
      {/* Competitor Chips */}
      <div className="flex flex-wrap gap-2">
        {competitors.slice(0, 5).map((competitor) => (
          <CompetitorChip
            key={competitor.competitor_name}
            name={competitor.competitor_name}
            mentions={competitor.mentions}
            confidence={isCompetitorInCatalog(competitor.competitor_name) ? 0.9 : 0.7}
            size="sm"
            variant="outline"
          />
        ))}
      </div>

      {/* Detailed List */}
      <div className="space-y-1">
        {competitors.slice(0, 3).map((competitor, index) => (
          <div key={competitor.competitor_name} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">#{index + 1}</span>
              <span className="font-medium">{competitor.competitor_name}</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs px-1 py-0">
                {competitor.mentions}
              </Badge>
              <span className="text-muted-foreground font-mono">
                {competitor.share.toFixed(1)}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
