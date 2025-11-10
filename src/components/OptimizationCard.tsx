import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  FileText, 
  MessageSquare, 
  Share2, 
  Target,
  ExternalLink,
  Copy
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface OptimizationCardProps {
  optimization: {
    id: string;
    optimization_category: 'low_visibility' | 'general';
    content_type: 'social_post' | 'blog_outline' | 'talking_points' | 'cta_snippets' | 'reddit_strategy' | 'general';
    title: string;
    body: string;
    sources: string;
    score_before: number;
    projected_impact: string;
    created_at: string;
    implementation_details?: any;
    resources?: any[];
    success_metrics?: any;
    reddit_strategy?: any;
    impact_score?: number;
    difficulty_level?: 'easy' | 'medium' | 'hard';
    timeline_weeks?: number;
    prompts?: { text: string };
  };
}

const contentTypeConfig = {
  social_post: {
    icon: Share2,
    label: 'Social Post',
    color: 'bg-blue-500/10 text-blue-700 border-blue-200'
  },
  blog_outline: {
    icon: FileText,
    label: 'Blog Outline',
    color: 'bg-green-500/10 text-green-700 border-green-200'
  },
  talking_points: {
    icon: MessageSquare,
    label: 'Talking Points',
    color: 'bg-purple-500/10 text-purple-700 border-purple-200'
  },
  cta_snippets: {
    icon: Target,
    label: 'CTA Snippets',
    color: 'bg-orange-500/10 text-orange-700 border-orange-200'
  },
  reddit_strategy: {
    icon: MessageSquare,
    label: 'Reddit Strategy',
    color: 'bg-red-500/10 text-red-700 border-red-200'
  },
  general: {
    icon: Target,
    label: 'General Strategy',
    color: 'bg-gray-500/10 text-gray-700 border-gray-200'
  }
};

export function OptimizationCard({ optimization }: OptimizationCardProps) {
  const { toast } = useToast();
  const config = contentTypeConfig[optimization.content_type];
  const Icon = config.icon;

  const handleCopyContent = async () => {
    try {
      await navigator.clipboard.writeText(optimization.body);
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

  const parseSources = () => {
    try {
      return JSON.parse(optimization.sources || '[]');
    } catch {
      return [];
    }
  };

  const parseBody = () => {
    // Try to parse as JSON for structured content
    try {
      const parsed = JSON.parse(optimization.body);
      if (typeof parsed === 'object') {
        return parsed;
      }
    } catch {
      // Return as string if not JSON
    }
    return optimization.body;
  };

  const renderBody = () => {
    const body = parseBody();
    
    if (typeof body === 'string') {
      return (
        <div className="whitespace-pre-wrap text-sm text-muted-foreground">
          {body}
        </div>
      );
    }
    
    // Handle blog outline structure
    if (optimization.content_type === 'blog_outline' && body.sections) {
      return (
        <div className="space-y-3">
          {body.sections?.map((section: any, index: number) => (
            <div key={index} className="border-l-2 border-primary/20 pl-3">
              <h4 className="font-medium text-sm">{section.title || section}</h4>
              {section.bullets && (
                <ul className="mt-1 text-xs text-muted-foreground space-y-1">
                  {section.bullets.map((bullet: string, i: number) => (
                    <li key={i} className="flex items-start">
                      <span className="mr-1">•</span>
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      );
    }
    
    // Fallback for other structured content
    return (
      <pre className="text-xs text-muted-foreground whitespace-pre-wrap">
        {JSON.stringify(body, null, 2)}
      </pre>
    );
  };

  const sources = parseSources();

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium">{optimization.title}</CardTitle>
          </div>
          <Badge variant="outline" className={`text-xs ${config.color}`}>
            {config.label}
          </Badge>
        </div>
        
        {optimization.prompts?.text && (
          <div className="text-xs text-muted-foreground bg-muted/50 rounded p-2 mt-2">
            <strong>For prompt:</strong> "{optimization.prompts.text}"
          </div>
        )}
      </CardHeader>
      
      <CardContent className="pt-0 space-y-4">
        <div className="max-h-48 overflow-y-auto">
          {renderBody()}
        </div>
        
        {optimization.projected_impact && (
          <div className="text-xs p-2 bg-primary/5 rounded border">
            <strong className="text-primary">Impact:</strong> {optimization.projected_impact}
          </div>
        )}
        
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span>Visibility: {optimization.score_before?.toFixed(1)}</span>
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
          
          {sources.length > 0 && (
            <Button 
              size="sm" 
              variant="ghost" 
              className="text-xs h-7"
              onClick={() => {
                // Could open sources in a modal
                console.log('Sources:', sources);
              }}
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              Sources ({sources.length})
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}