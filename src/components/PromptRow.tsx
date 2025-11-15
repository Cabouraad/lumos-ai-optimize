import { useState, memo, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ProviderResponseCard } from './ProviderResponseCard';
import { PromptTopCitations } from './PromptTopCitations';
import { ClusterTagBadge } from './prompts/ClusterTagBadge';
import { PerformanceBadge } from './prompts/PerformanceBadge';
import { ProviderStatusBar } from './prompts/ProviderStatusBar';
import { InlineCitationPreview } from './prompts/InlineCitationPreview';
import { ScoreBreakdownTooltip } from './prompts/ScoreBreakdownTooltip';
import { useSubscriptionGate } from '@/hooks/useSubscriptionGate';
import { getAllowedProviders } from '@/lib/providers/tier-policy';
import { getPromptCategory, getCategoryColor } from '@/lib/prompt-utils';
import { 
  Calendar, 
  BarChart3, 
  Trash2,
  ChevronDown,
  ChevronRight,
  Pause,
  Play,
  TrendingUp,
  Target,
  Users,
  Tag,
  ExternalLink
} from 'lucide-react';
import { format } from 'date-fns';

interface PromptWithStats {
  id: string;
  text: string;
  active: boolean;
  created_at: string;
  runs_7d?: number;
  avg_score_7d?: number;
  cluster_tag?: string | null;
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

const PromptRowComponent = ({ 
  prompt, 
  promptDetails,
  onEdit, 
  onToggleActive,
  onDeletePrompt,
  onDuplicatePrompt,
  isSelected,
  onSelect
}: PromptRowProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const { limits, currentTier } = useSubscriptionGate();
  const navigate = useNavigate();


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

  // Calculate performance based on date range or default 7 days
  const performance = useMemo(() => {
    if (!promptDetails?.providers) return { avgScore: 0, totalRuns: 0, trend: 0, brandVisible: 0, competitorCount: 0 };
    
    // Use date range from promptDetails if available, otherwise default to 7 days
    const dateRange = (promptDetails as any).dateRange;
    const periodStart = dateRange?.from || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const periodEnd = dateRange?.to || new Date();
    
    const providers = Object.values(promptDetails.providers);
    
    let totalScore = 0;
    let totalRuns = 0;
    let validScores = 0;
    let brandVisibleCount = 0;
    let totalCompetitors = 0;
    
    providers.forEach((providerVal: any) => {
      // Handle both single responses and arrays
      const responses = Array.isArray(providerVal) ? providerVal : (providerVal ? [providerVal] : []);
      
      responses.forEach((provider: any) => {
        if ((provider?.status === 'completed' || provider?.status === 'success') && provider.run_at) {
          const runDate = new Date(provider.run_at);
          if (runDate >= periodStart && runDate <= periodEnd) {
            totalRuns++;
            if (typeof provider.score === 'number') {
              totalScore += provider.score;
              validScores++;
            }
          }
          
          // Count current brand visibility and competitors
          if (provider.org_brand_present) {
            brandVisibleCount++;
          }
          if (provider.competitors_count) {
            totalCompetitors += provider.competitors_count;
          }
        }
      });
    });
    
    return {
      avgScore: validScores > 0 ? totalScore / validScores : 0,
      totalRuns,
      trend: promptDetails.trend || 0,
      brandVisible: brandVisibleCount,
      competitorCount: totalCompetitors
    };
  }, [promptDetails]);

  const category = useMemo(() => getPromptCategory(prompt.text), [prompt.text]);

  // Calculate competitor overlap
  const competitorOverlap = useMemo(() => {
    if (!promptDetails?.providers) return 0;
    const providers = Object.values(promptDetails.providers);
    const competitorSets = providers
      .map((p: any) => {
        const responses = Array.isArray(p) ? p : (p ? [p] : []);
        const latest = responses.find((r: any) => r?.status === 'completed' || r?.status === 'success');
        return latest?.competitors_json || [];
      })
      .filter((comps: any[]) => comps.length > 0);
    
    if (competitorSets.length < 2) return 0;
    
    // Find competitors that appear in multiple providers
    const allCompetitors = competitorSets.flat();
    const competitorCounts = new Map<string, number>();
    allCompetitors.forEach((comp: any) => {
      const name = comp?.name || comp;
      competitorCounts.set(name, (competitorCounts.get(name) || 0) + 1);
    });
    
    return Array.from(competitorCounts.values()).filter(count => count > 1).length;
  }, [promptDetails]);

  const handleRowClick = (e: React.MouseEvent) => {
    // Don't navigate if clicking on interactive elements
    const target = e.target as HTMLElement;
    if (
      target.closest('button') || 
      target.closest('input[type="checkbox"]') ||
      target.closest('[role="button"]')
    ) {
      return;
    }
    navigate(`/prompts/${prompt.id}`);
  };

  return (
    <Card 
      className="hover:bg-muted/30 transition-all duration-150 cursor-pointer border-l-2 border-l-transparent hover:border-l-primary"
      onClick={handleRowClick}
    >
      <CardContent className="p-3">
        <div className="flex items-start gap-3">
          {/* Selection checkbox */}
          <Checkbox
            checked={isSelected}
            onCheckedChange={onSelect}
            className="transition-smooth mt-0.5"
          />

          {/* Main content */}
          <div className="flex-1 min-w-0">
            {/* Condensed Prompt Row */}
            <div className="flex items-center justify-between gap-4">
              {/* Prompt Text */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium leading-relaxed line-clamp-1 mb-1">
                  {prompt.text}
                </p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{format(new Date(prompt.created_at), 'MMM d, yyyy')}</span>
                  {prompt.cluster_tag && (
                    <>
                      <span>•</span>
                      <ClusterTagBadge tag={prompt.cluster_tag} />
                    </>
                  )}
                </div>
              </div>

              {/* Visibility Score */}
              <div className="text-center w-20 shrink-0">
                <ScoreBreakdownTooltip 
                  providers={promptDetails?.providers || {}}
                  avgScore={performance.avgScore}
                >
                  <div className="cursor-help">
                    <div className="text-xs text-muted-foreground mb-0.5">Score</div>
                    <div className="text-lg font-bold">
                      {(performance.avgScore * 10).toFixed(1)}%
                    </div>
                  </div>
                </ScoreBreakdownTooltip>
              </div>

              {/* Runs */}
              <div className="text-center w-16 shrink-0">
                <div className="text-xs text-muted-foreground mb-0.5">Runs</div>
                <div className="text-base font-semibold">{performance.totalRuns}</div>
              </div>

              {/* Brand Found */}
              <div className="text-center w-24 shrink-0">
                <div className="text-xs text-muted-foreground mb-0.5">Brand</div>
                <Badge 
                  variant="outline" 
                  className={`text-xs ${performance.brandVisible > 0 ? 'bg-success/10 text-success border-success/20' : 'bg-muted text-muted-foreground'}`}
                >
                  {performance.brandVisible > 0 ? 'Yes' : 'No'}
                </Badge>
              </div>

              {/* Competitors */}
              <div className="text-center w-24 shrink-0">
                <div className="text-xs text-muted-foreground mb-0.5">Competitors</div>
                <div className="text-base font-semibold text-warning">
                  {performance.competitorCount}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/prompts/${prompt.id}`);
                  }}
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </Button>
                
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleActive();
                  }}
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2"
                >
                  {prompt.active ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                </Button>

                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete();
                  }}
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>

          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Memoized export for performance
export const PromptRow = memo(PromptRowComponent);