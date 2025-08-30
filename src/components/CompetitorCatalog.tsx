import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { getOrgId } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { Trash2, Eye, Calendar, TrendingUp, Sparkles, AlertTriangle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface CompetitorCatalogEntry {
  id: string;
  name: string;
  is_org_brand: boolean;
  first_detected_at: string;
  last_seen_at: string;
  total_appearances: number;
  average_score: number;
  variants_json: any; // Using any for Json type from Supabase
}

interface CleanupResult {
  success: boolean;
  dry_run: boolean;
  total_before: number;
  to_delete: number;
  to_keep: number;
  final_count: number;
  deletions: any[];
  error?: string;
}

const BrandLogo = ({ brandName }: { brandName: string }) => {
  const [logoUrl, setLogoUrl] = useState<string>('');
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setLogoUrl(`https://logo.clearbit.com/${brandName.toLowerCase().replace(/\s+/g, '')}.com`);
  }, [brandName]);

  const handleError = () => {
    if (!hasError) {
      setHasError(true);
      setLogoUrl(`https://ui-avatars.com/api/?name=${encodeURIComponent(brandName)}&size=32&background=6366f1&color=ffffff&bold=true&format=svg`);
    }
  };

  return (
    <div className="w-8 h-8 rounded-full overflow-hidden bg-card flex items-center justify-center border">
      {logoUrl ? (
        <img 
          src={logoUrl} 
          alt={`${brandName} logo`}
          className="w-full h-full object-cover"
          onError={handleError}
        />
      ) : (
        <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
          <span className="text-xs font-semibold text-primary">
            {brandName.charAt(0).toUpperCase()}
          </span>
        </div>
      )}
    </div>
  );
};

