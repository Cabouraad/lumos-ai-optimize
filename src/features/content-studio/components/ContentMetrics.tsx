import { useMemo } from 'react';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { 
  Target, 
  Clock, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle,
  TrendingUp
} from 'lucide-react';
import type { EditorState } from '../hooks/useContentEditor';
import type { ContentStudioItem } from '../types';

interface ContentMetricsProps {
  editorState: EditorState;
  item: ContentStudioItem;
}

// Recommended word counts by content type
const WORD_COUNT_TARGETS: Record<string, { min: number; ideal: number; max: number }> = {
  blog_post: { min: 1500, ideal: 2500, max: 4000 },
  faq_page: { min: 800, ideal: 1500, max: 2500 },
  landing_page: { min: 500, ideal: 1000, max: 1800 },
  support_article: { min: 600, ideal: 1200, max: 2000 },
  comparison_page: { min: 1200, ideal: 2000, max: 3500 },
};

export function ContentMetrics({ editorState, item }: ContentMetricsProps) {
  const metrics = useMemo(() => {
    // Calculate total word count
    const allContent = [
      editorState.title,
      ...editorState.sections.map(s => s.content),
      ...editorState.sections.flatMap(s => s.children?.map(c => c.content) || []),
      ...editorState.faqs.map(f => f.answer),
    ].join(' ');
    
    const wordCount = allContent.split(/\s+/).filter(Boolean).length;
    
    // Calculate reading time (average 200 words per minute)
    const readingTime = Math.ceil(wordCount / 200);
    
    // Calculate entity density
    const contentLower = allContent.toLowerCase();
    const entityMentions = item.key_entities.reduce((acc, entity) => {
      const regex = new RegExp(entity.toLowerCase(), 'gi');
      const matches = contentLower.match(regex);
      return acc + (matches?.length || 0);
    }, 0);
    const entityDensity = wordCount > 0 ? (entityMentions / wordCount) * 100 : 0;
    
    // Calculate completion percentage
    const totalSections = editorState.sections.length + 
      editorState.sections.reduce((acc, s) => acc + (s.children?.length || 0), 0);
    const completedSections = editorState.sections.filter(s => s.content.trim().length > 50).length +
      editorState.sections.reduce((acc, s) => 
        acc + (s.children?.filter(c => c.content.trim().length > 50).length || 0), 0);
    const completionPercent = totalSections > 0 ? Math.round((completedSections / totalSections) * 100) : 0;
    
    // Calculate FAQ completion
    const completedFaqs = editorState.faqs.filter(f => f.answer.trim().length > 20).length;
    const faqCompletion = editorState.faqs.length > 0 
      ? Math.round((completedFaqs / editorState.faqs.length) * 100) 
      : 100;
    
    // Get word count targets
    const targets = WORD_COUNT_TARGETS[item.content_type] || WORD_COUNT_TARGETS.blog_post;
    const wordCountScore = wordCount >= targets.min && wordCount <= targets.max 
      ? 100 
      : wordCount < targets.min 
        ? Math.round((wordCount / targets.min) * 100)
        : Math.max(0, 100 - ((wordCount - targets.max) / targets.max) * 50);
    
    // Overall content score
    const contentScore = Math.round(
      (wordCountScore * 0.3) + 
      (completionPercent * 0.3) + 
      (faqCompletion * 0.2) +
      (Math.min(entityDensity * 20, 20)) // Entity density contributes up to 20%
    );
    
    return {
      wordCount,
      readingTime,
      entityMentions,
      entityDensity,
      completionPercent,
      faqCompletion,
      contentScore,
      targets,
      completedSections,
      totalSections,
      completedFaqs,
    };
  }, [editorState, item]);

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-amber-600';
    return 'text-red-500';
  };

  const getProgressColor = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-amber-500';
    return 'bg-red-500';
  };

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Content Score */}
        <div className="p-3 bg-gradient-to-br from-primary/5 to-primary/10 rounded-lg border border-primary/20">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Content Score</span>
            </div>
            <span className={`text-xl font-bold ${getScoreColor(metrics.contentScore)}`}>
              {metrics.contentScore}
            </span>
          </div>
          <Progress 
            value={metrics.contentScore} 
            className="h-2"
          />
          <p className="text-xs text-muted-foreground mt-2">
            {metrics.contentScore >= 80 
              ? 'Great! Your content is well-optimized for AI visibility.'
              : metrics.contentScore >= 60
                ? 'Good progress. Add more content to improve your score.'
                : 'Keep writing! Complete more sections to improve visibility.'}
          </p>
        </div>

        {/* Word Count */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Target className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-medium">Word Count</span>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge 
                  variant={metrics.wordCount >= metrics.targets.min ? 'default' : 'secondary'}
                  className="text-xs cursor-help"
                >
                  {metrics.wordCount.toLocaleString()} words
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">
                  Target: {metrics.targets.min.toLocaleString()}-{metrics.targets.max.toLocaleString()} words
                  <br />
                  Ideal: {metrics.targets.ideal.toLocaleString()} words
                </p>
              </TooltipContent>
            </Tooltip>
          </div>
          <div className="relative">
            <Progress 
              value={Math.min((metrics.wordCount / metrics.targets.ideal) * 100, 100)} 
              className="h-1.5"
            />
            <div 
              className="absolute top-0 h-full w-0.5 bg-primary/60" 
              style={{ left: `${(metrics.targets.min / metrics.targets.ideal) * 100}%` }}
            />
          </div>
        </div>

        {/* Reading Time */}
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            <span>Reading Time</span>
          </div>
          <span className="font-medium">{metrics.readingTime} min read</span>
        </div>

        {/* Section Completion */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-medium">Sections</span>
            </div>
            <span className="text-xs">
              {metrics.completedSections}/{metrics.totalSections}
            </span>
          </div>
          <Progress value={metrics.completionPercent} className="h-1.5" />
        </div>

        {/* FAQ Completion */}
        {editorState.faqs.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium">FAQs</span>
              </div>
              <span className="text-xs">
                {metrics.completedFaqs}/{editorState.faqs.length}
              </span>
            </div>
            <Progress value={metrics.faqCompletion} className="h-1.5" />
          </div>
        )}

        {/* Entity Density */}
        <div className="p-2 bg-muted/50 rounded-lg">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-medium">Key Entity Coverage</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-1 mt-2">
            {item.key_entities.slice(0, 6).map((entity) => {
              const regex = new RegExp(entity.toLowerCase(), 'gi');
              const matches = (editorState.sections.map(s => s.content).join(' ') + 
                editorState.faqs.map(f => f.answer).join(' ')).toLowerCase().match(regex);
              const count = matches?.length || 0;
              return (
                <Tooltip key={entity}>
                  <TooltipTrigger asChild>
                    <Badge 
                      variant={count > 0 ? 'default' : 'outline'} 
                      className={`text-xs cursor-help ${count > 0 ? '' : 'opacity-60'}`}
                    >
                      {count > 0 ? (
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                      ) : (
                        <AlertCircle className="h-3 w-3 mr-1" />
                      )}
                      {entity}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">
                      {count > 0 
                        ? `Mentioned ${count} time${count > 1 ? 's' : ''}`
                        : 'Not yet mentioned in content'}
                    </p>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
