
import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { UpgradePrompt } from '@/components/UpgradePrompt';
import { TrialBanner } from '@/components/TrialBanner';
import { useSubscriptionGate } from '@/hooks/useSubscriptionGate';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from '@/integrations/supabase/client';
import { getOrgId } from '@/lib/auth';
import { 
  TrendingUp, 
  TrendingDown, 
  Trophy, 
  Target, 
  Zap, 
  Plus, 
  Info,
  BarChart3,
  Trash2,
  Eye,
  AlertCircle
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

interface CompetitorData {
  competitor_name: string;
  total_mentions: number;
  distinct_prompts: number;
  first_seen: string;
  last_seen: string;
  avg_score: number;
}

interface CompetitorBrand {
  id: string;
  name: string;
  totalAppearances: number;
  averageScore: number;
  firstDetectedAt: string;
  lastSeenAt: string;
  trend?: number;
  sharePercentage?: number;
  isManuallyAdded?: boolean;
}

interface TrackedCompetitor {
  id: string;
  name: string;
  first_detected_at: string;
}

const BrandLogo = ({ brandName }: { brandName: string }) => {
  const [logoUrl, setLogoUrl] = useState<string>('');
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    // Try Clearbit logo API first, fallback to generated avatar
    setLogoUrl(`https://logo.clearbit.com/${brandName.toLowerCase().replace(/\s+/g, '')}.com`);
  }, [brandName]);

  const handleError = () => {
    if (!hasError) {
      setHasError(true);
      // Fallback to generated avatar
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

const TrendIcon = ({ trend }: { trend: number }) => {
  if (trend > 0) {
    return (
      <div className="flex items-center gap-1 text-green-600">
        <TrendingUp className="w-3 h-3" />
        <span className="text-xs font-medium">+{Math.abs(trend).toFixed(1)}%</span>
      </div>
    );
  } else if (trend < 0) {
    return (
      <div className="flex items-center gap-1 text-red-500">
        <TrendingDown className="w-3 h-3" />
        <span className="text-xs font-medium">-{Math.abs(trend).toFixed(1)}%</span>
      </div>
    );
  }
  return null;
};

const CompetitorRow = ({ competitor, rank }: { competitor: CompetitorBrand; rank: number }) => {
  const sharePercentage = competitor.sharePercentage || ((competitor.averageScore / 10) * 100);
  const trend = competitor.trend || 0;

  return (
    <div className="flex items-center justify-between p-4 hover:bg-muted/30 rounded-lg transition-colors group min-h-[72px]">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="flex-shrink-0 w-6 text-center">
          <span className="text-sm font-medium text-muted-foreground">{rank}</span>
        </div>
        <div className="flex-shrink-0">
          <BrandLogo brandName={competitor.name} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-foreground text-sm truncate">{competitor.name}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{competitor.totalAppearances} mentions</p>
        </div>
      </div>
      <div className="flex items-center gap-4 flex-shrink-0">
        <div className="text-right">
          <div className="font-bold text-lg text-foreground">{sharePercentage.toFixed(1)}%</div>
          <TrendIcon trend={trend} />
        </div>
      </div>
    </div>
  );
};

export default function Competitors() {
  const { canAccessCompetitorAnalysis } = useSubscriptionGate();
  const competitorAccess = canAccessCompetitorAnalysis();
  const [competitorData, setCompetitorData] = useState<CompetitorData[]>([]);
  const [trackedCompetitors, setTrackedCompetitors] = useState<TrackedCompetitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newCompetitorName, setNewCompetitorName] = useState('');
  const [orgName, setOrgName] = useState<string>('Your Brand');
  const [orgBrand, setOrgBrand] = useState<CompetitorBrand | null>(null);
  
  const { toast } = useToast();

  useEffect(() => {
    fetchCompetitorData();
  }, []);

  const calculateTrend = (lastSeenAt: string, firstSeenAt: string, totalMentions: number): number => {
    const daysSinceFirst = Math.max(1, Math.ceil((new Date().getTime() - new Date(firstSeenAt).getTime()) / (1000 * 60 * 60 * 24)));
    const daysSinceLast = Math.ceil((new Date().getTime() - new Date(lastSeenAt).getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysSinceLast <= 7 && totalMentions / daysSinceFirst > 0.1) {
      return (totalMentions / Math.max(daysSinceFirst, 1) * 10) - 5;
    }
    return (totalMentions / Math.max(daysSinceFirst, 1)) - 5;
  };

  const fetchCompetitorData = async () => {
    try {
      setLoading(true);
      const orgId = await getOrgId();

      // Get org name and brand info
      const [orgResult, competitorSummaryResult, trackedResult] = await Promise.all([
        supabase
          .from('organizations')
          .select('name')
          .eq('id', orgId)
          .single(),
        supabase
          .rpc('get_org_competitor_summary', { p_org_id: orgId, p_days: 30 }),
        supabase
          .from('brand_catalog')
          .select('id, name, first_detected_at, total_appearances, is_org_brand, average_score')
          .eq('org_id', orgId)
      ]);

      if (competitorSummaryResult.error) {
        console.error('Error fetching competitor summary:', competitorSummaryResult.error);
        return;
      }

      const currentOrgName = orgResult.data?.name || 'Your Brand';
      setOrgName(currentOrgName);

      // Separate org brands from manual competitors
      const orgBrands = trackedResult.data?.filter(b => b.is_org_brand) || [];
      const manualCompetitors = trackedResult.data?.filter(b => !b.is_org_brand && b.total_appearances === 0) || [];

      // Create org brand data if exists
      if (orgBrands.length > 0) {
        const orgBrandData = orgBrands[0];
        setOrgBrand({
          id: orgBrandData.id,
          name: orgBrandData.name,
          totalAppearances: orgBrandData.total_appearances || 0,
          averageScore: Number(orgBrandData.average_score) || 0,
          firstDetectedAt: orgBrandData.first_detected_at,
          lastSeenAt: orgBrandData.first_detected_at,
          sharePercentage: ((Number(orgBrandData.average_score) || 0) / 10) * 100,
          isManuallyAdded: false
        });
      }

      // Convert RPC data to competitor format
      const competitors: CompetitorData[] = competitorSummaryResult.data || [];
      setCompetitorData(competitors);

      // Set tracked competitors (manually added, with 0 appearances)
      setTrackedCompetitors(manualCompetitors.map(comp => ({
        id: comp.id,
        name: comp.name,
        first_detected_at: comp.first_detected_at
      })));

    } catch (error) {
      console.error('Error fetching competitor data:', error);
      toast({
        title: "Error loading data",
        description: "Failed to load competitor information.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const transformCompetitorData = (data: CompetitorData[]): CompetitorBrand[] => {
    return data.map(comp => ({
      id: comp.competitor_name, // Use name as ID for display purposes
      name: comp.competitor_name,
      totalAppearances: Number(comp.total_mentions),
      averageScore: Number(comp.avg_score),
      firstDetectedAt: comp.first_seen,
      lastSeenAt: comp.last_seen,
      trend: calculateTrend(comp.last_seen, comp.first_seen, Number(comp.total_mentions)),
      sharePercentage: (Number(comp.total_mentions) / Math.max(1, competitorData.reduce((sum, c) => sum + Number(c.total_mentions), 0))) * 100,
      isManuallyAdded: false
    }));
  };

  const getTopBrands = (): CompetitorBrand[] => {
    const competitors = transformCompetitorData(competitorData).slice(0, 5);
    return orgBrand ? [orgBrand, ...competitors] : competitors;
  };

  const getNearestCompetitors = (): CompetitorBrand[] => {
    const competitors = transformCompetitorData(competitorData)
      .sort((a, b) => b.averageScore - a.averageScore)
      .slice(0, 5);
    return orgBrand ? [orgBrand, ...competitors] : competitors;
  };

  const getUpcomingBrands = (): CompetitorBrand[] => {
    const competitors = transformCompetitorData(competitorData)
      .filter(c => c.trend && c.trend > 0)
      .sort((a, b) => (b.trend || 0) - (a.trend || 0))
      .slice(0, 4);
    return orgBrand ? [orgBrand, ...competitors] : competitors;
  };

  const handleAddCompetitor = async () => {
    if (!newCompetitorName.trim()) return;

    try {
      const orgId = await getOrgId();
      
      const { data: existing } = await supabase
        .from('brand_catalog')
        .select('id')
        .eq('org_id', orgId)
        .ilike('name', newCompetitorName.trim());

      if (existing && existing.length > 0) {
        toast({
          title: "Competitor already exists",
          description: "This competitor is already in your catalog.",
          variant: "destructive"
        });
        return;
      }

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
      fetchCompetitorData();
    } catch (error) {
      console.error('Error in handleAddCompetitor:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred.",
        variant: "destructive"
      });
    }
  };

  const handleRemoveCompetitor = async (competitorId: string) => {
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
        description: "The competitor has been removed from your catalog."
      });

      fetchCompetitorData();
    } catch (error) {
      console.error('Error in handleRemoveCompetitor:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred.",
        variant: "destructive"
      });
    }
  };

  if (!competitorAccess.hasAccess) {
    return (
      <Layout>
        <div className="container mx-auto p-6">
          {/* Trial banner if user is on trial */}
          {competitorAccess.daysRemainingInTrial && competitorAccess.daysRemainingInTrial > 0 && (
            <TrialBanner daysRemaining={competitorAccess.daysRemainingInTrial} />
          )}
          
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">Brand Competition</h1>
            <p className="text-muted-foreground">Competition analysis for your organization</p>
          </div>

          <div className="max-w-md mx-auto">
            <UpgradePrompt 
              feature="Competitor Analysis"
              reason={competitorAccess.reason || ''}
              isTrialExpired={competitorAccess.isTrialExpired}
              daysRemainingInTrial={competitorAccess.daysRemainingInTrial}
            />
          </div>
        </div>
      </Layout>
    );
  }

  // If user has access, show trial banner if on trial
  const showTrialBanner = competitorAccess.daysRemainingInTrial && competitorAccess.daysRemainingInTrial > 0;

  if (loading) {
    return (
      <Layout>
        <div className="container mx-auto p-6">
          <div className="mb-8">
            <Skeleton className="h-8 w-64 mb-2" />
            <Skeleton className="h-4 w-96" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => (
              <Card key={i} className="bg-card">
                <CardHeader>
                  <Skeleton className="h-6 w-32" />
                </CardHeader>
                <CardContent className="space-y-3">
                  {[...Array(5)].map((_, j) => (
                    <div key={j} className="flex items-center justify-between p-3 bg-muted/20 rounded-lg">
                      <div className="flex items-center gap-3">
                        <Skeleton className="w-4 h-4" />
                        <Skeleton className="w-8 h-8 rounded-full" />
                        <Skeleton className="h-4 w-20" />
                      </div>
                      <Skeleton className="h-4 w-16" />
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </Layout>
    );
  }

  const topBrands = getTopBrands();
  const nearestCompetitors = getNearestCompetitors();
  const upcomingBrands = getUpcomingBrands();

  return (
    <TooltipProvider>
      <Layout>
        <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
          <div className="container mx-auto p-6">
            {showTrialBanner && (
              <TrialBanner daysRemaining={competitorAccess.daysRemainingInTrial!} />
            )}
            
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
              <div className="space-y-2">
                <h1 className="text-3xl font-bold text-foreground">Brand Competition</h1>
                <p className="text-muted-foreground">Competition analysis for {orgName}</p>
              </div>
              
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="bg-card text-sm px-3 py-1">
                  <BarChart3 className="h-4 w-4 mr-1" />
                  {competitorData.length} tracked
                </Badge>
                
                <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="shadow-sm">
                      <Plus className="h-4 w-4 mr-2" />
                      Track Competitor
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>Track New Competitor</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Input
                          placeholder="Enter competitor name (e.g., Asana, Monday.com)"
                          value={newCompetitorName}
                          onChange={(e) => setNewCompetitorName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleAddCompetitor();
                            }
                          }}
                        />
                        <p className="text-xs text-muted-foreground mt-2">
                          We'll monitor this competitor in future prompt responses
                        </p>
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button 
                          variant="outline" 
                          onClick={() => setAddDialogOpen(false)}
                        >
                          Cancel
                        </Button>
                        <Button 
                          onClick={handleAddCompetitor}
                          disabled={!newCompetitorName.trim()}
                        >
                          Track Competitor
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            {/* Three Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Top Brands */}
              <Card className="bg-card/80 backdrop-blur-sm border shadow-sm">
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-amber-600" />
                    <CardTitle className="text-lg font-semibold">Top Brands</CardTitle>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="w-4 h-4 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Brands with highest visibility scores in AI responses</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {topBrands.map((competitor, index) => (
                    <CompetitorRow key={competitor.id} competitor={competitor} rank={index + 1} />
                  ))}
                </CardContent>
              </Card>

              {/* Nearest Competitors */}
              <Card className="bg-card/80 backdrop-blur-sm border shadow-sm">
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-2">
                    <Target className="w-5 h-5 text-blue-600" />
                    <CardTitle className="text-lg font-semibold">Nearest Competitors</CardTitle>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="w-4 h-4 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Direct competitors in your market space</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {nearestCompetitors.map((competitor, index) => (
                    <CompetitorRow key={competitor.id} competitor={competitor} rank={index + 1} />
                  ))}
                </CardContent>
              </Card>

              {/* Up and Coming Brands */}
              <Card className="bg-card/80 backdrop-blur-sm border shadow-sm">
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-2">
                    <Zap className="w-5 h-5 text-green-600" />
                    <CardTitle className="text-lg font-semibold">Up and Coming Brands</CardTitle>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="w-4 h-4 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Emerging competitors with growing visibility</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {upcomingBrands.map((competitor, index) => (
                    <CompetitorRow key={competitor.id} competitor={competitor} rank={index + 1} />
                  ))}
                </CardContent>
              </Card>
            </div>

            {/* User-Tracked Competitors Section */}
            {trackedCompetitors.length > 0 && (
              <div className="mt-8">
                <div className="flex items-center gap-2 mb-4">
                  <Eye className="w-5 h-5 text-purple-600" />
                  <h2 className="text-xl font-semibold text-foreground">Your Tracked Competitors</h2>
                  <Badge variant="secondary" className="text-xs px-2 py-1">
                    {trackedCompetitors.length} tracked
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mb-6">
                  Competitors you've manually added for monitoring. These will appear when mentioned in AI responses.
                </p>
                
                <Card className="bg-card/80 backdrop-blur-sm border shadow-sm">
                  <CardContent className="pt-6">
                    <div className="grid gap-3">
                      {trackedCompetitors.map((competitor) => (
                        <div 
                          key={competitor.id} 
                          className="flex items-center justify-between p-4 bg-muted/20 rounded-lg hover:bg-muted/30 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <BrandLogo brandName={competitor.name} />
                            <div>
                              <p className="font-medium text-foreground">{competitor.name}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <p className="text-xs text-muted-foreground">
                                  Added {new Date(competitor.first_detected_at).toLocaleDateString()}
                                </p>
                                <Badge variant="outline" className="text-xs px-2 py-0.5">
                                  <AlertCircle className="w-3 h-3 mr-1" />
                                  Awaiting detection
                                </Badge>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleRemoveCompetitor(competitor.id)}
                                  className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Remove from tracking</p>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </div>
      </Layout>
    </TooltipProvider>
  );
}