export function CompetitorCatalog() {
  const [catalog, setCatalog] = useState<CompetitorCatalogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCompetitors, setSelectedCompetitors] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchCatalog();
  }, []);

  const fetchCatalog = async () => {
    try {
      setLoading(true);
      const orgId = await getOrgId();

      const { data, error } = await supabase
        .from('brand_catalog')
        .select('*')
        .eq('org_id', orgId)
        .eq('is_org_brand', false)
        .order('total_appearances', { ascending: false });

      if (error) {
        console.error('Error fetching competitor catalog:', error);
        throw error;
      }

      setCatalog(data || []);
    } catch (error) {
      console.error('Error loading competitor catalog:', error);
      toast({
        title: "Error",
        description: "Failed to load competitor catalog",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveCompetitor = async (competitorId: string, name: string) => {
    try {
      const { error } = await supabase
        .from('brand_catalog')
        .delete()
        .eq('id', competitorId);

      if (error) {
        console.error('Error removing competitor:', error);
        toast({
          title: "Error removing competitor",
          description: "Failed to remove the competitor from your catalog.",
          variant: "destructive"
        });
        return;
      }

      toast({
        title: "Competitor removed",
        description: `${name} has been removed from your catalog.`
      });

      setSelectedCompetitors(new Set());
      fetchCatalog();
    } catch (error) {
      console.error('Error in handleRemoveCompetitor:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred.",
        variant: "destructive"
      });
    }
  };

  const handleSelectCompetitor = (competitorId: string, checked: boolean) => {
    const newSelected = new Set(selectedCompetitors);
    if (checked) {
      newSelected.add(competitorId);
    } else {
      newSelected.delete(competitorId);
    }
    setSelectedCompetitors(newSelected);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedCompetitors(new Set(catalog.map(c => c.id)));
    } else {
      setSelectedCompetitors(new Set());
    }
  };

  const handleBulkDelete = async () => {
    if (selectedCompetitors.size === 0) return;

    try {
      setIsDeleting(true);
      
      const { error } = await supabase
        .from('brand_catalog')
        .delete()
        .in('id', Array.from(selectedCompetitors));

      if (error) {
        console.error('Error removing competitors:', error);
        toast({
          title: "Error removing competitors",
          description: "Failed to remove selected competitors from your catalog.",
          variant: "destructive"
        });
        return;
      }

      toast({
        title: "Competitors removed",
        description: `${selectedCompetitors.size} competitor(s) have been removed from your catalog.`
      });

      setSelectedCompetitors(new Set());
      fetchCatalog();
    } catch (error) {
      console.error('Error in handleBulkDelete:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred.",
        variant: "destructive"
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCleanupCatalog = async () => {
    try {
      setCleanupLoading(true);
      
      // First do a dry run to see what would be cleaned
      const { data: dryRunResult, error: dryRunError } = await supabase
        .rpc('clean_competitor_catalog', { p_dry_run: true });

      if (dryRunError) {
        throw dryRunError;
      }

      const dryRun = dryRunResult as unknown as CleanupResult;
      if (!dryRun?.success) {
        throw new Error(dryRun?.error || 'Unknown error during dry run');
      }

      // Show confirmation dialog with preview
      const confirmed = window.confirm(
        `Catalog Cleanup Preview:\n\n` +
        `• Current competitors: ${dryRun.total_before}\n` +
        `• Will be removed: ${dryRun.to_delete}\n` +
        `• Will be kept: ${dryRun.to_keep}\n` +
        `• Final count: ${dryRun.final_count}\n\n` +
        `This will remove generic terms, invalid names, and unused competitors.\n\n` +
        `Do you want to proceed with the cleanup?`
      );

      if (!confirmed) {
        return;
      }

      // Perform actual cleanup
      const { data: cleanupResult, error: cleanupError } = await supabase
        .rpc('clean_competitor_catalog', { p_dry_run: false });

      if (cleanupError) {
        throw cleanupError;
      }

      const cleanup = cleanupResult as unknown as CleanupResult;
      if (!cleanup?.success) {
        throw new Error(cleanup?.error || 'Unknown error during cleanup');
      }

      toast({
        title: "Catalog cleaned up",
        description: `Removed ${cleanup.to_delete} irrelevant competitors. You now have ${cleanup.final_count} competitors.`
      });

      setSelectedCompetitors(new Set());
      fetchCatalog();
    } catch (error) {
      console.error('Error cleaning up catalog:', error);
      toast({
        title: "Error cleaning up catalog",
        description: "Failed to clean up the competitor catalog.",
        variant: "destructive"
      });
    } finally {
      setCleanupLoading(false);
    }
  };

  const isAllSelected = catalog.length > 0 && selectedCompetitors.size === catalog.length;
  const isPartiallySelected = selectedCompetitors.size > 0 && selectedCompetitors.size < catalog.length;

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Competitor Catalog
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-muted/20 rounded-lg">
                <div className="flex items-center gap-3">
                  <Skeleton className="w-8 h-8 rounded-full" />
                  <div className="space-y-1">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Skeleton className="h-6 w-16" />
                  <Skeleton className="h-8 w-8" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            <CardTitle>Competitor Catalog</CardTitle>
            <Badge variant="secondary" className="ml-2">
              {catalog.length}/50 competitors
            </Badge>
            {catalog.length >= 50 && (
              <Badge variant="outline" className="text-warning">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Limit reached
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {catalog.length > 10 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleCleanupCatalog}
                disabled={cleanupLoading}
              >
                <Sparkles className="h-4 w-4 mr-2" />
                {cleanupLoading ? 'Cleaning...' : 'Clean up'}
              </Button>
            )}
            {selectedCompetitors.size > 0 && (
              <>
                <Badge variant="outline">
                  {selectedCompetitors.size} selected
                </Badge>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleBulkDelete}
                  disabled={isDeleting}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  {isDeleting ? 'Deleting...' : `Delete ${selectedCompetitors.size}`}
                </Button>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            All competitors detected and tracked from your prompt responses
          </p>
          {catalog.length >= 45 && catalog.length < 50 && (
            <p className="text-sm text-warning">
              Approaching 50-competitor limit ({50 - catalog.length} spots remaining)
            </p>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {catalog.length === 0 ? (
          <div className="text-center py-8">
            <Eye className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">No Competitors Detected</h3>
            <p className="text-sm text-muted-foreground">
              Run some prompts to start detecting competitors in AI responses
            </p>
          </div>
        ) : (
          <div>
            {catalog.length > 0 && (
              <div className="flex items-center gap-2 mb-4 p-3 bg-muted/30 rounded-lg">
                <Checkbox
                  checked={isAllSelected}
                  onCheckedChange={handleSelectAll}
                  className="data-[state=indeterminate]:bg-primary data-[state=indeterminate]:border-primary"
                  {...(isPartiallySelected && { 'data-state': 'indeterminate' })}
                />
                <label className="text-sm font-medium">
                  {isAllSelected ? 'Deselect all' : 'Select all competitors'}
                </label>
              </div>
            )}
            <div className="space-y-3">
              {catalog.map((competitor) => (
                <div
                  key={competitor.id}
                  className="flex items-center justify-between p-4 hover:bg-muted/30 rounded-lg transition-colors group"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Checkbox
                      checked={selectedCompetitors.has(competitor.id)}
                      onCheckedChange={(checked) => handleSelectCompetitor(competitor.id, checked as boolean)}
                    />
                    <BrandLogo brandName={competitor.name} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-foreground text-sm truncate">
                          {competitor.name}
                        </p>
                        {competitor.total_appearances > 0 && (
                          <Badge variant="outline" className="text-xs">
                            <TrendingUp className="h-3 w-3 mr-1" />
                            {competitor.total_appearances} mentions
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          First seen {formatDistanceToNow(new Date(competitor.first_detected_at), { addSuffix: true })}
                        </div>
                        {competitor.total_appearances > 0 && (
                          <div>
                            Avg. score: {competitor.average_score.toFixed(1)}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {competitor.total_appearances === 0 && (
                      <Badge variant="secondary" className="text-xs">
                        Manually added
                      </Badge>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveCompetitor(competitor.id, competitor.name)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}