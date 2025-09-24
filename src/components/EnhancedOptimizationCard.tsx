import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  FileText, 
  MessageSquare, 
  Share2, 
  Target,
  ExternalLink,
  Copy,
  ChevronDown,
  Clock,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  Users
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';

interface EnhancedOptimizationCardProps {
  optimization: {
    id: string;
    optimization_category: string;
    content_type: string;
    title: string | null;
    body: string | null;
    sources: string | any;
    score_before: number | null;
    projected_impact: string | null;
    created_at: string;
    implementation_details?: any;
    resources?: any;
    success_metrics?: any;
    reddit_strategy?: any;
    impact_score?: number | null;
    difficulty_level?: string | null;
    timeline_weeks?: number | null;
    prompts?: { text: string };
  };
}

const contentTypeConfig = {
  social_post: { icon: Share2, label: 'Social Post', color: 'bg-blue-500/10 text-blue-700 border-blue-200' },
  blog_outline: { icon: FileText, label: 'Blog Outline', color: 'bg-green-500/10 text-green-700 border-green-200' },
  talking_points: { icon: MessageSquare, label: 'Talking Points', color: 'bg-purple-500/10 text-purple-700 border-purple-200' },
  cta_snippets: { icon: Target, label: 'CTA Snippets', color: 'bg-orange-500/10 text-orange-700 border-orange-200' },
  reddit_strategy: { icon: Users, label: 'Reddit Strategy', color: 'bg-red-500/10 text-red-700 border-red-200' },
  general: { icon: Target, label: 'General Strategy', color: 'bg-gray-500/10 text-gray-700 border-gray-200' }
};

const difficultyConfig = {
  easy: { color: 'bg-green-500/10 text-green-700 border-green-200', icon: CheckCircle2 },
  medium: { color: 'bg-yellow-500/10 text-yellow-700 border-yellow-200', icon: AlertCircle },
  hard: { color: 'bg-red-500/10 text-red-700 border-red-200', icon: AlertCircle }
};

