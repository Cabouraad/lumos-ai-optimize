import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search, ExternalLink, TrendingUp, Activity, LogOut, HelpCircle } from 'lucide-react';
import { useBrands, Brand } from '@/hooks/useBrands';
import { useBrand } from '@/contexts/BrandContext';
import { BrandDisplay } from '@/components/BrandDisplay';
import { Skeleton } from '@/components/ui/skeleton';
import { useBrandVisibilityScores } from '@/hooks/useBrandVisibilityScores';
import { signOutWithCleanup } from '@/lib/auth-cleanup';
import { SupportDialog } from '@/components/SupportDialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useBrandsTour } from '@/hooks/useBrandsTour';

export default function Brands() {
  const navigate = useNavigate();
  const { brands, isLoading } = useBrands();
  const { setSelectedBrand } = useBrand();
  const [searchQuery, setSearchQuery] = useState('');
  const [isSupportDialogOpen, setIsSupportDialogOpen] = useState(false);
  const { TourComponent } = useBrandsTour();

  // Get all brand IDs to fetch visibility scores
  const brandIds = useMemo(() => brands.map(b => b.id), [brands]);
  const { data: visibilityScores = [], isLoading: scoresLoading } = useBrandVisibilityScores(brandIds);

  // Create a map of brand ID to all metrics
  const scoreMap = useMemo(() => {
    const map = new Map<string, typeof visibilityScores[0]>();
    visibilityScores.forEach(score => {
      map.set(score.brandId, score);
    });
    return map;
  }, [visibilityScores]);

  const filteredBrands = brands.filter(brand =>
    brand.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    brand.domain.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleBrandSelect = (brand: Brand) => {
    setSelectedBrand(brand);
    navigate('/dashboard');
  };

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
        <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-start mb-2">
            <div>
              <h1 className="text-4xl font-bold mb-2">Brands</h1>
              <p className="text-muted-foreground">Select a brand to view its dashboard</p>
            </div>
            <div className="flex gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    data-tour="help-button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsSupportDialogOpen(true)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <HelpCircle className="h-4 w-4 mr-2" />
                    Help
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Get support and learn how to use the platform</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => signOutWithCleanup()}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    Sign Out
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Sign out of your account</TooltipContent>
              </Tooltip>
            </div>
          </div>
        </div>

        {/* Search and Create */}
        <div className="flex gap-4 mb-8">
          <Tooltip>
            <TooltipTrigger asChild>
              <div data-tour="search" className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search brands..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </TooltipTrigger>
            <TooltipContent>Search by brand name or domain</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                data-tour="create-brand"
                className="gap-2"
                onClick={() => navigate('/onboarding/brand')}
              >
                <Plus className="h-4 w-4" />
                Create Brand
              </Button>
            </TooltipTrigger>
            <TooltipContent>Add a new brand to track its visibility</TooltipContent>
          </Tooltip>
        </div>

        {/* Brand Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <Skeleton className="h-12 w-12 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-5 w-3/4" />
                      <Skeleton className="h-4 w-full" />
                    </div>
                  </div>
                  <div className="mt-6 space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-2 w-full" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                  <Skeleton className="h-10 w-full mt-4" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredBrands.length === 0 ? (
          <Card className="p-12 text-center">
            <p className="text-muted-foreground mb-4">
              {searchQuery ? 'No brands found matching your search' : 'No brands yet'}
            </p>
            {!searchQuery && (
              <Button onClick={() => navigate('/onboarding/brand')}>
                Create Your First Brand
              </Button>
            )}
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredBrands.map((brand, index) => (
              <Card
                key={brand.id}
                data-tour={index === 0 ? "brand-card" : undefined}
                className="hover:shadow-lg transition-all hover:scale-[1.02] cursor-pointer group"
                onClick={() => handleBrandSelect(brand)}
              >
                <CardContent className="p-6">
                  <div className="flex items-start gap-4 mb-6">
                    <BrandDisplay brandName={brand.name} brandDomain={brand.domain} />
                  </div>

                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                    <ExternalLink className="h-3 w-3" />
                    <span className="truncate">{brand.domain}</span>
                  </div>

                  {/* Metrics Grid */}
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="bg-secondary/50 rounded-lg p-3">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                            <Activity className="h-3 w-3" />
                            <span>Total Prompts</span>
                          </div>
                          <div className="text-lg font-semibold">
                            {scoresLoading ? (
                              <Skeleton className="h-6 w-12" />
                            ) : (
                              scoreMap.get(brand.id)?.totalPrompts || 0
                            )}
                          </div>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>Total number of AI prompts tracked for this brand</TooltipContent>
                    </Tooltip>
                    
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="bg-secondary/50 rounded-lg p-3">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                            <TrendingUp className="h-3 w-3" />
                            <span>Presence Rate</span>
                          </div>
                          <div className="text-lg font-semibold">
                            {scoresLoading ? (
                              <Skeleton className="h-6 w-12" />
                            ) : (
                              `${((scoreMap.get(brand.id)?.brandPresenceRate || 0) * 100).toFixed(1)}%`
                            )}
                          </div>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>Percentage of prompts where your brand appeared</TooltipContent>
                    </Tooltip>
                  </div>

                  {/* Last Activity */}
                  {!scoresLoading && scoreMap.get(brand.id)?.lastActivity && (
                    <div className="text-xs text-muted-foreground mb-4">
                      Last activity: {new Date(scoreMap.get(brand.id)!.lastActivity!).toLocaleDateString()}
                    </div>
                  )}

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="mt-2">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm text-muted-foreground">Visibility Score</span>
                          <span className="text-sm font-medium">
                            {scoresLoading ? (
                              <Skeleton className="h-4 w-12 inline-block" />
                            ) : (
                              `${((scoreMap.get(brand.id)?.score || 0) * 10).toFixed(1)}%`
                            )}
                          </span>
                        </div>
                        <div className="h-2 bg-secondary rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary transition-all"
                            style={{ 
                              width: scoresLoading ? '0%' : `${(scoreMap.get(brand.id)?.score || 0) * 10}%` 
                            }}
                          />
                        </div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>Overall AI visibility performance for this brand</TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        className="w-full mt-6 group-hover:bg-primary/90"
                        onClick={() => handleBrandSelect(brand)}
                      >
                        View Analytics
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>View detailed analytics and insights for this brand</TooltipContent>
                  </Tooltip>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

        <SupportDialog 
          open={isSupportDialogOpen} 
          onOpenChange={setIsSupportDialogOpen} 
        />
        <TourComponent />
      </div>
    </TooltipProvider>
  );
}
