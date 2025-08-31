import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ProviderResponseCard } from './ProviderResponseCard';
import { PromptCompetitors } from './PromptCompetitors';
import { 
  Calendar, 
  BarChart3, 
  ChevronDown,
  ChevronRight,
  Pause,
  Play,
  TrendingUp,
  Target,
  Users,
  Clock
} from 'lucide-react';
import { format } from 'date-fns';
import { isFeatureEnabled } from '@/lib/config/feature-flags';

interface PromptWithStats {
  id: string;
  text: string;
  active: boolean;
  created_at: string;
  runs_7d?: number;
  avg_score_7d?: number;
}

interface CondensedPromptRowProps {
  prompt: PromptWithStats;
  promptDetails?: any;
  onEdit: (prompt: PromptWithStats) => void;
  onToggleActive: (promptId: string, active: boolean) => void;
  onDeletePrompt: (promptId: string) => void;
  onDuplicatePrompt: (promptId: string) => void;
  isSelected: boolean;
  onSelect: (checked: boolean) => void;
}

export function CondensedPromptRow({ 
  prompt, 
  promptDetails,
  onEdit, 
  onToggleActive,
  onDeletePrompt,
  onDuplicatePrompt,
  isSelected,
  onSelect
}: CondensedPromptRowProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isCondensedUI = isFeatureEnabled('FEATURE_CONDENSED_UI');
  const showSchedulingNotices = isFeatureEnabled('FEATURE_SCHEDULING_NOTICES');

  const handleToggleActive = () => {
    onToggleActive(prompt.id, !prompt.active);
  };

  // Calculate performance metrics
  const calculatePerformance = () => {
    if (!promptDetails?.providers) return { avgScore: 0, totalRuns: 0, brandVisible: 0, competitorCount: 0 };
    
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
        
        if (provider.org_brand_present) brandVisibleCount++;
        if (provider.competitors_count) totalCompetitors += provider.competitors_count;
      }
    });
    
    return {
      avgScore: validScores > 0 ? totalScore / validScores : 0,
      totalRuns,
      brandVisible: brandVisibleCount,
      competitorCount: totalCompetitors
    };
  };

  const performance = calculatePerformance();

  // Render the original PromptRow if condensed UI is disabled
  if (!isCondensedUI) {
    // Import and use the original PromptRow component
    return null; // This would normally return the original PromptRow
  }

  return (
    <Card className="hover:shadow-sm transition-all duration-200 border-l-2 border-l-primary/20">
      {/* Scheduling Notice */}
      {showSchedulingNotices && prompt.active && (
        <div className="px-4 py-2 bg-muted/30 border-b border-border/30">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>Next scheduled run: Today at 3:00 AM ET</span>
            <Badge variant="outline" className="text-xs py-0 px-1">Daily</Badge>
          </div>
        </div>
      )}

      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* Selection checkbox */}
          <div className="pt-0.5">
            <Checkbox
              checked={isSelected}
              onCheckedChange={onSelect}
              className="transition-smooth"
            />
          </div>

          {/* Main content - condensed */}
          <div className="flex-1 min-w-0">
            {/* Condensed header */}
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1 pr-3">
                <p className="text-sm font-medium leading-tight line-clamp-1 mb-1">
                  {prompt.text}
                </p>
                
                {/* Condensed metrics in single row */}
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {format(new Date(prompt.created_at), 'MMM d')}
                  </span>
                  
                  <span className="flex items-center gap-1">
                    <BarChart3 className="h-3 w-3" />
                    {performance.totalRuns}
                  </span>

                  <span className="flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" />
                    {performance.avgScore.toFixed(1)}
                  </span>

                  <span className="flex items-center gap-1">
                    <Target className="h-3 w-3" />
                    {performance.brandVisible}
                  </span>

                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {performance.competitorCount}
                  </span>

                  <Badge 
                    variant="outline" 
                    className={`text-xs px-1.5 py-0 ${prompt.active ? 'bg-success/10 text-success border-success/20' : 'bg-muted text-muted-foreground'}`}
                  >
                    {prompt.active ? 'Active' : 'Paused'}
                  </Badge>
                </div>
              </div>

              {/* Condensed actions */}
              <div className="flex items-center gap-1">
                <Button
                  onClick={handleToggleActive}
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                >
                  {prompt.active ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                </Button>
              </div>
            </div>

            {/* Expand/Collapse Toggle - more compact */}
            {promptDetails && (
              <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
                <CollapsibleTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="w-full justify-center text-xs text-muted-foreground hover:text-foreground h-6 -mt-1"
                  >
                    {isExpanded ? (
                      <>
                        <ChevronDown className="h-3 w-3 mr-1" />
                        Less
                      </>
                    ) : (
                      <>
                        <ChevronRight className="h-3 w-3 mr-1" />
                        Details
                      </>
                    )}
                  </Button>
                </CollapsibleTrigger>

                <CollapsibleContent className="space-y-3 mt-3">
                  {/* Provider Response Cards - more compact */}
                  {promptDetails?.providers && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-medium text-muted-foreground border-b border-border/30 pb-1">
                        Provider Results
                      </h4>
                      <div className="grid gap-2">
                        {Object.entries(promptDetails.providers).map(([provider, response]: [string, any]) => (
                          response && (
                            <div key={provider} className="text-xs">
                              <ProviderResponseCard
                                provider={provider as "openai" | "gemini" | "perplexity"}
                                response={response}
                                promptText={prompt.text}
                              />
                            </div>
                          )
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Competitors Section - compact */}
                  <div className="border-t border-border/30 pt-3">
                    <PromptCompetitors promptId={prompt.id} />
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