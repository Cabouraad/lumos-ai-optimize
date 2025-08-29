
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

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

  // Client-side filter for generic terms that shouldn't be competitors
  const isValidCompetitor = (competitorName: string): boolean => {
    const normalized = competitorName.toLowerCase().trim();
    
    // Comprehensive filter for generic/invalid terms
    const invalidTerms = [
      // Generic business terms
      'tools', 'tool', 'software', 'platform', 'service', 'solution', 'system',
      'data', 'content', 'marketing', 'business', 'company', 'team', 'user', 'users',
      'customer', 'customers', 'client', 'clients', 'email', 'web', 'mobile', 'app',
      'digital', 'online', 'social', 'media', 'search', 'analytics', 'insights',
      'management', 'automation', 'integration', 'optimization', 'performance',
      'experience', 'strategy', 'campaigns', 'audience', 'engagement', 'conversion',
      'track', 'automate', 'analyze', 'implement', 'use', 'create', 'build',
      // Words from the specific response
      'feedback', 'surveys', 'meetings', 'collaboration', 'personalization',
      'privacy', 'compliance', 'training', 'documentation', 'visualization',
      // Numbers and basic words
      'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
      'for', 'and', 'the', 'with', 'you', 'your', 'our', 'their', 'this', 'that'
    ];
    
    // Check if it's in the invalid terms list
    if (invalidTerms.includes(normalized)) {
      return false;
    }
    
    // Filter very short terms (likely generic)
    if (normalized.length < 3) {
      return false;
    }
    
    // Filter single words that are too generic (unless they contain dots/hyphens indicating brands)
    if (!normalized.includes(' ') && !normalized.includes('.') && !normalized.includes('-') && normalized.length < 5) {
      return false;
    }
    
    return true;
  };

  useEffect(() => {
    const fetchCompetitors = async () => {
      try {
        setLoading(true);
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

        // Apply client-side filtering to remove generic terms
        const validCompetitors = (data || []).filter((competitor: CompetitorData) => 
          isValidCompetitor(competitor.competitor_name)
        );

        setCompetitors(validCompetitors);
      } catch (err) {
        console.error('Error in fetchCompetitors:', err);
        setError('Failed to load competitors');
      } finally {
        setLoading(false);
      }
    };

    if (promptId) {
      fetchCompetitors();
    }
  }, [promptId]);

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
      <div className="text-xs text-muted-foreground">
        No competitors detected in recent responses
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold text-muted-foreground mb-2">
        Top Competitors ({competitors.length})
      </div>
      <div className="space-y-1">
        {competitors.slice(0, 5).map((competitor, index) => (
          <div key={competitor.competitor_name} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">#{index + 1}</span>
              <span className="font-medium">{competitor.competitor_name}</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs px-1 py-0">
                {competitor.mentions} mentions
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
