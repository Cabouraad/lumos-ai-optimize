import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Progress } from '@/components/ui/progress';
import { 
  Lightbulb, 
  Users, 
  Target, 
  Sparkles, 
  Check, 
  X, 
  Clock,
  Zap,
  Award,
  TrendingUp,
  Brain,
  Search,
  Database,
  RefreshCw
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { getOrganizationKeywords, updateOrganizationKeywords, type OrganizationKeywords } from '@/lib/org/data';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useBrand } from '@/contexts/BrandContext';

interface Suggestion {
  id: string;
  text: string;
  source: string;
  created_at: string;
  search_volume?: number | null;
}

// Format search volume as human-readable estimate
function formatSearchVolume(volume: number | null | undefined): string {
  if (volume === null || volume === undefined) return 'Est. pending';
  // Google Trends returns 0-100 scale, estimate monthly searches
  // Rough estimate: 100 = ~100K+, 50 = ~10K, 10 = ~1K
  if (volume >= 80) return '100K+ monthly';
  if (volume >= 60) return '50K+ monthly';
  if (volume >= 40) return '10K+ monthly';
  if (volume >= 20) return '5K+ monthly';
  if (volume >= 10) return '1K+ monthly';
  if (volume > 0) return '<1K monthly';
  return 'Low volume';
}

function getVolumeBadgeStyle(volume: number | null | undefined): string {
  if (volume === null || volume === undefined) return 'bg-muted/80 text-muted-foreground border-muted';
  if (volume >= 60) return 'bg-success/20 text-success border-success/30';
  if (volume >= 30) return 'bg-warning/20 text-warning border-warning/30';
  if (volume > 0) return 'bg-primary/20 text-primary border-primary/30';
  return 'bg-muted text-muted-foreground border-muted';
}

