import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  Clock, 
  Target, 
  Users, 
  Calendar, 
  CheckCircle2, 
  ChevronDown,
  FileText,
  Share2,
  BarChart3,
  Lightbulb
} from 'lucide-react';
import { ContentOptimization } from '@/features/visibility-optimizer/types';
import { useState } from 'react';
import { useMarkOptimizationComplete } from '@/features/visibility-optimizer/hooks';

interface OptimizationCardProps {
  optimization: ContentOptimization;
}

const contentTypeIcons = {
  blog_post: FileText,
  social_post: Share2,
  video_content: Users,
  press_release: Target,
  case_study: BarChart3,
  whitepaper: FileText,
  podcast_appearance: Users,
  community_answer: Lightbulb
};

const difficultyColors = {
  easy: 'bg-green-100 text-green-800',
  medium: 'bg-yellow-100 text-yellow-800',
  hard: 'bg-red-100 text-red-800'
};

export function OptimizationCard({ optimization }: OptimizationCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const markComplete = useMarkOptimizationComplete();
  
  const Icon = contentTypeIcons[optimization.type] || FileText;

  const handleMarkComplete = () => {
    markComplete.mutate(optimization.id);
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Icon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg line-clamp-2">
                {optimization.title}
              </CardTitle>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="capitalize">
                  {optimization.type.replace('_', ' ')}
                </Badge>
                <Badge 
                  className={`${difficultyColors[optimization.difficulty_level]} border-0`}
                >
                  {optimization.difficulty_level}
                </Badge>
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-primary">
              {optimization.priority_score}
            </div>
            <div className="text-xs text-muted-foreground">priority</div>
          </div>
        </div>
        
        <CardDescription className="line-clamp-2">
          {optimization.description}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-muted-foreground" />
            <div>
              <div className="text-sm font-medium">
                +{optimization.impact_assessment.estimated_visibility_increase}%
              </div>
              <div className="text-xs text-muted-foreground">visibility boost</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <div>
              <div className="text-sm font-medium">
                {optimization.implementation.total_timeline_days} days
              </div>
              <div className="text-xs text-muted-foreground">to complete</div>
            </div>
          </div>
        </div>

        {/* Content Specs */}
        <div className="p-3 bg-muted/50 rounded-lg">
          <h4 className="font-medium text-sm mb-2">Content Specifications</h4>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-muted-foreground">Words:</span> {optimization.content_specifications.word_count.toLocaleString()}
            </div>
            <div>
              <span className="text-muted-foreground">Audience:</span> {optimization.content_specifications.target_audience}
            </div>
          </div>
        </div>

        {/* Distribution */}
        <div className="flex items-center gap-2">
          <Share2 className="h-4 w-4 text-muted-foreground" />
          <div className="flex-1">
            <div className="text-sm font-medium">
              {optimization.distribution.primary_channel}
            </div>
            <div className="text-xs text-muted-foreground">
              {optimization.distribution.additional_channels.length > 0 && 
                `+${optimization.distribution.additional_channels.length} more channels`
              }
            </div>
          </div>
          <Badge variant="outline" className="text-xs">
            {optimization.distribution.optimal_timing}
          </Badge>
        </div>

        <Separator />

        {/* Expandable Details */}
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between p-0">
              <span className="text-sm font-medium">View Implementation Details</span>
              <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
            </Button>
          </CollapsibleTrigger>
          
          <CollapsibleContent className="space-y-4 mt-4">
            {/* Content Strategy */}
            <div>
              <h4 className="font-medium text-sm mb-2">Content Strategy</h4>
              <div className="text-sm text-muted-foreground space-y-1">
                <p><strong>Angle:</strong> {optimization.content_strategy.main_angle}</p>
                <p><strong>Value Prop:</strong> {optimization.content_strategy.unique_value_proposition}</p>
                <p><strong>Differentiation:</strong> {optimization.content_strategy.competitor_differentiation}</p>
              </div>
            </div>

            {/* Implementation Plan */}
            <div>
              <h4 className="font-medium text-sm mb-2">Implementation Timeline</h4>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div className="text-center p-2 bg-muted/30 rounded">
                  <div className="font-medium">{optimization.implementation.research_hours}h</div>
                  <div className="text-xs text-muted-foreground">Research</div>
                </div>
                <div className="text-center p-2 bg-muted/30 rounded">
                  <div className="font-medium">{optimization.implementation.writing_hours}h</div>
                  <div className="text-xs text-muted-foreground">Writing</div>
                </div>
                <div className="text-center p-2 bg-muted/30 rounded">
                  <div className="font-medium">{optimization.implementation.review_hours}h</div>
                  <div className="text-xs text-muted-foreground">Review</div>
                </div>
              </div>
            </div>

            {/* Required Resources */}
            <div>
              <h4 className="font-medium text-sm mb-2">Required Resources</h4>
              <div className="flex flex-wrap gap-1">
                {optimization.implementation.required_resources.map((resource, index) => (
                  <Badge key={index} variant="outline" className="text-xs">
                    {resource}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Success Metrics */}
            <div>
              <h4 className="font-medium text-sm mb-2">Success Metrics</h4>
              <div className="text-sm text-muted-foreground space-y-1">
                {optimization.impact_assessment.success_metrics.map((metric, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <BarChart3 className="h-3 w-3" />
                    {metric}
                  </div>
                ))}
              </div>
            </div>

            {/* Content Brief */}
            <div>
              <h4 className="font-medium text-sm mb-2">Content Brief</h4>
              <div className="text-sm text-muted-foreground p-3 bg-muted/30 rounded">
                {optimization.implementation.content_brief}
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        <Separator />

        {/* Actions */}
        <div className="flex gap-2">
          <Button 
            onClick={handleMarkComplete} 
            disabled={markComplete.isPending}
            className="flex-1"
          >
            <CheckCircle2 className="h-4 w-4 mr-2" />
            {markComplete.isPending ? 'Marking...' : 'Mark Complete'}
          </Button>
          <Button variant="outline" size="sm">
            <Calendar className="h-4 w-4 mr-2" />
            Schedule
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}