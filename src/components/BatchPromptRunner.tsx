import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { 
  Play, 
  Loader2, 
  AlertCircle, 
  CheckCircle, 
  Clock,
  Target,
  Users,
  Zap,
  BarChart3
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getOrgId } from '@/lib/auth';

interface PromptStatus {
  promptId: string;
  promptText: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  currentProvider?: string;
  providers: {
    openai: 'pending' | 'running' | 'success' | 'error';
    gemini: 'pending' | 'running' | 'success' | 'error';
    perplexity: 'pending' | 'running' | 'success' | 'error';
  };
  results: {
    openai?: any;
    gemini?: any;
    perplexity?: any;
  };
  errors: {
    openai?: string;
    gemini?: string;
    perplexity?: string;
  };
  startTime?: number;
  endTime?: number;
}

interface BatchSummary {
  totalPrompts: number;
  totalProviderRuns: number;
  successfulRuns: number;
  errorRuns: number;
  successRate: number;
}

export function BatchPromptRunner() {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<PromptStatus[]>([]);
  const [summary, setSummary] = useState<BatchSummary | null>(null);
  const { toast } = useToast();

  const runAllPrompts = async () => {
    try {
      setIsRunning(true);
      setResults([]);
      setSummary(null);

      const orgId = await getOrgId();

      toast({
        title: "Batch Run Started",
        description: "Running all active prompts through all providers...",
      });

      console.log('Attempting to call batch-run-all-prompts function...');

      const { data, error } = await supabase.functions.invoke('batch-run-all-prompts', {
        body: { orgId }
      });

      console.log('Function call response:', { data, error });

      if (error) {
        console.error('Supabase function error:', error);
        throw new Error(`Function error: ${error.message || error}`);
      }

      setResults(data.results || []);
      setSummary(data.summary);

      const successRate = data.summary?.successRate || 0;
      toast({
        title: "Batch Run Complete",
        description: `Processed ${data.summary?.totalPrompts || 0} prompts with ${successRate}% success rate`,
      });

    } catch (error: any) {
      console.error('Batch run error:', error);
      
      // More detailed error message
      let errorMessage = error.message || 'Unknown error occurred';
      if (errorMessage.includes('Failed to send a request')) {
        errorMessage = 'Edge function not available. It may still be deploying. Please try again in a few moments.';
      }
      
      toast({
        title: "Batch Run Failed", 
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsRunning(false);
    }
  };

  const getProviderIcon = (status: string, provider?: string) => {
    const providerEmoji = provider === 'openai' ? '🤖' : provider === 'gemini' ? '✨' : '🔍';
    
    switch (status) {
      case 'running': return <Loader2 className="h-3 w-3 animate-spin text-blue-500" />;
      case 'success': return <CheckCircle className="h-3 w-3 text-green-500" />;
      case 'error': return <AlertCircle className="h-3 w-3 text-red-500" />;
      case 'pending': return <Clock className="h-3 w-3 text-gray-400" />;
      default: return <span className="text-xs">{providerEmoji}</span>;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'success': return 'bg-green-100 text-green-800 border-green-200';
      case 'error': return 'bg-red-100 text-red-800 border-red-200';
      case 'completed': return 'bg-purple-100 text-purple-800 border-purple-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const calculateProgress = () => {
    if (results.length === 0) return 0;
    const totalTasks = results.length * 3; // 3 providers per prompt
    const completedTasks = results.reduce((acc, prompt) => {
      return acc + Object.values(prompt.providers).filter(status => 
        status === 'success' || status === 'error'
      ).length;
    }, 0);
    return Math.round((completedTasks / totalTasks) * 100);
  };

  const formatDuration = (startTime?: number, endTime?: number) => {
    if (!startTime || !endTime) return '';
    return `${endTime - startTime}ms`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Batch Prompt Runner</span>
          <Button 
            onClick={runAllPrompts} 
            disabled={isRunning}
            className="h-8"
          >
            {isRunning ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Play className="h-4 w-4 mr-2" />
            )}
            Run All Active Prompts
          </Button>
        </CardTitle>
        {isRunning && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Progress: {calculateProgress()}%</span>
              <span>{results.filter(r => r.status === 'completed').length}/{results.length} prompts</span>
            </div>
            <Progress value={calculateProgress()} className="w-full" />
          </div>
        )}
      </CardHeader>
      
      <CardContent>
        {/* Summary Stats */}
        {summary && (
          <div className="mb-6 p-4 bg-muted/30 rounded-lg">
            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Batch Run Summary
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <div className="text-muted-foreground">Prompts Processed</div>
                <div className="font-mono text-lg">{summary.totalPrompts}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Success Rate</div>
                <div className="font-mono text-lg">{summary.successRate}%</div>
              </div>
              <div>
                <div className="text-muted-foreground">Successful Runs</div>
                <div className="font-mono text-lg text-green-600">{summary.successfulRuns}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Failed Runs</div>
                <div className="font-mono text-lg text-red-600">{summary.errorRuns}</div>
              </div>
            </div>
          </div>
        )}

        {/* Prompt Results */}
        {results.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-semibold">Prompt Results</h4>
            {results.map((prompt, index) => (
              <div key={prompt.promptId} className="border rounded-lg p-4 space-y-3">
                {/* Prompt Header */}
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-muted-foreground">#{index + 1}</span>
                      <Badge className={`text-xs ${getStatusColor(prompt.status)}`}>
                        {prompt.status}
                      </Badge>
                      {prompt.currentProvider && (
                        <Badge variant="outline" className="text-xs">
                          Running: {prompt.currentProvider}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm font-medium truncate" title={prompt.promptText}>
                      {prompt.promptText}
                    </p>
                    {prompt.startTime && prompt.endTime && (
                      <p className="text-xs text-muted-foreground">
                        Duration: {formatDuration(prompt.startTime, prompt.endTime)}
                      </p>
                    )}
                  </div>
                </div>

                {/* Provider Status */}
                <div className="grid grid-cols-3 gap-2">
                  {Object.entries(prompt.providers).map(([provider, status]) => {
                    const result = prompt.results[provider as keyof typeof prompt.results];
                    const error = prompt.errors[provider as keyof typeof prompt.errors];
                    
                    return (
                      <div 
                        key={provider} 
                        className={`p-2 border rounded text-center ${
                          status === 'success' ? 'bg-green-50 border-green-200' :
                          status === 'error' ? 'bg-red-50 border-red-200' :
                          status === 'running' ? 'bg-blue-50 border-blue-200' :
                          'bg-gray-50 border-gray-200'
                        }`}
                      >
                        <div className="flex items-center justify-center gap-1 mb-1">
                          {getProviderIcon(status, provider)}
                          <span className="text-xs font-medium capitalize">{provider}</span>
                        </div>
                        
                        {result && (
                          <div className="space-y-1 text-xs text-muted-foreground">
                            <div className="flex items-center justify-center gap-1">
                              <Target className="h-3 w-3" />
                              <span>{result.score}/10</span>
                            </div>
                            <div className="flex items-center justify-center gap-1">
                              <Users className="h-3 w-3" />
                              <span>{result.competitors}</span>
                            </div>
                            <div className="flex items-center justify-center gap-1">
                              <Zap className="h-3 w-3" />
                              <span>{result.tokenIn + result.tokenOut}</span>
                            </div>
                          </div>
                        )}
                        
                        {error && (
                          <div className="text-xs text-red-600 truncate" title={error}>
                            {error}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {results.length === 0 && !isRunning && (
          <div className="text-center py-8 text-muted-foreground">
            <Play className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Click "Run All Active Prompts" to begin batch processing</p>
            <p className="text-sm mt-1">This will run each active prompt through OpenAI, Gemini, and Perplexity</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}