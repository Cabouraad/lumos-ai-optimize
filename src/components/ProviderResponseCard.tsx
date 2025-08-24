import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ProviderResponseData } from '@/lib/prompts/provider-data';
import { CheckCircle, XCircle, Trophy, Users, FileText, Clock, Zap } from 'lucide-react';

interface ProviderResponseCardProps {
  provider: 'openai' | 'gemini' | 'perplexity';
  response: ProviderResponseData | null;
  promptText: string;
}

const PROVIDER_CONFIG = {
  openai: { name: 'OpenAI', icon: '🤖', color: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
  gemini: { name: 'Gemini', icon: '✨', color: 'bg-purple-50 border-purple-200 text-purple-700' },
  perplexity: { name: 'Perplexity', icon: '🔍', color: 'bg-blue-50 border-blue-200 text-blue-700' }
};

export function ProviderResponseCard({ provider, response, promptText }: ProviderResponseCardProps) {
  const config = PROVIDER_CONFIG[provider];

  if (!response) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <span className="text-lg">{config.icon}</span>
            {config.name}
            <Badge variant="outline" className="text-xs text-muted-foreground">
              No data
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground text-center py-6">
            No recent responses available
          </div>
        </CardContent>
      </Card>
    );
  }

  const getScoreColor = (score: number) => {
    if (score >= 8) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (score >= 5) return 'bg-amber-50 text-amber-700 border-amber-200';
    return 'bg-rose-50 text-rose-700 border-rose-200';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'error': case 'failed': return 'bg-rose-50 text-rose-700 border-rose-200';
      default: return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const getRelativeTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 30) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const getProminenceText = (prominence: number | null) => {
    if (prominence === null) return 'Not found';
    if (prominence === 1) return '1st position';
    if (prominence === 2) return '2nd position';
    if (prominence === 3) return '3rd position';
    return `${prominence}th position`;
  };

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <span className="text-lg">{config.icon}</span>
            {config.name}
            {response.model && (
              <Badge variant="secondary" className="text-xs">
                {response.model}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Badge className={`text-xs ${getStatusColor(response.status)}`}>
              {response.status}
            </Badge>
            <Badge className={`font-bold px-2 py-1 ${getScoreColor(response.score)}`}>
              {response.score}/10
            </Badge>
          </div>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Last Run Time */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          Last run: {getRelativeTime(response.run_at)}
        </div>

        {response.status === 'error' && response.error ? (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg">
            <p className="text-sm font-medium text-rose-800">Error</p>
            <p className="text-xs text-rose-600 mt-1">{response.error}</p>
          </div>
        ) : (
          <>
            {/* Key Metrics */}
            <div className="grid grid-cols-2 gap-3">
              {/* Brand Presence */}
              <div className="flex items-start gap-2">
                {response.org_brand_present ? (
                  <CheckCircle className="h-4 w-4 text-emerald-500 mt-0.5" />
                ) : (
                  <XCircle className="h-4 w-4 text-rose-500 mt-0.5" />
                )}
                <div>
                  <p className="text-xs font-medium">Brand Found</p>
                  <p className="text-xs text-muted-foreground">
                    {response.org_brand_present ? 'Yes' : 'No'}
                  </p>
                </div>
              </div>

              {/* Brand Position */}
              <div className="flex items-start gap-2">
                <Trophy className="h-4 w-4 text-amber-500 mt-0.5" />
                <div>
                  <p className="text-xs font-medium">Position</p>
                  <p className="text-xs text-muted-foreground">
                    {getProminenceText(response.org_brand_prominence)}
                  </p>
                </div>
              </div>

              {/* Competitors */}
              <div className="flex items-start gap-2">
                <Users className="h-4 w-4 text-blue-500 mt-0.5" />
                <div>
                  <p className="text-xs font-medium">Competitors</p>
                  <p className="text-xs text-muted-foreground">
                    {response.competitors_count} found
                  </p>
                </div>
              </div>

              {/* Tokens */}
              <div className="flex items-start gap-2">
                <Zap className="h-4 w-4 text-purple-500 mt-0.5" />
                <div>
                  <p className="text-xs font-medium">Tokens</p>
                  <p className="text-xs text-muted-foreground">
                    {response.token_in + response.token_out}
                  </p>
                </div>
              </div>
            </div>

            {/* Competitors Found */}
            {response.competitors_json && Array.isArray(response.competitors_json) && response.competitors_json.length > 0 && (
              <div>
                <p className="text-xs font-medium mb-2">Competitors Found:</p>
                <div className="flex flex-wrap gap-1">
                  {response.competitors_json.slice(0, 4).map((competitor: string, index: number) => (
                    <Badge key={index} variant="outline" className="text-xs px-1.5 py-0.5">
                      {competitor}
                    </Badge>
                  ))}
                  {response.competitors_json.length > 4 && (
                    <Badge variant="outline" className="text-xs px-1.5 py-0.5 text-muted-foreground">
                      +{response.competitors_json.length - 4} more
                    </Badge>
                  )}
                </div>
              </div>
            )}

            {/* AI Response Preview */}
            {response.raw_ai_response && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium">AI Response:</p>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" className="h-6 text-xs px-2">
                        <FileText className="h-3 w-3 mr-1" />
                        View Full
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-4xl max-h-[80vh]">
                      <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                          <span className="text-lg">{config.icon}</span>
                          {config.name} Response
                        </DialogTitle>
                        <DialogDescription>
                          Response to: "{promptText.substring(0, 100)}..."
                        </DialogDescription>
                      </DialogHeader>
                      <ScrollArea className="max-h-96 mt-4">
                        <div className="p-4 bg-muted rounded-lg">
                          <pre className="whitespace-pre-wrap text-sm leading-relaxed">
                            {response.raw_ai_response}
                          </pre>
                        </div>
                      </ScrollArea>
                    </DialogContent>
                  </Dialog>
                </div>
                <div className="text-xs text-muted-foreground bg-muted/30 p-2 rounded border-l-2 border-primary/30 line-clamp-3">
                  {response.raw_ai_response.length > 120 
                    ? `${response.raw_ai_response.substring(0, 120)}...` 
                    : response.raw_ai_response
                  }
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}