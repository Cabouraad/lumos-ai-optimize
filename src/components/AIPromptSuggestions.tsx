import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Lightbulb, 
  Users, 
  Target, 
  Sparkles, 
  Check, 
  X, 
  Clock,
  Zap,
  Award
} from 'lucide-react';

interface Suggestion {
  id: string;
  text: string;
  source: string;
  created_at: string;
}

interface AIPromptSuggestionsProps {
  suggestions: Suggestion[];
  loading: boolean;
  generating: boolean;
  onAccept: (suggestionId: string) => void;
  onDismiss: (suggestionId: string) => void;
  onGenerate: () => void;
}

export function AIPromptSuggestions({
  suggestions,
  loading,
  generating,
  onAccept,
  onDismiss,
  onGenerate
}: AIPromptSuggestionsProps) {
  const getSourceIcon = (source: string) => {
    switch (source) {
      case 'industry': return <Lightbulb className="h-4 w-4 text-chart-4" />;
      case 'competitors': return <Users className="h-4 w-4 text-chart-5" />;
      case 'gap': return <Target className="h-4 w-4 text-warning" />;
      default: return <Sparkles className="h-4 w-4 text-success" />;
    }
  };

  const getSourceColor = (source: string) => {
    switch (source) {
      case 'industry': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'competitors': return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'gap': return 'bg-orange-50 text-orange-700 border-orange-200';
      default: return 'bg-green-50 text-green-700 border-green-200';
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {/* Header skeleton */}
        <Card className="shadow-soft rounded-2xl border-0">
          <CardHeader>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-96" />
          </CardHeader>
        </Card>
        
        {/* Suggestion skeletons */}
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="shadow-soft rounded-2xl border-0">
            <CardContent className="p-6">
              <Skeleton className="h-20 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card className="shadow-soft rounded-2xl border-0">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Sparkles className="h-6 w-6 text-accent" />
                AI Prompt Suggestions
              </CardTitle>
              <CardDescription className="mt-2">
                {suggestions.length > 0 
                  ? "AI-powered recommendations to improve your search visibility"
                  : "Get intelligent prompt suggestions tailored to your brand and industry"}
              </CardDescription>
            </div>
            <Button
              onClick={onGenerate}
              disabled={generating}
              className="bg-accent hover:bg-accent/90 text-accent-foreground shadow-soft"
            >
              {generating ? (
                <>
                  <Clock className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  {suggestions.length > 0 ? 'Generate More' : 'Generate Suggestions'}
                </>
              )}
            </Button>
          </div>
        </CardHeader>
      </Card>

      {suggestions.length > 0 ? (
        <div className="space-y-4">
          {suggestions.map((suggestion) => (
            <Card key={suggestion.id} className="shadow-soft rounded-2xl border-0 overflow-hidden">
              <CardContent className="p-6">
                <div className="flex items-start justify-between gap-6">
                  <div className="flex-1 space-y-3">
                    {/* Source and metadata */}
                    <div className="flex items-center gap-3">
                      {getSourceIcon(suggestion.source)}
                      <Badge 
                        variant="outline" 
                        className={`text-xs capitalize ${getSourceColor(suggestion.source)}`}
                      >
                        {suggestion.source}
                      </Badge>
                      <span className="text-xs text-gray-500">
                        {new Date(suggestion.created_at).toLocaleDateString()}
                      </span>
                    </div>

                    {/* Suggestion text */}
                    <div className="bg-gray-50/50 rounded-xl p-4 border border-gray-100">
                      <p className="text-sm font-medium text-gray-900 leading-relaxed">
                        {suggestion.text}
                      </p>
                    </div>

                    {/* AI reasoning (mock) */}
                    <div className="text-xs text-gray-600 bg-blue-50/50 p-3 rounded-lg border border-blue-100">
                      <div className="flex items-start gap-2">
                        <Zap className="h-3 w-3 text-blue-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <span className="font-medium text-blue-900">AI Insight:</span>
                          <span className="ml-1">
                            This prompt targets a gap in your current coverage and could improve visibility in 
                            {suggestion.source === 'competitors' ? ' competitor comparison queries' : 
                             suggestion.source === 'industry' ? ' industry-specific searches' : 
                             ' underperforming search categories'}.
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2">
                    <Button
                      size="sm"
                      onClick={() => onAccept(suggestion.id)}
                      className="bg-success hover:bg-success/90 text-success-foreground h-8 px-4"
                    >
                      <Check className="mr-1 h-3 w-3" />
                      Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onDismiss(suggestion.id)}
                      className="text-gray-600 hover:text-gray-700 hover:bg-gray-50 h-8 px-4"
                    >
                      <X className="mr-1 h-3 w-3" />
                      Dismiss
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        /* Empty State */
        <Card className="shadow-soft rounded-2xl border-0">
          <CardContent className="text-center py-12">
            <div className="max-w-md mx-auto">
              <div className="w-16 h-16 bg-accent/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Award className="h-8 w-8 text-accent" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">
                No suggestions yet
              </h3>
              <p className="text-gray-600 mb-6 leading-relaxed">
                Click "Generate Suggestions" to get AI-powered prompt recommendations 
                tailored to your brand, industry, and existing prompt performance.
              </p>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-100">
                  <Lightbulb className="h-6 w-6 text-amber-600 mx-auto mb-2" />
                  <div className="text-xs font-medium text-amber-900">Industry</div>
                  <div className="text-xs text-amber-700">Trends</div>
                </div>
                <div className="p-3 bg-purple-50 rounded-xl border border-purple-100">
                  <Users className="h-6 w-6 text-purple-600 mx-auto mb-2" />
                  <div className="text-xs font-medium text-purple-900">Competitor</div>
                  <div className="text-xs text-purple-700">Analysis</div>
                </div>
                <div className="p-3 bg-orange-50 rounded-xl border border-orange-100">
                  <Target className="h-6 w-6 text-orange-600 mx-auto mb-2" />
                  <div className="text-xs font-medium text-orange-900">Coverage</div>
                  <div className="text-xs text-orange-700">Gaps</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}