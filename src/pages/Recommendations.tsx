import { Layout } from '@/components/Layout';
import { UpgradePrompt } from '@/components/UpgradePrompt';
import { TrialBanner } from '@/components/TrialBanner';
import { useSubscriptionGate } from '@/hooks/useSubscriptionGate';
import { useAuth } from '@/contexts/AuthContext';
import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Lightbulb, RefreshCw } from 'lucide-react';
import { RecommendationCard } from '@/components/RecommendationCard';
import { FilterBar } from '@/components/FilterBar';
import { RecommendationSkeleton } from '@/components/RecommendationSkeleton';

interface Recommendation {
  id: string;
  type: 'content' | 'social' | 'site' | 'prompt';
  title: string;
  rationale: string;
  status: 'open' | 'snoozed' | 'done' | 'dismissed';
  created_at: string;
  cooldown_until?: string;
  metadata?: {
    steps?: string[];
    estLift?: number;
    sourcePromptIds?: string[];
    sourceRunIds?: string[];
    citations?: Array<{type: 'url' | 'ref', value: string}>;
    impact?: 'high' | 'medium' | 'low';
    category?: string;
    competitors?: string;
    relatedQueries?: string[];
  };
}

interface Filters {
  kind: string;
  status: string;
  minImpact: number;
  search: string;
}

