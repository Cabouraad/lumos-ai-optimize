import { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ProviderResponseCard } from './ProviderResponseCard';
import { PromptTopCitations } from './PromptTopCitations';
import { useSubscriptionGate } from '@/hooks/useSubscriptionGate';
import { getPromptCategory, getCategoryColor } from '@/lib/prompt-utils';
import { 
  Calendar, 
  BarChart3, 
  Edit,
  Trash2,
  Copy,
  ChevronDown,
  ChevronRight,
  Pause,
  Play,
  TrendingUp,
  Target,
  Users,
  Tag
} from 'lucide-react';
import { format } from 'date-fns';

interface PromptWithStats {
  id: string;
  text: string;
  active: boolean;
  created_at: string;
  runs_7d?: number;
  avg_score_7d?: number;
}

interface PromptRowProps {
  prompt: PromptWithStats;
  promptDetails?: any;
  onEdit: (prompt: PromptWithStats) => void;
  onToggleActive: (promptId: string, active: boolean) => void;
  onDeletePrompt: (promptId: string) => void;
  onDuplicatePrompt: (promptId: string) => void;
  isSelected: boolean;
  onSelect: (checked: boolean) => void;
}

const getScoreColor = (score: number) => {
  if (score >= 7) return 'text-success bg-success/10 border-success/20';
  if (score >= 5) return 'text-warning bg-warning/10 border-warning/20';
  return 'text-destructive bg-destructive/10 border-destructive/20';
};

const getScoreIcon = (score: number) => {
  if (score >= 7) return '🏆';
  if (score >= 5) return '⚡';
  return '📊';
};

export function PromptRow({ 
  prompt, 
  promptDetails,
  onEdit, 
  onToggleActive,
  onDeletePrompt,
  onDuplicatePrompt,
  isSelected,
  onSelect
}: PromptRowProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { limits } = useSubscriptionGate();


  const handleToggleActive = () => {
    onToggleActive(prompt.id, !prompt.active);
  };

  const handleEdit = () => {
    onEdit(prompt);
  };

  const handleDelete = () => {
    onDeletePrompt(prompt.id);
  };

  const handleDuplicate = () => {
    onDuplicatePrompt(prompt.id);
  };

  // Calculate 7-day performance and current stats from provider data
  const calculate7DayPerformance = () => {
    if (!promptDetails?.providers) return { avgScore: 0, totalRuns: 0, trend: 0, brandVisible: 0, competitorCount: 0 };
    
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const providers = Object.values(promptDetails.providers).filter(p => p !== null) as any[];
    
    let totalScore = 0;
    let totalRuns = 0;
    let validScores = 0;
    let brandVisibleCount = 0;
    let totalCompetitors = 0;
    
    providers.forEach((provider: any) => {
      if (provider?.status === 'success' && provider.run_at) {
        const runDate = new Date(provider.run_at);
        if (runDate >= sevenDaysAgo) {
          totalRuns++;
          if (typeof provider.score === 'number') {
            totalScore += provider.score;
            validScores++;
          }
        }
        
        // Count current brand visibility and competitors from latest responses
        if (provider.org_brand_present) {
          brandVisibleCount++;
        }
        if (provider.competitors_count) {
          totalCompetitors += provider.competitors_count;
        }
      }
    });
    
    return {
      avgScore: validScores > 0 ? totalScore / validScores : 0,
      totalRuns,
      trend: promptDetails.trend || 0,
      brandVisible: brandVisibleCount,
      competitorCount: totalCompetitors
    };
  };

  const performance = calculate7DayPerformance();
  const category = getPromptCategory(prompt.text);

  return (
    <Card className="hover:shadow-md transition-all duration-200 border-l-4 border-l-primary/20">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* Selection checkbox */}
          <Checkbox
            checked={isSelected}
            onCheckedChange={onSelect}
            className="transition-smooth mt-0.5"
          />

          {/* Main content */}
          <div className="flex-1 min-w-0">
            {/* Prompt text and basic info */}
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1 pr-4">
                <p className="text-sm font-medium leading-relaxed line-clamp-2 mb-2">
                  {prompt.text}
                </p>
                
                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    <span>Created {format(new Date(prompt.created_at), 'MMM d, yyyy')}</span>
                  </div>
                  
                  <div className="flex items-center gap-1">
                    <BarChart3 className="h-3 w-3" />
                    <span>{performance.totalRuns} runs (7d)</span>
                  </div>

                  <Badge 
                    variant="outline" 
                    className={`text-xs px-2 py-0.5 ${prompt.active ? 'bg-success/10 text-success border-success/20' : 'bg-muted text-muted-foreground'}`}
                  >
                    {prompt.active ? 'Active' : 'Paused'}
                  </Badge>
                </div>
              </div>

              {/* Category and Actions */}
              <div className="flex items-center gap-2">
                <Badge 
                  variant="outline" 
                  className={`text-xs px-2 py-1 ${getCategoryColor(category)}`}
                >
                  <Tag className="h-3 w-3 mr-1" />
                  {category}
                </Badge>
                
                <Button
                  onClick={handleToggleActive}
                  variant="outline"
                  size="sm"
                  className="h-7 px-2"
                >
                  {prompt.active ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                </Button>

                <Button
                  onClick={handleDelete}
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>

            {/* 7-Day Performance Summary - Compact Grid */}
            <div className="grid grid-cols-3 gap-3 p-2.5 bg-muted/30 rounded-lg mb-2">
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mb-1">
                  <TrendingUp className="h-3 w-3" />
                  <span>Avg Score</span>
                </div>
                <div className="text-base font-semibold">
                  {performance.avgScore.toFixed(1)}
                </div>
              </div>
              
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mb-1">
                  <Target className="h-3 w-3" />
                  <span>Brand Visible</span>
                </div>
                <div className="text-base font-semibold text-success">
                  {performance.brandVisible}
                </div>
              </div>
              
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mb-1">
                  <Users className="h-3 w-3" />
                  <span>Competitors</span>
                </div>
                <div className="text-base font-semibold text-warning">
                  {performance.competitorCount}
                </div>
              </div>
            </div>

            {/* Expand/Collapse Toggle */}
            {promptDetails && (
              <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
                <CollapsibleTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="w-full justify-center text-xs text-muted-foreground hover:text-foreground h-6"
                  >
                    {isExpanded ? (
                      <>
                        <ChevronDown className="h-3 w-3 mr-1" />
                        Hide Details
                      </>
                    ) : (
                      <>
                        <ChevronRight className="h-3 w-3 mr-1" />
                        Show Provider Results & Citations
                      </>
                    )}
                  </Button>
                </CollapsibleTrigger>

                <CollapsibleContent className="space-y-4 mt-3">
                  {/* Provider Response Cards */}
                  {promptDetails?.providers && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-medium text-muted-foreground border-b border-border/50 pb-1">
                        Provider Results
                      </h4>
                      <div className="grid gap-2">
                        {Object.entries(promptDetails.providers)
                          .filter(([provider, response]: [string, any]) => {
                            // Filter providers based on subscription tier
                            const { limits } = useSubscriptionGate();
                            const allowedProviders = limits.allowedProviders || [];
                            return response && allowedProviders.includes(provider);
                          })
                          .map(([provider, response]: [string, any]) => (
                            <ProviderResponseCard
                              key={provider}
                              provider={provider as "openai" | "gemini" | "perplexity" | "google_ai_overview"}
                              response={response}
                              promptText={prompt.text}
                            />
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Citations Section */}
                  <div className="border-t border-border/50 pt-3">
                    <PromptTopCitations promptId={prompt.id} />
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}