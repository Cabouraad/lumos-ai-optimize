import React, { useEffect, useState } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { getOrgId } from '@/lib/auth';
import { Users, TrendingUp, Eye, FileText, Plus, X, Calendar, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface PermanentCompetitor {
  id: string;
  name: string;
  totalAppearances: number;
  averageScore: number;
  firstDetectedAt: string;
  lastSeenAt: string;
  recentPrompts: Array<{
    id: string;
    text: string;
    score: number;
    runAt: string;
    provider: string;
  }>;
}

interface VisibilityResult {
  id: string;
  score: number;
  brands_json: string[];
  prompt_runs: {
    id: string;
    run_at: string;
    llm_providers: {
      name: string;
    };
    prompts: {
      id: string;
      text: string;
    };
  };
}

export default function Competitors() {
  const [competitors, setCompetitors] = useState<PermanentCompetitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newCompetitorName, setNewCompetitorName] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    fetchPermanentCompetitors();
  }, []);

  const fetchPermanentCompetitors = async () => {
    try {
      setLoading(true);
      const orgId = await getOrgId();

      // Get permanent competitors from brand catalog
      const { data: competitorsData, error } = await supabase
        .from('brand_catalog')
        .select('*')
        .eq('org_id', orgId)
        .eq('is_org_brand', false)
        .order('last_seen_at', { ascending: false });

      if (error) {
        console.error('Error fetching competitors:', error);
        return;
      }

      // For each competitor, get their recent prompt appearances
      const competitorsWithPrompts: PermanentCompetitor[] = [];

      for (const competitor of competitorsData || []) {
        // Get recent visibility results that mention this competitor
        const { data: visibilityData } = await supabase
          .from('visibility_results')
          .select(`
            score,
            brands_json,
            prompt_runs!inner (
              run_at,
              llm_providers (name),
              prompts!inner (
                id,
                text,
                org_id
              )
            )
          `)
          .eq('prompt_runs.prompts.org_id', orgId)
          .order('prompt_runs.run_at', { ascending: false })
          .limit(100);

        // Filter results that mention this specific competitor
        const recentPrompts = [];
        const competitorNameLower = competitor.name.toLowerCase();

        for (const result of visibilityData || []) {
          const brands = result.brands_json as string[] || [];
          const mentionsCompetitor = Array.isArray(brands) && brands.some((brand: string) => 
            brand.toLowerCase().includes(competitorNameLower)
          );

          if (mentionsCompetitor && recentPrompts.length < 5) {
            recentPrompts.push({
              id: result.prompt_runs.prompts.id,
              text: result.prompt_runs.prompts.text,
              score: result.score,
              runAt: result.prompt_runs.run_at,
              provider: result.prompt_runs.llm_providers?.name || 'unknown'
            });
          }
        }

        competitorsWithPrompts.push({
          id: competitor.id,
          name: competitor.name,
          totalAppearances: competitor.total_appearances || 0,
          averageScore: Number(competitor.average_score) || 0,
          firstDetectedAt: competitor.first_detected_at,
          lastSeenAt: competitor.last_seen_at,
          recentPrompts
        });
      }

      setCompetitors(competitorsWithPrompts);
    } catch (error) {
      console.error('Error fetching competitors data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddCompetitor = async () => {
    if (!newCompetitorName.trim()) return;

    try {
      const orgId = await getOrgId();
      
      // Check if competitor already exists
      const { data: existing } = await supabase
        .from('brand_catalog')
        .select('id')
        .eq('org_id', orgId)
        .eq('name', newCompetitorName.trim())
        .single();

      if (existing) {
        toast({
          title: "Competitor already exists",
          description: "This competitor is already in your catalog.",
          variant: "destructive"
        });
        return;
      }

      // Add new competitor
      const { error } = await supabase
        .from('brand_catalog')
        .insert({
          org_id: orgId,
          name: newCompetitorName.trim(),
          is_org_brand: false,
          variants_json: [],
          first_detected_at: new Date().toISOString(),
          last_seen_at: new Date().toISOString(),
          total_appearances: 0,
          average_score: 0
        });

      if (error) {
        console.error('Error adding competitor:', error);
        toast({
          title: "Error adding competitor",
          description: "Failed to add the competitor to your catalog.",
          variant: "destructive"
        });
        return;
      }

      toast({
        title: "Competitor added",
        description: `${newCompetitorName} has been added to your competitor catalog.`
      });

      setNewCompetitorName('');
      setAddDialogOpen(false);
      fetchPermanentCompetitors();
    } catch (error) {
      console.error('Error in handleAddCompetitor:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred.",
        variant: "destructive"
      });
    }
  };

  const handleRemoveCompetitor = async (competitorId: string, competitorName: string) => {
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
        description: `${competitorName} has been removed from your competitor catalog.`
      });

      fetchPermanentCompetitors();
    } catch (error) {
      console.error('Error in handleRemoveCompetitor:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred.",
        variant: "destructive"
      });
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 8) return 'text-green-600';
    if (score >= 5) return 'text-yellow-600';
    return 'text-red-600';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <Layout>
        <div className="container mx-auto p-6">
          <div className="animate-pulse">
            <div className="h-8 bg-muted rounded w-1/3 mb-6"></div>
            <div className="grid gap-6">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-32 bg-muted rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Users className="h-8 w-8" />
            <div>
              <h1 className="text-3xl font-bold">Competitor Catalog</h1>
              <p className="text-muted-foreground">Permanent catalog of competitors detected from AI responses</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {competitors.length > 0 && (
              <Badge variant="secondary" className="text-sm">
                {competitors.length} competitors tracked
              </Badge>
            )}
            <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Competitor
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Competitor</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <Input
                    placeholder="Enter competitor name..."
                    value={newCompetitorName}
                    onChange={(e) => setNewCompetitorName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleAddCompetitor();
                      }
                    }}
                  />
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleAddCompetitor}>
                      Add Competitor
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {competitors.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No competitors in catalog yet</h3>
                <div className="text-sm text-muted-foreground space-y-1 mb-4">
                  <p>• Competitors are automatically added when detected in AI responses</p>
                  <p>• You can manually add competitors using the button above</p>
                  <p>• Run prompts to start building your competitor catalog</p>
                </div>
                <Button onClick={() => setAddDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Your First Competitor
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6">
            {competitors.map((competitor) => (
              <Card key={competitor.id} className="relative">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CardTitle className="text-xl">{competitor.name}</CardTitle>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveCompetitor(competitor.id, competitor.name)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="flex items-center gap-2">
                        <Eye className="h-4 w-4 text-muted-foreground" />
                        <span className="font-semibold">{competitor.totalAppearances}</span>
                        <span className="text-sm text-muted-foreground">appearances</span>
                      </div>
                      {competitor.averageScore > 0 && (
                        <div className="flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-muted-foreground" />
                          <span className={`font-semibold ${getScoreColor(competitor.averageScore)}`}>
                            {competitor.averageScore.toFixed(1)}/10
                          </span>
                          <span className="text-sm text-muted-foreground">avg score</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-6 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      <span>First detected: {formatDate(competitor.firstDetectedAt)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      <span>Last seen: {formatDate(competitor.lastSeenAt)}</span>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent>
                  {competitor.recentPrompts.length > 0 ? (
                    <div className="space-y-4">
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <FileText className="h-4 w-4" />
                          <h3 className="font-semibold">Recent Mentions</h3>
                        </div>
                        
                        <div className="space-y-3">
                          {competitor.recentPrompts.map((prompt, index) => (
                            <div key={`${prompt.id}-${index}`} className="border rounded-lg p-3">
                              <div className="flex items-start justify-between gap-3 mb-2">
                                <p className="text-sm font-medium line-clamp-2">{prompt.text}</p>
                                <Badge className={`${getScoreColor(prompt.score)} font-bold`}>
                                  {prompt.score}/10
                                </Badge>
                              </div>
                              <div className="flex items-center justify-between text-xs text-muted-foreground">
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="capitalize">
                                    {prompt.provider}
                                  </Badge>
                                </div>
                                <span>{formatDate(prompt.runAt)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-4 text-muted-foreground">
                      <FileText className="h-8 w-8 mx-auto mb-2" />
                      <p className="text-sm">No recent mentions found</p>
                      <p className="text-xs">Run prompts to see when this competitor appears</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}