export default function Recommendations() {
  const { canAccessRecommendations } = useSubscriptionGate();
  const { orgData } = useAuth();
  const { toast } = useToast();
  const recommendationsAccess = canAccessRecommendations();
  
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [filteredRecommendations, setFilteredRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [page, setPage] = useState(1);
  const itemsPerPage = 20;

  const [filters, setFilters] = useState<Filters>({
    kind: 'all',
    status: 'open',
    minImpact: 0,
    search: ''
  });

  // Show upgrade prompt if no access
  if (!recommendationsAccess.hasAccess) {
    return (
      <Layout>
        <div className="space-y-6">
          {/* Trial banner if user is on trial */}
          {recommendationsAccess.daysRemainingInTrial && recommendationsAccess.daysRemainingInTrial > 0 && (
            <TrialBanner daysRemaining={recommendationsAccess.daysRemainingInTrial} />
          )}
          
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Recommendations</h1>
            <p className="text-muted-foreground">
              AI-powered suggestions to improve your search visibility
            </p>
          </div>

          <div className="max-w-md mx-auto">
            <UpgradePrompt 
              feature="AI Recommendations"
              reason={recommendationsAccess.reason || ''}
              isTrialExpired={recommendationsAccess.isTrialExpired}
              daysRemainingInTrial={recommendationsAccess.daysRemainingInTrial}
            />
          </div>
        </div>
      </Layout>
    );
  }

  useEffect(() => {
    if (orgData?.organizations?.id) {
      loadRecommendations();
    }
  }, [orgData]);

  useEffect(() => {
    applyFilters();
  }, [recommendations, filters]);

  const loadRecommendations = async () => {
    if (!orgData?.organizations?.id) return;

    try {
      setLoading(true);
      const { data } = await supabase
        .from('recommendations')
        .select('*')
        .eq('org_id', orgData.organizations.id)
        .in('status', ['open', 'snoozed', 'done', 'dismissed'])
        .order('created_at', { ascending: false });

      setRecommendations((data || []) as Recommendation[]);
    } catch (error) {
      console.error('Error loading recommendations:', error);
      toast({
        title: "Error",
        description: "Failed to load recommendations",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...recommendations];

    // Filter by kind
    if (filters.kind !== 'all') {
      filtered = filtered.filter(rec => rec.type === filters.kind);
    }

    // Filter by status
    if (filters.status !== 'all') {
      filtered = filtered.filter(rec => rec.status === filters.status);
    }

    // Filter by minimum impact
    if (filters.minImpact > 0) {
      filtered = filtered.filter(rec => {
        const estLift = rec.metadata?.estLift || 0;
        return estLift >= filters.minImpact / 100;
      });
    }

    // Filter by search
    if (filters.search.trim()) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(rec => 
        rec.title.toLowerCase().includes(searchLower) ||
        rec.rationale.toLowerCase().includes(searchLower)
      );
    }

    // Sort by created_at desc, then by estLift desc
    filtered.sort((a, b) => {
      const dateComparison = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (dateComparison !== 0) return dateComparison;
      
      const aLift = a.metadata?.estLift || 0;
      const bLift = b.metadata?.estLift || 0;
      return bLift - aLift;
    });

    setFilteredRecommendations(filtered);
    setPage(1); // Reset to first page when filters change
  };

  const handleUpdateStatus = async (id: string, status: 'done' | 'dismissed', cooldownDays?: number) => {
    try {
      const updateData: any = {};
      
      if (cooldownDays && cooldownDays > 0) {
        // This is a snooze action
        const cooldownUntil = new Date();
        cooldownUntil.setDate(cooldownUntil.getDate() + cooldownDays);
        updateData.cooldown_until = cooldownUntil.toISOString();
        updateData.status = 'snoozed';
      } else {
        // This is a regular status update
        updateData.status = status;
      }

      const { error } = await supabase
        .from('recommendations')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Success",
        description: cooldownDays ? `Recommendation snoozed for ${cooldownDays} days` : `Recommendation marked as ${status}`,
      });

      await loadRecommendations();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleGenerateRecommendations = async () => {
    if (!orgData?.organizations?.id) return;
    
    setGenerating(true);
    try {
      // Use the new advanced recommendations function
      const { data, error } = await supabase.functions.invoke('advanced-recommendations', {
        body: { orgId: orgData.organizations.id }
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: "Success",
          description: `Generated ${data.created} new recommendations from analysis of ${data.analysisResults?.visibilityPromptsAnalyzed || 0} prompts`,
        });
      } else {
        throw new Error(data.error || 'Failed to generate recommendations');
      }

      await loadRecommendations();
    } catch (error: any) {
      console.error('Recommendation generation error:', error);
      toast({
        title: "Error",
        description: error.message || 'Failed to generate recommendations',
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const paginatedRecommendations = filteredRecommendations.slice(
    (page - 1) * itemsPerPage,
    page * itemsPerPage
  );

  const totalPages = Math.ceil(filteredRecommendations.length / itemsPerPage);

  if (loading) {
    return (
      <Layout>
        <div className="space-y-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Recommendations</h1>
              <p className="text-muted-foreground">
                AI-powered suggestions to improve your search visibility
              </p>
            </div>
          </div>
          
          <FilterBar filters={filters} onFiltersChange={setFilters} />
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <RecommendationSkeleton key={i} />
            ))}
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {recommendationsAccess.daysRemainingInTrial && recommendationsAccess.daysRemainingInTrial > 0 && (
          <TrialBanner daysRemaining={recommendationsAccess.daysRemainingInTrial} />
        )}
        
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Recommendations</h1>
            <p className="text-muted-foreground">
              AI-powered suggestions to improve your search visibility
            </p>
          </div>
          <Button 
            onClick={handleGenerateRecommendations}
            disabled={generating}
            aria-label="Generate new recommendations"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${generating ? 'animate-spin' : ''}`} />
            {generating ? 'Generating...' : 'Generate Now'}
          </Button>
        </div>

        <FilterBar 
          filters={filters} 
          onFiltersChange={setFilters}
          totalCount={recommendations.length}
          filteredCount={filteredRecommendations.length}
        />

        {/* Rest of the original component logic */}
        {filteredRecommendations.length > 0 ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {paginatedRecommendations.map((recommendation) => (
                <RecommendationCard
                  key={recommendation.id}
                  recommendation={recommendation}
                  onUpdateStatus={handleUpdateStatus}
                  orgId={orgData?.organizations?.id}
                />
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex justify-center items-center space-x-4">
                <Button
                  variant="outline"
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                  aria-label="Previous page"
                >
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {page} of {totalPages} ({filteredRecommendations.length} results)
                </span>
                <Button
                  variant="outline"
                  disabled={page === totalPages}
                  onClick={() => setPage(page + 1)}
                  aria-label="Next page"
                >
                  Next
                </Button>
              </div>
            )}
          </>
        ) : recommendations.length === 0 ? (
          <Card className="rounded-2xl">
            <CardContent className="text-center py-12">
              <Lightbulb className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No recommendations yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Recommendations are generated daily after your 3:00 AM ET scan.
                <br />Run prompts to get personalized visibility insights.
              </p>
              <Button 
                onClick={handleGenerateRecommendations}
                disabled={generating}
                variant="secondary"
                aria-label="Generate recommendations"
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${generating ? 'animate-spin' : ''}`} />
                {generating ? 'Generating...' : 'Generate Now'}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="rounded-2xl">
            <CardContent className="text-center py-12">
              <Lightbulb className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No matching recommendations</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Try adjusting your filters to see more results.
              </p>
              <Button 
                variant="outline"
                onClick={() => setFilters({ kind: 'all', status: 'open', minImpact: 0, search: '' })}
                aria-label="Clear all filters"
              >
                Clear Filters
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}