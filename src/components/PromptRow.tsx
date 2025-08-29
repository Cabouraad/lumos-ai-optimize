
import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { supabase } from '@/integrations/supabase/client';
import { ChevronDown, ChevronRight, PlayCircle, BarChart3, Calendar, Clock, Trophy, Target, Edit2, Copy, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { PromptCompetitors } from '@/components/PromptCompetitors';
import { Checkbox } from '@/components/ui/checkbox';

interface PromptData {
  id: string;
  text: string;
  createdAt: string;
  category: string;
  providers: Array<{ name: string; enabled: boolean; lastRun?: string }>;
  lastRunAt?: string;
  visibilityScore: number;
  brandPct: number;
  competitorPct: number;
  sentimentDelta: number;
  active: boolean;
}

interface ProviderResponse {
  id: string;
  provider: string;
  score: number;
  org_brand_present: boolean;
  competitors_count: number;
  run_at: string;
  status: string;
}

interface PromptRowProps {
  prompt: PromptData;
  isSelected: boolean;
  isExpanded: boolean;
  onSelect: (checked: boolean) => void;
  onExpand: () => void;
  onToggleActive: (active: boolean) => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

const getScoreColor = (score: number) => {
  if (score >= 7) return 'text-green-600 bg-green-50 border-green-200';
  if (score >= 5) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
  return 'text-red-600 bg-red-50 border-red-200';
};

const getScoreIcon = (score: number) => {
  if (score >= 7) return '🏆';
  if (score >= 5) return '⚡';
  return '📊';
};

export function PromptRow({ 
  prompt, 
  isSelected,
  isExpanded,
  onSelect,
  onExpand,
  onToggleActive,
  onEdit,
  onDuplicate,
  onDelete
}: PromptRowProps) {
  const [responses, setResponses] = useState<ProviderResponse[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch latest responses when expanded
  useEffect(() => {
    if (isExpanded && responses.length === 0) {
      fetchLatestResponses();
    }
  }, [isExpanded, prompt.id]);

  const fetchLatestResponses = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .rpc('get_latest_prompt_provider_responses', { p_prompt_id: prompt.id });

      if (error) {
        console.error('Error fetching responses:', error);
        return;
      }

      setResponses(data || []);
    } catch (error) {
      console.error('Error fetching responses:', error);
    } finally {
      setLoading(false);
    }
  };

  const averageScore = responses.length > 0 
    ? responses.reduce((sum, r) => sum + r.score, 0) / responses.length 
    : prompt.visibilityScore;

  const totalCompetitors = responses.reduce((sum, r) => sum + r.competitors_count, 0);
  const brandMentioned = responses.some(r => r.org_brand_present);

  // Safe date formatting
  const formatSafeDate = (dateStr: string, formatStr: string = 'MMM d, yyyy') => {
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) {
        return 'Invalid date';
      }
      return format(date, formatStr);
    } catch (error) {
      console.error('Date formatting error:', error);
      return 'Invalid date';
    }
  };

  const getLatestRunTime = () => {
    if (responses.length === 0) return null;
    
    try {
      const latestTime = Math.max(...responses.map(r => new Date(r.run_at).getTime()));
      if (isNaN(latestTime)) return null;
      return format(new Date(latestTime), 'MMM d, h:mm a');
    } catch (error) {
      console.error('Error formatting latest run time:', error);
      return null;
    }
  };

  return (
    <Collapsible open={isExpanded} onOpenChange={onExpand}>
      <Card className="hover:shadow-md transition-all duration-200 border-l-4 border-l-primary/20">
        <CollapsibleTrigger asChild>
          <div className="cursor-pointer">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                {/* Selection checkbox */}
                <div className="flex-shrink-0 mt-1">
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={onSelect}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>

                {/* Expand/Collapse Icon */}
                <div className="flex-shrink-0 mt-1">
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>

                {/* Prompt Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <p className="font-medium text-foreground leading-relaxed mb-3">
                        {prompt.text}
                      </p>
                      
                      <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          <span>Created {formatSafeDate(prompt.createdAt)}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Target className="h-3 w-3" />
                          <span>{prompt.category}</span>
                        </div>
                        {getLatestRunTime() && (
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            <span>Last run {getLatestRunTime()}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Score and Actions */}
                    <div className="flex items-center gap-3 flex-shrink-0">
                      {averageScore > 0 && (
                        <div className={cn(
                          "px-3 py-1 rounded-full border text-sm font-medium",
                          getScoreColor(averageScore)
                        )}>
                          <span className="mr-1">{getScoreIcon(averageScore)}</span>
                          {averageScore.toFixed(1)}
                        </div>
                      )}
                      
                      {!prompt.active && (
                        <Badge variant="secondary" className="text-xs">
                          Inactive
                        </Badge>
                      )}

                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={onEdit}
                          className="h-8 w-8 p-0"
                        >
                          <Edit2 className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={onDuplicate}
                          className="h-8 w-8 p-0"
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={onDelete}
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Quick Stats Row */}
                  {responses.length > 0 && (
                    <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        {brandMentioned ? (
                          <>
                            <Trophy className="h-3 w-3 text-green-600" />
                            <span className="text-green-600 font-medium">Brand mentioned</span>
                          </>
                        ) : (
                          <>
                            <Target className="h-3 w-3 text-amber-600" />
                            <span className="text-amber-600 font-medium">Brand not found</span>
                          </>
                        )}
                      </div>
                      <span>•</span>
                      <span>{totalCompetitors} total competitor mentions</span>
                      <span>•</span>
                      <span>{responses.length} provider responses</span>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="border-t bg-muted/30">
            <CardContent className="p-6">
              {loading ? (
                <div className="text-center py-8">
                  <div className="animate-pulse text-muted-foreground">Loading response details...</div>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Provider Responses */}
                  {responses.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-foreground mb-3">Recent Provider Responses</h4>
                      <div className="grid gap-3">
                        {responses.map((response) => (
                          <div key={response.id} className="flex items-center justify-between p-3 bg-card rounded-lg border">
                            <div className="flex items-center gap-3">
                              <div className="capitalize font-medium text-sm">
                                {response.provider}
                              </div>
                              <div className={cn(
                                "px-2 py-1 rounded text-xs font-medium border",
                                getScoreColor(response.score)
                              )}>
                                {response.score.toFixed(1)}
                              </div>
                              {response.org_brand_present && (
                                <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                                  <Trophy className="h-3 w-3 mr-1" />
                                  Brand found
                                </Badge>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {response.competitors_count} competitors • {formatSafeDate(response.run_at, 'MMM d, h:mm a')}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Competitors Analysis */}
                  <div>
                    <h4 className="text-sm font-semibold text-foreground mb-3">Competitor Analysis</h4>
                    <div className="bg-card rounded-lg border p-4">
                      <PromptCompetitors prompt={prompt} />
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-3 pt-4 border-t">
                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleActive(!prompt.active);
                      }}
                      size="sm"
                      variant={prompt.active ? "outline" : "default"}
                      className="flex items-center gap-2"
                    >
                      <PlayCircle className="h-4 w-4" />
                      {prompt.active ? 'Pause' : 'Activate'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEdit();
                      }}
                    >
                      Edit Prompt
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
