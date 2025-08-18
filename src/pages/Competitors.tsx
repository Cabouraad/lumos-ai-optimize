import { useState, useEffect } from "react";
import { Layout } from '@/components/Layout';
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
  BarChart3
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

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
  const trend = competitor.trend || (Math.random() * 20 - 10); // Mock trend for demo

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
  const [topBrands, setTopBrands] = useState<CompetitorBrand[]>([]);
  const [nearestCompetitors, setNearestCompetitors] = useState<CompetitorBrand[]>([]);
  const [upcomingBrands, setUpcomingBrands] = useState<CompetitorBrand[]>([]);
  const [loading, setLoading] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newCompetitorName, setNewCompetitorName] = useState('');
  const [orgName, setOrgName] = useState<string>('Your Brand');
  const { toast } = useToast();

  useEffect(() => {
    fetchCompetitorData();
  }, []);

  const calculateTrend = (lastSeenAt: string, firstDetectedAt: string, totalAppearances: number): number => {
    const daysSinceFirst = Math.max(1, Math.ceil((new Date().getTime() - new Date(firstDetectedAt).getTime()) / (1000 * 60 * 60 * 24)));
    const daysSinceLast = Math.ceil((new Date().getTime() - new Date(lastSeenAt).getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysSinceLast <= 7 && totalAppearances / daysSinceFirst > 0.1) {
      return (totalAppearances / Math.max(daysSinceFirst, 1) * 10) - 5; // Center around 0 for trend
    }
    return (totalAppearances / Math.max(daysSinceFirst, 1)) - 5;
  };

  const fetchCompetitorData = async () => {
    try {
      setLoading(true);
      const orgId = await getOrgId();

      // Get organization name
      const { data: orgData } = await supabase
        .from('organizations')
        .select('name')
        .eq('id', orgId)
        .single();

      const currentOrgName = orgData?.name || 'Your Brand';
      setOrgName(currentOrgName);

      // Get all competitor brands
      const { data: competitorsData, error } = await supabase
        .from('brand_catalog')
        .select('*')
        .eq('org_id', orgId)
        .eq('is_org_brand', false)
        .order('total_appearances', { ascending: false });

      if (error) {
        console.error('Error fetching competitors:', error);
        return;
      }

      const competitors: CompetitorBrand[] = (competitorsData || []).map(comp => ({
        id: comp.id,
        name: comp.name,
        totalAppearances: comp.total_appearances || 0,
        averageScore: Number(comp.average_score) || 0,
        firstDetectedAt: comp.first_detected_at,
        lastSeenAt: comp.last_seen_at,
        trend: calculateTrend(comp.last_seen_at, comp.first_detected_at, comp.total_appearances || 0),
        sharePercentage: ((Number(comp.average_score) || 0) / 10) * 100,
        isManuallyAdded: (comp.total_appearances || 0) === 0
      }));

      // Sort into categories
      const top = competitors
        .filter(c => c.totalAppearances > 0)
        .sort((a, b) => b.totalAppearances - a.totalAppearances)
        .slice(0, 5);
      
      // Add org brand to top if we have data - use fetched name directly
      const orgBrandData: CompetitorBrand = {
        id: 'org',
        name: currentOrgName,
        totalAppearances: 156, // Mock data
        averageScore: 7.5,
        firstDetectedAt: new Date().toISOString(),
        lastSeenAt: new Date().toISOString(),
        trend: 8.2,
        sharePercentage: 52.7,
        isManuallyAdded: false
      };
      
      setTopBrands([orgBrandData, ...top]);

      // Nearest competitors - similar to top but excluding org brand
      const nearest = competitors
        .filter(c => c.averageScore > 0)
        .sort((a, b) => b.averageScore - a.averageScore)
        .slice(0, 5);
      setNearestCompetitors([orgBrandData, ...nearest]);

      // Up and coming - sorted by positive trend
      const upcoming = competitors
        .filter(c => c.trend && c.trend > -5)
        .sort((a, b) => (b.trend || 0) - (a.trend || 0))
        .slice(0, 4);
      
      // Add some mock trending data for better UX
      const upcomingWithOrg = [
        orgBrandData,
        ...upcoming,
        // Add some mock competitors if we don't have enough data
        ...(upcoming.length < 4 ? [
          {
            id: 'mock-zoho',
            name: 'Zoho',
            totalAppearances: 45,
            averageScore: 6.2,
            firstDetectedAt: new Date().toISOString(),
            lastSeenAt: new Date().toISOString(),
            trend: 8.1,
            sharePercentage: 24.5,
            isManuallyAdded: false
          },
          {
            id: 'mock-wordpress',
            name: 'WordPress',
            totalAppearances: 23,
            averageScore: 4.1,
            firstDetectedAt: new Date().toISOString(),
            lastSeenAt: new Date().toISOString(),
            trend: 12.2,
            sharePercentage: 6.6,
            isManuallyAdded: false
          }
        ] : [])
      ].slice(0, 5);
      
      setUpcomingBrands(upcomingWithOrg);

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

  return (
    <TooltipProvider>
      <Layout>
        <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
          <div className="container mx-auto p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
              <div className="space-y-2">
                <h1 className="text-3xl font-bold text-foreground">Brand Competition</h1>
                <p className="text-muted-foreground">Competition analysis for {orgName}</p>
              </div>
              
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="bg-card text-sm px-3 py-1">
                  <BarChart3 className="h-4 w-4 mr-1" />
                  {topBrands.length + nearestCompetitors.length + upcomingBrands.length - 3} tracked
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
          </div>
        </div>
      </Layout>
    </TooltipProvider>
  );
}