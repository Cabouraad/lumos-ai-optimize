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
  ChevronUp
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
        <CardContent className="p-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2 flex-wrap">
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

          {/* Title */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <h3 className="font-semibold text-foreground mb-2 line-clamp-1 cursor-help">
                  {recommendation.title}
                </h3>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-sm">
                <p>{recommendation.title}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Rationale */}
          <p className="text-sm text-muted-foreground mb-3 line-clamp-3">
            {recommendation.rationale}
            {sourcePromptIds.length > 0 && (
              <button
                onClick={() => setPromptModalOpen(true)}
                className="ml-2 text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 rounded"
                aria-label="View linked prompts"
              >
                (linked prompts)
              </button>
            )}
          </p>

          {/* Citations */}
          {citations.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-3">
              {citations.slice(0, 3).map((citation, index) => (
                <Badge 
                  key={index}
                  variant="outline" 
                  className="text-xs cursor-pointer hover:bg-muted"
                  onClick={() => {
                    if (citation.type === 'url') {
                      window.open(citation.value, '_blank', 'noopener,noreferrer');
                    } else {
                      copyToClipboard(citation.value);
                    }
                  }}
                  title={citation.value}
                >
                  {citation.type === 'url' ? (
                    <>
                      <ExternalLink className="h-3 w-3 mr-1" />
                      {new URL(citation.value).hostname}
                    </>
                  ) : (
                    <>
                      [{citation.value}]
                    </>
                  )}
                </Badge>
              ))}
              {citations.length > 3 && (
                <Badge variant="outline" className="text-xs">
                  +{citations.length - 3} more
                </Badge>
              )}
            </div>
          )}

          {/* Steps */}
          {steps.length > 0 && (
            <div className="mb-4">
              <button
                onClick={() => setShowSteps(!showSteps)}
                className="flex items-center text-sm font-medium text-foreground hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 rounded"
                aria-expanded={showSteps}
                aria-controls="recommendation-steps"
              >
                {showSteps ? <ChevronUp className="h-4 w-4 mr-1" /> : <ChevronDown className="h-4 w-4 mr-1" />}
                Steps ({steps.length})
              </button>
              
              {showSteps && (
                <ul id="recommendation-steps" className="mt-2 space-y-2">
                  {steps.map((step, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm">
                      <span className="text-xs bg-muted text-muted-foreground rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5">
                        {index + 1}
                      </span>
                      <span className="flex-1">{step}</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => copyToClipboard(step)}
                        className="h-6 w-6 p-0 flex-shrink-0"
                        aria-label={`Copy step ${index + 1}`}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Actions */}
          {recommendation.status === 'open' && (
            <div className="flex gap-2 flex-wrap">
              <Button
                size="sm"
                variant="default"
                onClick={() => handleUpdateStatus('done')}
                disabled={updating}
                aria-label="Mark recommendation as done"
              >
                <Check className="mr-1 h-3 w-3" />
                Done
              </Button>
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