// Progress indicator component for prompt generation
function GeneratingProgressCard() {
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  
  const steps = [
    { icon: Brain, label: 'Analyzing your brand context', duration: 2000 },
    { icon: Search, label: 'Researching industry trends', duration: 3000 },
    { icon: Sparkles, label: 'Generating AI prompts', duration: 4000 },
    { icon: TrendingUp, label: 'Fetching search volume data', duration: 3000 },
    { icon: Database, label: 'Saving suggestions', duration: 1000 },
  ];

  useEffect(() => {
    // Animate progress bar
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 95) return prev;
        // Slow down as we get higher
        const increment = prev < 30 ? 3 : prev < 60 ? 2 : prev < 80 ? 1 : 0.5;
        return Math.min(prev + increment, 95);
      });
    }, 200);

    // Cycle through steps
    let stepIndex = 0;
    const stepInterval = setInterval(() => {
      stepIndex = (stepIndex + 1) % steps.length;
      setCurrentStep(stepIndex);
    }, 2500);

    return () => {
      clearInterval(progressInterval);
      clearInterval(stepInterval);
    };
  }, []);

  const CurrentIcon = steps[currentStep].icon;

  return (
    <Card className="shadow-soft rounded-2xl border-0 overflow-hidden bg-gradient-to-br from-primary/5 to-accent/5">
      <CardContent className="p-6">
        <div className="space-y-6">
          {/* Main progress display */}
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center animate-pulse">
                <CurrentIcon className="h-7 w-7 text-primary animate-bounce" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-accent flex items-center justify-center">
                <Clock className="h-3 w-3 text-accent-foreground animate-spin" />
              </div>
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-foreground mb-1">
                Generating Prompt Suggestions
              </h3>
              <p className="text-sm text-muted-foreground transition-all duration-500">
                {steps[currentStep].label}...
              </p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="space-y-2">
            <Progress value={progress} className="h-2" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Processing...</span>
              <span>{Math.round(progress)}%</span>
            </div>
          </div>

          {/* Step indicators */}
          <div className="flex justify-between">
            {steps.map((step, index) => {
              const StepIcon = step.icon;
              const isActive = index === currentStep;
              const isComplete = index < currentStep;
              
              return (
                <div 
                  key={index}
                  className={`flex flex-col items-center gap-1 transition-all duration-300 ${
                    isActive ? 'scale-110' : 'opacity-50'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                    isActive ? 'bg-primary text-primary-foreground' : 
                    isComplete ? 'bg-success/20 text-success' : 
                    'bg-muted text-muted-foreground'
                  }`}>
                    {isComplete ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <StepIcon className={`h-4 w-4 ${isActive ? 'animate-pulse' : ''}`} />
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Helpful tip */}
          <div className="text-xs text-center text-muted-foreground bg-muted/50 rounded-lg p-3">
            <Lightbulb className="h-3 w-3 inline mr-1" />
            This typically takes 15-30 seconds. We're analyzing trends and generating personalized prompts.
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface PromptSuggestionsProps {
  suggestions: Suggestion[];
  loading: boolean;
  generating: boolean;
  onAccept: (suggestionId: string) => void;
  onDismiss: (suggestionId: string) => void;
  onGenerate: () => void;
  onSettingsUpdated?: () => void;
}

export function PromptSuggestions({
  suggestions,
  loading,
  generating,
  onAccept,
  onDismiss,
  onGenerate,
  onSettingsUpdated
}: PromptSuggestionsProps) {
  const { toast } = useToast();
  const { loading: authLoading, user, orgData } = useAuth();
  const { selectedBrand } = useBrand();
  const [orgSettings, setOrgSettings] = useState<OrganizationKeywords>({
    keywords: [],
    products_services: "",
    target_audience: "",
    business_description: "",
    business_city: "",
    business_state: "",
    business_country: "United States",
    enable_localized_prompts: false,
  });
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [backfilling, setBackfilling] = useState(false);

  // Count suggestions with missing search volume
  const missingVolumeCount = suggestions.filter(s => s.search_volume === null || s.search_volume === undefined).length;

  const handleBackfillVolume = async () => {
    try {
      setBackfilling(true);
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) {
        throw new Error('Not authenticated');
      }

      const response = await supabase.functions.invoke('backfill-search-volume', {
        body: { 
          brandId: selectedBrand?.id || null,
          limit: 20 
        },
      });

      if (response.error) {
        throw response.error;
      }

      const result = response.data;
      
      toast({
        title: "Search Volume Updated",
        description: result.message || `Updated ${result.updated} suggestions`,
      });

      // Trigger a refresh of suggestions
      onSettingsUpdated?.();
    } catch (error) {
      console.error('Failed to backfill search volume:', error);
      toast({
        title: "Error",
        description: "Failed to fetch search volume data",
        variant: "destructive",
      });
    } finally {
      setBackfilling(false);
    }
  };

  useEffect(() => {
    // Wait for auth to be ready and org data to be available
    if (authLoading) return;
    if (!user || !orgData?.organizations?.id) return;
    loadOrgSettings();
  }, [authLoading, user, orgData?.organizations?.id]);

  const loadOrgSettings = async () => {
    try {
      setSettingsLoading(true);
      const data = await getOrganizationKeywords();
      setOrgSettings(data);
    } catch (error) {
      console.error('Failed to load organization settings:', error);
      
      // Only show toast for real errors, not auth-not-ready states
      if (!authLoading && user && orgData?.organizations?.id) {
        toast({
          title: "Error",
          description: "Failed to load organization settings",
          variant: "destructive",
        });
      }
    } finally {
      setSettingsLoading(false);
    }
  };

  const handleToggleLocalization = async (enabled: boolean) => {
    try {
      setSettingsSaving(true);
      const updatedSettings = {
        ...orgSettings,
        enable_localized_prompts: enabled
      };
      
      await updateOrganizationKeywords(updatedSettings);
      setOrgSettings(updatedSettings);
      
      toast({
        title: "Settings Updated",
        description: `Localized prompts ${enabled ? 'enabled' : 'disabled'}`,
      });
      onSettingsUpdated?.();
    } catch (error) {
      console.error('Failed to update localization setting:', error);
      toast({
        title: "Error",
        description: "Failed to update settings",
        variant: "destructive",
      });
    } finally {
      setSettingsSaving(false);
    }
  };
  const getSourceIcon = (source: string) => {
    // Handle enhanced-ai prefixed sources
    const category = source.startsWith('enhanced-ai-') ? source.substring(12) : source;
    
    switch (category) {
      case 'market_research':
      case 'industry':
      case 'gap-analysis': return <Lightbulb className="h-4 w-4 text-chart-4" />;
      case 'competitor_analysis':
      case 'competitors':
      case 'competitor-defense': return <Users className="h-4 w-4 text-chart-5" />;
      case 'brand_visibility':
      case 'gap':
      case 'comparison':
      case 'long-tail': return <Target className="h-4 w-4 text-warning" />;
      case 'local-discovery':
      case 'local-recommendations':
      case 'geographic-targeting': return <Target className="h-4 w-4 text-primary" />;
      case 'area-comparison':
      case 'local-problem-solving': return <Users className="h-4 w-4 text-primary" />;
      case 'problem-solving': return <Zap className="h-4 w-4 text-success" />;
      default: return <Sparkles className="h-4 w-4 text-success" />;
    }
  };

  const getSourceColor = (source: string) => {
    // Handle enhanced-ai prefixed sources
    const category = source.startsWith('enhanced-ai-') ? source.substring(12) : source;
    
    switch (category) {
      case 'market_research':
      case 'industry':
      case 'gap-analysis': return 'bg-warning/10 text-warning border-warning/20';
      case 'competitor_analysis':
      case 'competitors':
      case 'competitor-defense': return 'bg-secondary/10 text-secondary border-secondary/20';
      case 'brand_visibility':
      case 'gap':
      case 'comparison':
      case 'long-tail': return 'bg-accent/10 text-accent border-accent/20';
      case 'local-discovery':
      case 'local-recommendations':
      case 'geographic-targeting': return 'bg-primary/10 text-primary border-primary/20';
      case 'area-comparison':
      case 'local-problem-solving': return 'bg-primary/10 text-primary border-primary/20';
      case 'problem-solving': return 'bg-success/10 text-success border-success/20';
      default: return 'bg-success/10 text-success border-success/20';
    }
  };

  const getSourceDisplayName = (source: string) => {
    // Handle enhanced-ai prefixed sources
    const category = source.startsWith('enhanced-ai-') ? source.substring(12) : source;
    
    switch (category) {
      case 'market_research': return 'Market Research';
      case 'competitor_analysis': return 'Competitor Analysis';  
      case 'brand_visibility': return 'Brand Visibility';
      case 'industry': return 'Industry';
      case 'competitors': return 'Competitors';
      case 'gap': return 'Gap Analysis';
      case 'gap-analysis': return 'Gap Analysis';
      case 'competitor-defense': return 'Competitor Defense';
      case 'long-tail': return 'Long-tail Opportunity';
      case 'comparison': return 'Comparison';
      case 'problem-solving': return 'Problem Solving';
      case 'local-discovery': return 'Local Discovery';
      case 'area-comparison': return 'Area Comparison';
      case 'local-recommendations': return 'Local Recommendations';
      case 'geographic-targeting': return 'Geographic Targeting';
      case 'local-problem-solving': return 'Local Problem Solving';
      default: return source.charAt(0).toUpperCase() + source.slice(1);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {/* Header skeleton */}
        <Card className="shadow-soft rounded-2xl border-0">
          <CardHeader>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-96" />
          </CardHeader>
        </Card>
        
        {/* Suggestion skeletons */}
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="shadow-soft rounded-2xl border-0">
            <CardContent className="p-6">
              <Skeleton className="h-20 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Localization Settings */}
      <Card className="shadow-soft rounded-2xl border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Prompt Generation Settings
          </CardTitle>
          <CardDescription>
            Configure how prompts are created for your business
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 bg-primary/5 rounded-lg border border-primary/20">
            <div className="space-y-1">
              <Label htmlFor="enable-localized-prompts" className="text-sm font-medium">
                Enable Localized Prompts
              </Label>
               <p className="text-xs text-muted-foreground">
                 Generate location-specific prompts (e.g., "best shops in {orgSettings.business_state || 'your state'}" vs "best shops")
               </p>
              {!orgSettings.business_city && !orgSettings.business_state && (
                <p className="text-xs text-warning">
                  Add your business location in Business Context to enable this feature
                </p>
              )}
            </div>
            <Switch
              id="enable-localized-prompts"
              checked={orgSettings.enable_localized_prompts}
              onCheckedChange={handleToggleLocalization}
              disabled={settingsSaving || (!orgSettings.business_city && !orgSettings.business_state)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Header Card */}
      <Card className="shadow-soft rounded-2xl border-0">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Sparkles className="h-6 w-6 text-accent" />
                Prompt Suggestions
              </CardTitle>
              <CardDescription className="mt-2">
                {suggestions.length > 0 
                  ? "Smart recommendations to improve your search visibility"
                  : "Get intelligent prompt suggestions tailored to your brand and industry"}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {/* Backfill button - show when there are suggestions with missing volume */}
              {missingVolumeCount > 0 && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        onClick={handleBackfillVolume}
                        disabled={backfilling || generating}
                        className="border-primary/20"
                      >
                        {backfilling ? (
                          <>
                            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                            Fetching...
                          </>
                        ) : (
                          <>
                            <TrendingUp className="mr-2 h-4 w-4" />
                            Fetch Volume ({missingVolumeCount})
                          </>
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Fetch search volume data for {missingVolumeCount} suggestions</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              <Button
                onClick={onGenerate}
                disabled={generating || backfilling}
                className="bg-accent hover:bg-accent/90 text-accent-foreground shadow-soft"
              >
                {generating ? (
                  <>
                    <Clock className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    {suggestions.length > 0 ? 'Generate More' : 'Generate Suggestions'}
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Progress Indicator when generating */}
      {generating && (
        <GeneratingProgressCard />
      )}

      {suggestions.length > 0 ? (
        <div className="space-y-4">
          {suggestions.map((suggestion) => (
            <Card key={suggestion.id} className="shadow-soft rounded-2xl border-0 overflow-hidden">
              <CardContent className="p-6">
                <div className="flex items-start justify-between gap-6">
                  <div className="flex-1 space-y-3">
                    {/* Source and metadata */}
                    <div className="flex items-center gap-3 flex-wrap">
                      {getSourceIcon(suggestion.source)}
                      <Badge 
                        variant="outline" 
                        className={`text-xs capitalize ${getSourceColor(suggestion.source)}`}
                      >
                        {getSourceDisplayName(suggestion.source)}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(suggestion.created_at).toLocaleDateString()}
                      </span>
                      {/* Search volume indicator - always shown */}
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge 
                              variant="outline" 
                              className={`text-xs flex items-center gap-1 font-medium ${getVolumeBadgeStyle(suggestion.search_volume)}`}
                            >
                              <TrendingUp className="h-3 w-3" />
                              {formatSearchVolume(suggestion.search_volume)}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>
                              {suggestion.search_volume === null || suggestion.search_volume === undefined 
                                ? 'Search volume data is being collected'
                                : 'Estimated monthly searches based on Google Trends data'}
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>

                    {/* Suggestion text */}
                    <div className="bg-card rounded-xl p-4 border shadow-soft">
                      <p className="text-sm font-medium text-card-foreground leading-relaxed">
                        {suggestion.text}
                      </p>
                    </div>

                    {/* Source-based insight */}
                    <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg border">
                      <div className="flex items-start gap-2">
                        <Zap className="h-3 w-3 text-primary mt-0.5 flex-shrink-0" />
                        <div>
                          <span className="font-medium text-foreground">Source:</span>
                          <span className="ml-1">
                            {getSourceDisplayName(suggestion.source)} analysis
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2">
                    <Button
                      size="sm"
                      onClick={() => onAccept(suggestion.id)}
                      className="bg-success hover:bg-success/90 text-success-foreground h-8 px-4"
                    >
                      <Check className="mr-1 h-3 w-3" />
                      Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onDismiss(suggestion.id)}
                      className="text-muted-foreground hover:text-foreground hover:bg-muted h-8 px-4"
                    >
                      <X className="mr-1 h-3 w-3" />
                      Dismiss
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        /* Empty State */
        <Card className="shadow-soft rounded-2xl border-0">
          <CardContent className="text-center py-12">
            <div className="max-w-md mx-auto">
              <div className="w-16 h-16 bg-accent/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Award className="h-8 w-8 text-accent" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-3">
                No suggestions yet
              </h3>
              <p className="text-muted-foreground mb-6 leading-relaxed">
                Click "Generate Suggestions" to get smart prompt recommendations 
                tailored to your {orgSettings.enable_localized_prompts ? 'local business area' : 'brand, industry,'} and existing prompt performance.
              </p>
              <div className="grid grid-cols-3 gap-4 text-center">
                {orgSettings.enable_localized_prompts ? (
                  <>
                    <div className="p-3 bg-primary/10 rounded-xl border border-primary/20">
                      <Target className="h-6 w-6 text-primary mx-auto mb-2" />
                      <div className="text-xs font-medium text-foreground">Local Discovery</div>
                      <div className="text-xs text-muted-foreground">Best in your area</div>
                    </div>
                    <div className="p-3 bg-secondary/10 rounded-xl border border-secondary/20">
                      <Users className="h-6 w-6 text-secondary mx-auto mb-2" />
                      <div className="text-xs font-medium text-foreground">Area Comparison</div>
                      <div className="text-xs text-muted-foreground">Regional insights</div>
                    </div>
                    <div className="p-3 bg-success/10 rounded-xl border border-success/20">
                      <Zap className="h-6 w-6 text-success mx-auto mb-2" />
                      <div className="text-xs font-medium text-foreground">Local Solutions</div>
                      <div className="text-xs text-muted-foreground">Location-based help</div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="p-3 bg-warning/10 rounded-xl border border-warning/20">
                      <Lightbulb className="h-6 w-6 text-warning mx-auto mb-2" />
                      <div className="text-xs font-medium text-foreground">Market Research</div>
                      <div className="text-xs text-muted-foreground">Industry insights</div>
                    </div>
                    <div className="p-3 bg-secondary/10 rounded-xl border border-secondary/20">
                      <Users className="h-6 w-6 text-secondary mx-auto mb-2" />
                      <div className="text-xs font-medium text-foreground">Competitor Analysis</div>
                      <div className="text-xs text-muted-foreground">Competitive queries</div>
                    </div>
                    <div className="p-3 bg-accent/10 rounded-xl border border-accent/20">
                      <Target className="h-6 w-6 text-accent mx-auto mb-2" />
                      <div className="text-xs font-medium text-foreground">Brand Visibility</div>
                      <div className="text-xs text-muted-foreground">Visibility opportunities</div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}