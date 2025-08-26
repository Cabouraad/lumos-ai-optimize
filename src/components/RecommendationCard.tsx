import { useState } from 'react';
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
  const citations = recommendation.metadata?.citations || [];
  const sourcePromptIds = recommendation.metadata?.sourcePromptIds || [];

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

          {/* Implementation Details - Expandable */}
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
                <div id="implementation-details" className="px-6 pb-4">
                  <div className="space-y-3">
                    {steps.map((step, index) => (
                      <div key={index} className="flex items-start gap-3 text-sm">
                        <span className="text-xs bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 mt-0.5 font-medium">
                          {index + 1}
                        </span>
                        <div className="flex-1">
                          <p className="text-foreground leading-relaxed">{step}</p>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => copyToClipboard(step)}
                          className="h-6 w-6 p-0 flex-shrink-0"
                          aria-label={`Copy step ${index + 1}`}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Related Prompts - Enhanced like competitor tool */}
          {sourcePromptIds.length > 0 && (
            <div className="border-t bg-muted/10">
              <div className="px-6 py-4">
                <button
                  onClick={() => setPromptModalOpen(true)}
                  className="w-full flex items-center justify-between text-left text-sm font-semibold text-foreground hover:bg-muted/30 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-inset transition-colors p-2 rounded-lg"
                  aria-label="View all related prompts"
                >
                  <span className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Related Prompts
                  </span>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {sourcePromptIds.length} {sourcePromptIds.length === 1 ? 'prompt' : 'prompts'}
                    </Badge>
                    <ChevronDown className="h-4 w-4" />
                  </div>
                </button>
                <div className="mt-3 space-y-2">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    This recommendation is for the entire topic area.
                  </p>
                  <div className="grid gap-1">
                    {sourcePromptIds.slice(0, 3).map((promptId, index) => (
                      <div key={promptId} className="text-xs text-muted-foreground bg-card p-2 rounded border">
                        Query {index + 1}: {promptId.substring(0, 8)}...
                      </div>
                    ))}
                    {sourcePromptIds.length > 3 && (
                      <div className="text-xs text-muted-foreground text-center py-1">
                        +{sourcePromptIds.length - 3} more queries
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Related Citations - Enhanced like competitor tool */}
          {citations.length > 0 && (
            <div className="border-t bg-muted/10">
              <div className="px-6 py-4">
                <div className="flex items-center gap-2 mb-3">
                  <ExternalLink className="h-4 w-4 text-foreground" />
                  <h4 className="text-sm font-semibold text-foreground">Related Citations</h4>
                </div>
                <div className="space-y-2">
                  {citations.map((citation, index) => (
                    <div 
                      key={index}
                      className="flex items-start gap-3 p-3 rounded-lg bg-card hover:bg-primary/5 cursor-pointer transition-all duration-200 group border hover:border-primary/20"
                      onClick={() => {
                        if (citation.type === 'url') {
                          window.open(citation.value, '_blank', 'noopener,noreferrer');
                        } else {
                          copyToClipboard(citation.value);
                        }
                      }}
                    >
                      <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-primary flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm text-foreground group-hover:text-primary font-medium block leading-relaxed">
                          {citation.type === 'url' ? new URL(citation.value).hostname : citation.value}
                        </span>
                        {citation.type === 'url' && (
                          <span className="text-xs text-muted-foreground truncate block mt-1">
                            {citation.value}
                          </span>
                        )}
                      </div>
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <ArrowRight className="h-3 w-3 text-primary" />
                      </div>
                    </div>
                  ))}
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