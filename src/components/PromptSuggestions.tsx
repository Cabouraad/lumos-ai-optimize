import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { 
  Lightbulb, 
  Users, 
  Target, 
  Sparkles, 
  Check, 
  X, 
  Clock,
  Zap,
  Award
} from 'lucide-react';
import { getOrganizationKeywords, updateOrganizationKeywords, type OrganizationKeywords } from '@/lib/org/data';
import { useToast } from '@/components/ui/use-toast';

interface Suggestion {
  id: string;
  text: string;
  source: string;
  created_at: string;
}

interface PromptSuggestionsProps {
  suggestions: Suggestion[];
  loading: boolean;
  generating: boolean;
  onAccept: (suggestionId: string) => void;
  onDismiss: (suggestionId: string) => void;
  onGenerate: () => void;
}

export function PromptSuggestions({
  suggestions,
  loading,
  generating,
  onAccept,
  onDismiss,
  onGenerate
}: PromptSuggestionsProps) {
  const { toast } = useToast();
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

  useEffect(() => {
    loadOrgSettings();
  }, []);

  const loadOrgSettings = async () => {
    try {
      setSettingsLoading(true);
      const data = await getOrganizationKeywords();
      setOrgSettings(data);
    } catch (error) {
      console.error('Failed to load organization settings:', error);
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
            <Button
              onClick={onGenerate}
              disabled={generating}
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
        </CardHeader>
      </Card>

      {suggestions.length > 0 ? (
        <div className="space-y-4">
          {suggestions.map((suggestion) => (
            <Card key={suggestion.id} className="shadow-soft rounded-2xl border-0 overflow-hidden">
              <CardContent className="p-6">
                <div className="flex items-start justify-between gap-6">
                  <div className="flex-1 space-y-3">
                    {/* Source and metadata */}
                    <div className="flex items-center gap-3">
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