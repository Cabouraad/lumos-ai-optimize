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
  BarChart3,
  History
} from 'lucide-react';
import { toast } from 'sonner';
import { getOrgId } from '@/lib/auth';

interface PromptResult {
  promptId: string;
  promptText: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  providers: {
    openai: 'pending' | 'running' | 'success' | 'error';
    gemini: 'pending' | 'running' | 'success' | 'error';
    perplexity: 'pending' | 'running' | 'success' | 'error';
  };
  results: {
    openai?: { score: number; brandPresent: boolean; competitors: number; tokens: number };
    gemini?: { score: number; brandPresent: boolean; competitors: number; tokens: number };
    perplexity?: { score: number; brandPresent: boolean; competitors: number; tokens: number };
  };
  errors: {
    openai?: string;
    gemini?: string;
    perplexity?: string;
  };
  startTime?: number;
  endTime?: number;
}

interface BatchHistory {
  timestamp: string;
  totalPrompts: number;
  successfulPrompts: number;
  successRate: number;
  duration: number;
}

export function BatchPromptRunner() {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<PromptResult[]>([]);
  const [currentPromptIndex, setCurrentPromptIndex] = useState(0);
  const [batchHistory, setBatchHistory] = useState<BatchHistory[]>([]);

  const runAllPrompts = async () => {
    const startTime = Date.now();
    setIsRunning(true);
    setResults([]);
    setCurrentPromptIndex(0);

    try {
      const orgId = await getOrgId();
      
      console.log('=== STARTING BATCH RUN ===');
      toast.success('Batch run started - Running all active prompts...');

      const { data, error } = await supabase.functions.invoke('simple-batch-runner', {
        body: { orgId }
      });

      if (error) {
        console.error('Supabase function invocation error:', error);
        throw new Error(`Batch run failed: ${error.message}`);
      }

      if (!data) {
        throw new Error('No data returned from batch run');
      }

      if (!data.success) {
        throw new Error(`Batch run failed: ${data.error || 'Unknown error'}`);
      }

      const endTime = Date.now();
      const duration = Math.round((endTime - startTime) / 1000);

      console.log('✅ BATCH RUN COMPLETE:', data);
      
      setResults(data.results || []);
      
      // Record batch history
      const newHistoryEntry: BatchHistory = {
        timestamp: new Date().toISOString(),
        totalPrompts: data.summary?.totalPrompts || 0,
        successfulPrompts: data.summary?.successfulRuns || 0,
        successRate: data.summary?.successRate || 0,
        duration
      };
      
      setBatchHistory(prev => [newHistoryEntry, ...prev.slice(0, 4)]); // Keep last 5 runs

      toast.success(
        `✅ Batch complete: ${data.summary?.totalPrompts || 0} prompts processed (${data.summary?.successRate || 0}% success)`
      );

    } catch (error: any) {
      console.error('Batch run error:', error);
      toast.error(`❌ Batch run failed: ${error.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  const getProviderIcon = (status: string) => {
    switch (status) {
      case 'running': return <Loader2 className="h-3 w-3 animate-spin text-blue-500" />;
      case 'success': return <CheckCircle className="h-3 w-3 text-green-500" />;
      case 'error': return <AlertCircle className="h-3 w-3 text-red-500" />;
      case 'pending': return <Clock className="h-3 w-3 text-gray-400" />;
      default: return null;
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

  const getSuccessfulPrompts = () => {
    return results.filter(prompt => 
      Object.values(prompt.providers).filter(status => status === 'success').length === 3
    ).length;
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Batch Prompt Runner
          </span>
          <Button 
            onClick={runAllPrompts} 
            disabled={isRunning}
            size="sm"
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
              <span>{results.filter(r => r.status === 'completed').length}/{results.length} prompts completed</span>
            </div>
            <Progress value={calculateProgress()} className="w-full" />
          </div>
        )}
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Batch History */}
        {batchHistory.length > 0 && (
          <div className="p-4 bg-muted/30 rounded-lg">
            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <History className="h-4 w-4" />
              Recent Batch Runs
            </h4>
            <div className="space-y-2">
              {batchHistory.map((run, index) => (
                <div key={index} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-3">
                    <span className="text-muted-foreground font-mono">
                      {new Date(run.timestamp).toLocaleString()}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {run.totalPrompts} prompts
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-green-600 font-medium">
                      {run.successfulPrompts}/{run.totalPrompts} successful
                    </span>
                    <span className="text-muted-foreground">
                      {run.duration}s
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Current Run Results */}
        {results.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold">Current Run Progress</h4>
              <div className="text-sm text-muted-foreground">
                {getSuccessfulPrompts()}/{results.length} prompts fully successful
              </div>
            </div>
            
            <div className="space-y-3">
              {results.map((prompt, index) => (
                <div key={prompt.promptId} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-muted-foreground">#{index + 1}</span>
                        <Badge className={
                          prompt.status === 'completed' ? 'bg-green-100 text-green-800' :
                          prompt.status === 'running' ? 'bg-blue-100 text-blue-800' :
                          prompt.status === 'error' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                        }>
                          {prompt.status}
                        </Badge>
                      </div>
                      <p className="text-sm font-medium truncate">
                        {prompt.promptText}
                      </p>
                    </div>
                  </div>

                  {/* Provider Status Grid */}
                  <div className="grid grid-cols-3 gap-2">
                    {(['openai', 'gemini', 'perplexity'] as const).map((provider) => {
                      const status = prompt.providers[provider];
                      const result = prompt.results[provider];
                      const error = prompt.errors[provider];
                      
                      return (
                        <div 
                          key={provider} 
                          className={`p-3 border rounded-lg text-center ${
                            status === 'success' ? 'bg-green-50 border-green-200' :
                            status === 'error' ? 'bg-red-50 border-red-200' :
                            status === 'running' ? 'bg-blue-50 border-blue-200' :
                            'bg-gray-50 border-gray-200'
                          }`}
                        >
                          <div className="flex items-center justify-center gap-1 mb-2">
                            {getProviderIcon(status)}
                            <span className="text-xs font-medium capitalize">{provider}</span>
                          </div>
                          
                          {result && (
                            <div className="space-y-1 text-xs">
                              <div className="flex items-center justify-center gap-1">
                                <Target className="h-3 w-3" />
                                <span className="font-medium">{result.score}/10</span>
                              </div>
                              <div className="flex items-center justify-center gap-1 text-muted-foreground">
                                <Users className="h-3 w-3" />
                                <span>{result.competitors}</span>
                              </div>
                              <div className="flex items-center justify-center gap-1 text-muted-foreground">
                                <Zap className="h-3 w-3" />
                                <span>{result.tokens}</span>
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
          </div>
        )}

        {/* Empty State */}
        {results.length === 0 && !isRunning && batchHistory.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Play className="h-16 w-16 mx-auto mb-4 opacity-30" />
            <h3 className="text-lg font-medium mb-2">Ready to Run Batch Analysis</h3>
            <p className="text-sm max-w-md mx-auto">
              Click "Run All Active Prompts" to test each active prompt through OpenAI, Gemini, and Perplexity.
              Results will be analyzed using the new response analysis system.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}