export function EnhancedOptimizationCard({ optimization }: EnhancedOptimizationCardProps) {
  const { toast } = useToast();
  const [isExpanded, setIsExpanded] = useState(false);
  
  const config = contentTypeConfig[optimization.content_type as keyof typeof contentTypeConfig] 
    || contentTypeConfig.general;
  const Icon = config.icon;
  
  const difficultyIcon = optimization.difficulty_level 
    ? difficultyConfig[optimization.difficulty_level].icon 
    : CheckCircle2;
  const DifficultyIcon = difficultyIcon;

  const handleCopyContent = async () => {
    try {
      await navigator.clipboard.writeText(optimization.body || '');
      toast({
        title: "Copied to clipboard",
        description: "Content has been copied to your clipboard.",
      });
    } catch (error) {
      toast({
        title: "Failed to copy",
        description: "Unable to copy content to clipboard.",
        variant: "destructive",
      });
    }
  };

  const parseJsonField = (field: any) => {
    if (typeof field === 'string') {
      try {
        return JSON.parse(field);
      } catch {
        return null;
      }
    }
    return field;
  };

  const parseSources = () => {
    try {
      if (typeof optimization.sources === 'string') {
        return JSON.parse(optimization.sources);
      }
      return optimization.sources || [];
    } catch {
      return [];
    }
  };

  const implementationDetails = parseJsonField(optimization.implementation_details);
  const resources = Array.isArray(parseJsonField(optimization.resources)) 
    ? parseJsonField(optimization.resources) 
    : [];
  const successMetrics = parseJsonField(optimization.success_metrics);
  const redditStrategy = parseJsonField(optimization.reddit_strategy);
  const sources = parseSources();

  const renderRedditStrategy = () => {
    if (!redditStrategy || !redditStrategy.subreddits) return null;
    
    return (
      <div className="space-y-3">
        <h4 className="font-medium text-sm flex items-center gap-2">
          <Users className="h-4 w-4" />
          Reddit Strategy
        </h4>
        <div className="space-y-2">
          {redditStrategy.subreddits?.slice(0, 3).map((sub: any, index: number) => (
            <div key={index} className="bg-muted/50 rounded p-2 text-xs">
              <div className="font-medium text-red-600">{sub.name}</div>
              <div className="text-muted-foreground">{sub.audience}</div>
              {sub.rules && <div className="text-xs text-muted-foreground mt-1">📋 {sub.rules}</div>}
            </div>
          ))}
          {redditStrategy.content_approach && (
            <div className="text-xs text-muted-foreground border-l-2 border-primary/20 pl-2">
              <strong>Approach:</strong> {redditStrategy.content_approach}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderImplementationSteps = () => {
    if (!implementationDetails?.steps) return null;
    
    return (
      <div className="space-y-2">
        <h4 className="font-medium text-sm">Implementation Steps</h4>
        <ol className="text-xs space-y-1">
          {implementationDetails.steps.map((step: string, index: number) => (
            <li key={index} className="flex items-start gap-2">
              <span className="bg-primary/10 text-primary rounded-full w-4 h-4 flex items-center justify-center text-xs font-medium shrink-0 mt-0.5">
                {index + 1}
              </span>
              <span className="text-muted-foreground">{step}</span>
            </li>
          ))}
        </ol>
      </div>
    );
  };

  const renderResources = () => {
    if (!resources.length) return null;
    
    return (
      <div className="space-y-2">
        <h4 className="font-medium text-sm">Resources & Tools</h4>
        <div className="space-y-1">
          {resources.map((resource: any, index: number) => (
            <div key={index} className="flex items-center gap-2 text-xs">
              <ExternalLink className="h-3 w-3 text-muted-foreground" />
              <span className="font-medium">{resource.title}</span>
              {resource.description && (
                <span className="text-muted-foreground">- {resource.description}</span>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium">{optimization.title}</CardTitle>
          </div>
          <div className="flex gap-1">
            <Badge variant="outline" className={`text-xs ${config.color}`}>
              {config.label}
            </Badge>
            {optimization.optimization_category === 'low_visibility' && (
              <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-700 border-amber-200">
                Low Visibility Fix
              </Badge>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          {optimization.impact_score && (
            <div className="flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              Impact: {optimization.impact_score}/10
            </div>
          )}
          {optimization.difficulty_level && (
            <div className="flex items-center gap-1">
              <DifficultyIcon className="h-3 w-3" />
              {optimization.difficulty_level}
            </div>
          )}
          {optimization.timeline_weeks && (
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {optimization.timeline_weeks}w
            </div>
          )}
        </div>
        
        {optimization.prompts?.text && (
          <div className="text-xs text-muted-foreground bg-muted/50 rounded p-2 mt-2">
            <strong>For prompt:</strong> "{optimization.prompts.text}"
          </div>
        )}
      </CardHeader>
      
      <CardContent className="pt-0 space-y-4">
        <div className="max-h-32 overflow-y-auto">
          <div className="whitespace-pre-wrap text-sm text-muted-foreground">
            {optimization.body || 'No content available'}
          </div>
        </div>
        
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full justify-between text-xs">
              Implementation Details
              <ChevronDown className={`h-3 w-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
            </Button>
          </CollapsibleTrigger>
          
          <CollapsibleContent className="space-y-4 mt-4">
            {renderImplementationSteps()}
            {renderRedditStrategy()}
            {renderResources()}
            
            {successMetrics && (
              <div className="space-y-2">
                <h4 className="font-medium text-sm">Success Metrics</h4>
                <div className="text-xs text-muted-foreground space-y-1">
                  {successMetrics.primary && (
                    <div><strong>Primary:</strong> {successMetrics.primary}</div>
                  )}
                  {successMetrics.secondary && (
                    <div><strong>Secondary:</strong> {successMetrics.secondary.join(', ')}</div>
                  )}
                  {successMetrics.timeline && (
                    <div><strong>Timeline:</strong> {successMetrics.timeline}</div>
                  )}
                </div>
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>
        
        {optimization.projected_impact && (
          <div className="text-xs p-2 bg-primary/5 rounded border">
            <strong className="text-primary">Expected Impact:</strong> {optimization.projected_impact}
          </div>
        )}
        
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span>Current Visibility: {optimization.score_before?.toFixed(1) || '0.0'}%</span>
            {sources.length > 0 && (
              <span>• {sources.length} sources</span>
            )}
          </div>
          <span>{new Date(optimization.created_at).toLocaleDateString()}</span>
        </div>
        
        <div className="flex gap-2">
          <Button 
            size="sm" 
            variant="outline" 
            onClick={handleCopyContent}
            className="text-xs h-7"
          >
            <Copy className="h-3 w-3 mr-1" />
            Copy
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}