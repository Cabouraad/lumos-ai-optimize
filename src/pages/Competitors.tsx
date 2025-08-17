import React, { useEffect, useState } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { getOrgId } from '@/lib/auth';
import { 
  Users, 
  TrendingUp, 
  Trophy, 
  Target, 
  Zap, 
  Plus, 
  X, 
  Calendar, 
  BarChart3,
  Eye,
  Sparkles
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
  trend?: number; // 7-day change
  isManuallyAdded?: boolean;
}

interface CompetitorSection {
  title: string;
  icon: React.ReactNode;
  description: string;
  brands: CompetitorBrand[];
  emptyMessage: string;
}

export default function Competitors() {
  const [topBrands, setTopBrands] = useState<CompetitorBrand[]>([]);
  const [nearestCompetitors, setNearestCompetitors] = useState<CompetitorBrand[]>([]);
  const [upcomingBrands, setUpcomingBrands] = useState<CompetitorBrand[]>([]);
  const [loading, setLoading] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newCompetitorName, setNewCompetitorName] = useState('');
  const [orgAverageScore, setOrgAverageScore] = useState<number>(0);
  const { toast } = useToast();

  useEffect(() => {
    fetchCompetitorData();
  }, []);

  const calculateTrend = (lastSeenAt: string, firstDetectedAt: string, totalAppearances: number): number => {
    // Simple trend calculation - this could be enhanced with actual 7-day data tracking
    const daysSinceFirst = Math.max(1, Math.ceil((new Date().getTime() - new Date(firstDetectedAt).getTime()) / (1000 * 60 * 60 * 24)));
    const daysSinceLast = Math.ceil((new Date().getTime() - new Date(lastSeenAt).getTime()) / (1000 * 60 * 60 * 24));
    
    // Brands seen recently with good appearance rate = trending up
    if (daysSinceLast <= 7 && totalAppearances / daysSinceFirst > 0.1) {
      return totalAppearances / Math.max(daysSinceFirst, 1) * 10; // Scale for visibility
    }
    return totalAppearances / Math.max(daysSinceFirst, 1);
  };

  const fetchCompetitorData = async () => {
    try {
      setLoading(true);
      const orgId = await getOrgId();

      // Get organization's average brand visibility score
      const { data: orgBrandData } = await supabase
        .from('brand_catalog')
        .select('average_score')
        .eq('org_id', orgId)
        .eq('is_org_brand', true);

      const orgAvg = orgBrandData?.length > 0 
        ? orgBrandData.reduce((sum, brand) => sum + (brand.average_score || 0), 0) / orgBrandData.length
        : 5; // Default if no org brand data
      
      setOrgAverageScore(orgAvg);

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
        isManuallyAdded: (comp.total_appearances || 0) === 0
      }));

      // Sort into categories
      
      // Top Brands - by total appearances
      const top = competitors
        .filter(c => c.totalAppearances > 0)
        .sort((a, b) => b.totalAppearances - a.totalAppearances)
        .slice(0, 8);
      setTopBrands(top);

      // Nearest Competitors - by score proximity to org average
      const nearest = competitors
        .filter(c => c.averageScore > 0)
        .sort((a, b) => Math.abs(a.averageScore - orgAvg) - Math.abs(b.averageScore - orgAvg))
        .slice(0, 8);
      setNearestCompetitors(nearest);

      // Up and Coming Brands - by trend calculation
      const upcoming = competitors
        .filter(c => c.trend && c.trend > 0.1) // Only brands with meaningful trend
        .sort((a, b) => (b.trend || 0) - (a.trend || 0))
        .slice(0, 8);
      setUpcomingBrands(upcoming);

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
      
      // Check if competitor already exists
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

  const getScoreColor = (score: number) => {
    if (score >= 8) return 'text-green-600 bg-green-50 border-green-200';
    if (score >= 5) return 'text-amber-600 bg-amber-50 border-amber-200';
    return 'text-red-600 bg-red-50 border-red-200';
  };

  const getTrendColor = (trend: number) => {
    if (trend > 1) return 'text-green-600';
    if (trend > 0.5) return 'text-amber-600';
    return 'text-gray-500';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  const CompetitorCard = ({ competitor, showTrend = false }: { competitor: CompetitorBrand; showTrend?: boolean }) => (
    <div className="bg-white rounded-xl border border-gray-100 p-4 hover:shadow-md transition-all duration-200">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-gray-900">{competitor.name}</h3>
            {competitor.isManuallyAdded && (
              <Badge variant="outline" className="text-xs">Manual</Badge>
            )}
          </div>
          <div className="flex items-center gap-3 text-sm text-gray-600">
            <div className="flex items-center gap-1">
              <Eye className="h-3 w-3" />
              <span>{competitor.totalAppearances}</span>
            </div>
            {competitor.averageScore > 0 && (
              <Badge className={`text-xs px-2 py-1 border ${getScoreColor(competitor.averageScore)}`}>
                {competitor.averageScore.toFixed(1)}/10
              </Badge>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-1">
          {showTrend && competitor.trend && (
            <div className={`flex items-center gap-1 text-xs ${getTrendColor(competitor.trend)}`}>
              <TrendingUp className="h-3 w-3" />
              <span>{competitor.trend.toFixed(1)}</span>
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleRemoveCompetitor(competitor.id, competitor.name)}
            className="h-6 w-6 p-0 text-gray-400 hover:text-red-500"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>
      
      <div className="flex items-center gap-4 text-xs text-gray-500">
        <div className="flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          <span>Last: {formatDate(competitor.lastSeenAt)}</span>
        </div>
      </div>
    </div>
  );

  const CompetitorSection = ({ section }: { section: CompetitorSection }) => (
    <Card className="shadow-soft rounded-2xl border-0">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3 mb-2">
          {section.icon}
          <CardTitle className="text-xl">{section.title}</CardTitle>
        </div>
        <p className="text-sm text-gray-600">{section.description}</p>
      </CardHeader>
      <CardContent>
        {section.brands.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2">
            {section.brands.map((brand) => (
              <CompetitorCard 
                key={brand.id} 
                competitor={brand} 
                showTrend={section.title.includes('Up and Coming')}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
              {section.icon}
            </div>
            <p className="text-sm">{section.emptyMessage}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );

  const sections: CompetitorSection[] = [
    {
      title: "Top Brands",
      icon: <Trophy className="h-5 w-5 text-amber-600" />,
      description: "Brands that appear most frequently in your tracked prompts",
      brands: topBrands,
      emptyMessage: "No frequently appearing brands detected yet. Run more prompts to see top performers."
    },
    {
      title: "Nearest Competitors", 
      icon: <Target className="h-5 w-5 text-blue-600" />,
      description: `Competitors with visibility scores closest to your brand (${orgAverageScore.toFixed(1)}/10)`,
      brands: nearestCompetitors,
      emptyMessage: "No competitors with similar visibility scores found yet."
    },
    {
      title: "Up and Coming Brands",
      icon: <Zap className="h-5 w-5 text-green-600" />,
      description: "Brands with the greatest increase in visibility over the past 7 days",
      brands: upcomingBrands,
      emptyMessage: "No trending brands detected. Check back after running more prompts over time."
    }
  ];

  if (loading) {
    return (
      <Layout>
        <div className="min-h-screen bg-gray-50 p-6">
          <div className="max-w-7xl mx-auto space-y-8">
            {/* Header Skeleton */}
            <div className="space-y-2">
              <Skeleton className="h-9 w-48" />
              <Skeleton className="h-5 w-96" />
            </div>

            {/* Section Skeletons */}
            {[...Array(3)].map((_, i) => (
              <Card key={i} className="shadow-soft rounded-2xl border-0">
                <CardHeader>
                  <Skeleton className="h-6 w-32" />
                  <Skeleton className="h-4 w-64" />
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3 md:grid-cols-2">
                    {[...Array(4)].map((_, j) => (
                      <Skeleton key={j} className="h-24 w-full" />
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen bg-gray-50">
        <div className="p-6">
          <div className="max-w-7xl mx-auto space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <h1 className="text-4xl font-display font-bold text-gray-900">Competitor Intelligence</h1>
                <p className="text-lg text-gray-600">
                  Track and analyze competitive landscape from AI search results
                </p>
              </div>

              <div className="flex items-center gap-3">
                <Badge variant="outline" className="bg-white text-sm px-3 py-1">
                  <BarChart3 className="h-4 w-4 mr-1" />
                  {topBrands.length + nearestCompetitors.length + upcomingBrands.length} tracked
                </Badge>
                
                <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="bg-primary hover:bg-primary-hover shadow-soft">
                      <Plus className="h-4 w-4 mr-2" />
                      Track Competitor
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="rounded-2xl max-w-md">
                    <DialogHeader>
                      <DialogTitle className="text-xl">Track New Competitor</DialogTitle>
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
                          className="rounded-xl"
                        />
                        <p className="text-xs text-gray-500 mt-2">
                          We'll monitor this competitor in future prompt responses
                        </p>
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button 
                          variant="outline" 
                          onClick={() => setAddDialogOpen(false)}
                          className="rounded-xl"
                        >
                          Cancel
                        </Button>
                        <Button 
                          onClick={handleAddCompetitor}
                          disabled={!newCompetitorName.trim()}
                          className="rounded-xl"
                        >
                          Track Competitor
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            {/* Stats Overview */}
            <div className="grid md:grid-cols-3 gap-6">
              <Card className="shadow-soft rounded-2xl border-0 bg-gradient-to-r from-amber-50 to-orange-50">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-100 rounded-xl">
                      <Trophy className="h-6 w-6 text-amber-600" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-amber-900">{topBrands.length}</div>
                      <div className="text-sm text-amber-700">Top Brands</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="shadow-soft rounded-2xl border-0 bg-gradient-to-r from-blue-50 to-indigo-50">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-xl">
                      <Target className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-blue-900">{nearestCompetitors.length}</div>
                      <div className="text-sm text-blue-700">Nearest Competitors</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="shadow-soft rounded-2xl border-0 bg-gradient-to-r from-green-50 to-emerald-50">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-100 rounded-xl">
                      <Sparkles className="h-6 w-6 text-green-600" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-green-900">{upcomingBrands.length}</div>
                      <div className="text-sm text-green-700">Up & Coming</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Competitor Sections */}
            <div className="space-y-8">
              {sections.map((section, index) => (
                <CompetitorSection key={index} section={section} />
              ))}
            </div>

            {/* Empty State for All Sections */}
            {topBrands.length === 0 && nearestCompetitors.length === 0 && upcomingBrands.length === 0 && (
              <Card className="shadow-soft rounded-2xl border-0">
                <CardContent className="text-center py-12">
                  <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                    <Users className="h-8 w-8 text-gray-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">
                    Start Building Your Competitive Intelligence
                  </h3>
                  <p className="text-gray-600 mb-6 max-w-md mx-auto">
                    Run prompts to automatically discover competitors, or manually add competitors you want to track.
                  </p>
                  <div className="flex items-center justify-center gap-3">
                    <Button onClick={() => setAddDialogOpen(true)} className="bg-primary hover:bg-primary-hover">
                      <Plus className="h-4 w-4 mr-2" />
                      Track Your First Competitor
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}