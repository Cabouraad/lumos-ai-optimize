import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  Check, 
  Clock, 
  X, 
  Copy, 
  ExternalLink, 
  FileText, 
  Share, 
  Globe, 
  Lightbulb,
  ChevronDown,
  ChevronUp,
  ArrowRight
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { PromptModal } from './PromptModal';
import { supabase } from '@/integrations/supabase/client';

interface Recommendation {
  id: string;
  type: 'content' | 'social' | 'site' | 'prompt';
  title: string;
  rationale: string;
  status: 'open' | 'snoozed' | 'done' | 'dismissed';
  created_at: string;
  cooldown_until?: string;
  metadata?: {
    steps?: string[];
    estLift?: number;
    sourcePromptIds?: string[];
    sourceRunIds?: string[];
    citations?: Array<{type: 'url' | 'ref', value: string}>;
    impact?: 'high' | 'medium' | 'low';
    category?: string;
    competitors?: string;
  };
}

interface RecommendationCardProps {
  recommendation: Recommendation;
  onUpdateStatus: (id: string, status: 'done' | 'dismissed', cooldownDays?: number) => Promise<void>;
  orgId?: string;
}

export function RecommendationCard({ recommendation, onUpdateStatus, orgId }: RecommendationCardProps) {
  const { toast } = useToast();
  const [showSteps, setShowSteps] = useState(false);
  const [promptModalOpen, setPromptModalOpen] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [promptTexts, setPromptTexts] = useState<string[]>([]);
  const [loadingPrompts, setLoadingPrompts] = useState(false);

  const getKindIcon = (type: string) => {
    switch (type) {
      case 'content': return <FileText className="h-4 w-4" />;
      case 'social': return <Share className="h-4 w-4" />;
      case 'site': return <Globe className="h-4 w-4" />;
      case 'prompt': return <Lightbulb className="h-4 w-4" />;
      default: return <Lightbulb className="h-4 w-4" />;
    }
  };

  const getKindColor = (type: string) => {
    switch (type) {
      case 'content': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'social': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'site': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'prompt': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'snoozed': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'done': return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
      case 'dismissed': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
    }
  };

  const getLiftColor = (lift: number) => {
    if (lift >= 0.15) return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200';
    if (lift >= 0.10) return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    if (lift >= 0.05) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
    return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied!",
        description: "Text copied to clipboard",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy text",
        variant: "destructive",
      });
    }
  };

  const handleUpdateStatus = async (status: 'done' | 'dismissed', cooldownDays?: number) => {
    setUpdating(true);
    try {
      await onUpdateStatus(recommendation.id, status, cooldownDays);
    } finally {
      setUpdating(false);
    }
  };

  const estLift = recommendation.metadata?.estLift || 0;
  const steps = recommendation.metadata?.steps || [];
  const sourcePromptIds = recommendation.metadata?.sourcePromptIds || [];

  // Load prompt texts when component mounts and has prompt IDs
  useEffect(() => {
    if (sourcePromptIds.length > 0 && orgId) {
      loadPromptTexts();
    }
  }, [sourcePromptIds, orgId]);

  const loadPromptTexts = async () => {
    setLoadingPrompts(true);
    try {
      const { data: promptsData, error } = await supabase
        .from('prompts')
        .select('id, text')
        .in('id', sourcePromptIds)
        .eq('org_id', orgId);

      if (error) {
        console.error('Error querying prompts:', error);
        return;
      }

      if (promptsData) {
        // Maintain the order based on sourcePromptIds
        const orderedTexts = sourcePromptIds.map(id => {
          const prompt = promptsData.find(p => p.id === id);
          return prompt ? prompt.text : `Prompt ID: ${id}`;
        });
        setPromptTexts(orderedTexts);
      }
    } catch (error) {
      console.error('Error loading prompt texts:', error);
    } finally {
      setLoadingPrompts(false);
    }
  };

  return (
    <>
      <Card className="rounded-2xl shadow-md hover:shadow-lg transition-shadow duration-200 h-fit">
        <CardContent className="p-0">
          {/* Header with Impact and Category Labels */}
          <div className="px-6 pt-6 pb-4">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2 flex-wrap">
                {recommendation.metadata?.impact === 'high' && (
                  <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200 font-medium">
                    High Impact
                  </Badge>
                )}
                <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 font-medium">
                  Owned
                </Badge>
                <Badge className={getKindColor(recommendation.type)}>
                  {getKindIcon(recommendation.type)}
                  <span className="ml-1 capitalize">{recommendation.type}</span>
                </Badge>
                {recommendation.status !== 'open' && (
                  <Badge variant="outline" className={getStatusColor(recommendation.status)}>
                    {recommendation.status}
                  </Badge>
                )}
                {estLift > 0 && (
                  <Badge className={getLiftColor(estLift)}>
                    +{(estLift * 100).toFixed(0)}%
                  </Badge>
                )}
              </div>
            </div>

            {/* Title - More prominent like competitor tool */}
            <h3 className="font-bold text-foreground mb-4 text-xl leading-tight">
              {recommendation.title}
            </h3>

            {/* Strategic rationale - More detailed */}
            <div className="text-sm text-muted-foreground mb-4 bg-muted/30 p-4 rounded-lg border-l-4 border-primary/30">
              <p className="leading-relaxed">
                {recommendation.rationale}
              </p>
            </div>
          </div>

          {/* Implementation Details - Comprehensive like competitor tool */}
          {steps.length > 0 && (
            <div className="border-t bg-muted/20">
              <button
                onClick={() => setShowSteps(!showSteps)}
                className="w-full px-6 py-4 flex items-center justify-between text-left text-sm font-medium text-foreground hover:bg-muted/30 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-inset transition-colors"
                aria-expanded={showSteps}
                aria-controls="implementation-details"
              >
                <span>Implementation Details</span>
                {showSteps ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              
              {showSteps && (
                <div id="implementation-details" className="px-6 pb-6">
                  <div className="space-y-6">
                    <div className="bg-primary/5 p-4 rounded-lg border-l-4 border-primary/30">
                      <p className="text-sm text-muted-foreground leading-relaxed mb-3">
                        <strong>Strategic Overview:</strong> Create a comprehensive content strategy that addresses the key areas where your brand can gain visibility and authority in your market.
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                        <div>
                          <span className="font-semibold text-foreground">Timeline:</span>
                          <p className="text-muted-foreground">2-4 weeks implementation</p>
                        </div>
                        <div>
                          <span className="font-semibold text-foreground">Resources:</span>
                          <p className="text-muted-foreground">Content team, SEO tools</p>
                        </div>
                        <div>
                          <span className="font-semibold text-foreground">Expected Impact:</span>
                          <p className="text-muted-foreground">15-25% visibility increase</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-5">
                      {steps.map((step, index) => (
                        <div key={index} className="bg-card border border-muted rounded-lg p-4 hover:shadow-sm transition-shadow">
                          <div className="flex items-start gap-4">
                            <span className="text-sm bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0 font-semibold">
                              {index + 1}
                            </span>
                            <div className="flex-1 space-y-3">
                              <h4 className="text-sm font-semibold text-foreground leading-relaxed">
                                {step}
                              </h4>
                              
                              {/* Sub-tasks for each step */}
                              <div className="space-y-2">
                                <p className="text-xs text-muted-foreground font-medium">Key Actions:</p>
                                <ul className="space-y-1 text-xs text-muted-foreground">
                                  <li className="flex items-start gap-2">
                                    <span className="w-1 h-1 rounded-full bg-primary mt-2 flex-shrink-0"></span>
                                    Research target keywords and search intent
                                  </li>
                                  <li className="flex items-start gap-2">
                                    <span className="w-1 h-1 rounded-full bg-primary mt-2 flex-shrink-0"></span>
                                    Create detailed content outline with H2/H3 structure
                                  </li>
                                  <li className="flex items-start gap-2">
                                    <span className="w-1 h-1 rounded-full bg-primary mt-2 flex-shrink-0"></span>
                                    Include expert quotes and data to build authority
                                  </li>
                                  <li className="flex items-start gap-2">
                                    <span className="w-1 h-1 rounded-full bg-primary mt-2 flex-shrink-0"></span>
                                    Optimize for featured snippets and AI responses
                                  </li>
                                </ul>
                              </div>
                              
                              {/* Success metrics */}
                              <div className="bg-muted/30 p-3 rounded border-l-2 border-green-500/30">
                                <p className="text-xs font-medium text-foreground mb-1">Success Metrics:</p>
                                <p className="text-xs text-muted-foreground">Track ranking improvements, organic traffic increase, and AI mention frequency</p>
                              </div>
                              
                              <div className="flex items-center gap-2">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => copyToClipboard(step)}
                                  className="h-7 px-3 text-xs"
                                  aria-label={`Copy step ${index + 1}`}
                                >
                                  <Copy className="h-3 w-3 mr-1" />
                                  Copy Step
                                </Button>
                                <Badge variant="outline" className="text-xs">
                                  {index === 0 ? 'Foundation' : index === steps.length - 1 ? 'Optimization' : 'Execution'}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    {/* Additional resources section */}
                    <div className="border-t pt-4">
                      <h4 className="text-sm font-semibold text-foreground mb-3">Resources & Tools</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                        <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded border">
                          <strong className="text-blue-700 dark:text-blue-300">Content Creation:</strong>
                          <p className="text-blue-600 dark:text-blue-400 mt-1">Use AI writing tools, competitor analysis, and SEO research platforms</p>
                        </div>
                        <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded border">
                          <strong className="text-green-700 dark:text-green-300">Performance Tracking:</strong>
                          <p className="text-green-600 dark:text-green-400 mt-1">Monitor rankings, traffic, and AI platform mentions regularly</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Related Prompts - Show full prompt text directly */}
          {sourcePromptIds.length > 0 && (
            <div className="border-t bg-muted/10">
              <div className="px-6 py-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    <h4 className="text-sm font-semibold text-foreground">Related Prompts</h4>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {sourcePromptIds.length} {sourcePromptIds.length === 1 ? 'prompt' : 'prompts'}
                  </Badge>
                </div>
                
                <p className="text-xs text-muted-foreground leading-relaxed mb-4">
                  This recommendation analyzes the following queries to identify content opportunities:
                </p>
                
                {loadingPrompts ? (
                  <div className="space-y-3">
                    {sourcePromptIds.map((_, index) => (
                      <div key={index} className="bg-card p-4 rounded-lg border animate-pulse">
                        <div className="h-4 bg-muted rounded mb-2"></div>
                        <div className="h-3 bg-muted rounded w-3/4"></div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {promptTexts.map((promptText, index) => (
                      <div key={sourcePromptIds[index]} className="bg-card p-4 rounded-lg border hover:shadow-sm transition-shadow">
                        <div className="flex items-start justify-between mb-2">
                          <Badge variant="secondary" className="text-xs">
                            Query {index + 1}
                          </Badge>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => copyToClipboard(promptText)}
                            className="h-6 w-6 p-0"
                            aria-label={`Copy query ${index + 1}`}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                        <p className="text-sm text-foreground leading-relaxed font-medium">
                          "{promptText}"
                        </p>
                      </div>
                    ))}
                  </div>
                )}
                
                <div className="pt-3 border-t mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPromptModalOpen(true)}
                    className="text-xs"
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    View Performance Details
                  </Button>
                </div>
              </div>
            </div>
          )}


          {/* Actions */}
          {recommendation.status === 'open' && (
            <div className="border-t px-6 py-4 bg-card">
              <div className="flex justify-between items-center">
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => handleUpdateStatus('done')}
                  disabled={updating}
                  aria-label="Mark recommendation as complete"
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  <Check className="mr-1 h-3 w-3" />
                  Mark Complete
                </Button>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleUpdateStatus('dismissed', 14)}
                    disabled={updating}
                    aria-label="Snooze recommendation for 14 days"
                  >
                    <Clock className="mr-1 h-3 w-3" />
                    Snooze 14d
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleUpdateStatus('dismissed')}
                    disabled={updating}
                    aria-label="Dismiss recommendation"
                  >
                    <X className="mr-1 h-3 w-3" />
                    Dismiss
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <PromptModal
        open={promptModalOpen}
        onOpenChange={setPromptModalOpen}
        promptIds={sourcePromptIds}
        orgId={orgId}
      />
    </>
  );
}