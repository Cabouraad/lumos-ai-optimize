
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Play, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface DebugResult {
  provider: string;
  status: 'running' | 'success' | 'error';
  response?: any;
  error?: string;
  startTime?: number;
  endTime?: number;
}

interface ProviderDebugPanelProps {
  promptId: string;
  promptText: string;
  orgId: string;
}

export function ProviderDebugPanel({ promptId, promptText, orgId }: ProviderDebugPanelProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<DebugResult[]>([]);
  const { toast } = useToast();

  const providers = ['openai', 'perplexity', 'gemini'];

  const runAllProviders = async () => {
    setIsRunning(true);
    setResults(providers.map(p => ({ provider: p, status: 'running' as const, startTime: Date.now() })));

    const promises = providers.map(async (provider) => {
      try {
        const startTime = Date.now();
        const { data, error } = await supabase.functions.invoke('execute-prompt', {
          body: {
            promptText,
            provider,
            orgId,
            promptId
          }
        });

        const endTime = Date.now();

        if (error) {
          return { provider, status: 'error' as const, error: error.message, startTime, endTime };
        }

        return { 
          provider, 
          status: 'success' as const, 
          response: data, 
          startTime, 
          endTime 
        };
      } catch (err: any) {
        return { 
          provider, 
          status: 'error' as const, 
          error: err.message, 
          startTime: Date.now(), 
          endTime: Date.now() 
        };
      }
    });

    const allResults = await Promise.all(promises);
    setResults(allResults);
    setIsRunning(false);

    const successCount = allResults.filter(r => r.status === 'success').length;
    toast({
      title: "Provider Test Complete",
      description: `${successCount}/${providers.length} providers completed successfully`,
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running': return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case 'success': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error': return <AlertCircle className="h-4 w-4 text-red-500" />;
      default: return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'bg-blue-100 text-blue-800';
      case 'success': return 'bg-green-100 text-green-800';
      case 'error': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDuration = (startTime?: number, endTime?: number) => {
    if (!startTime || !endTime) return '';
    return `${endTime - startTime}ms`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Provider Debug Panel</span>
          <Button 
            onClick={runAllProviders} 
            disabled={isRunning}
            className="h-8"
          >
            {isRunning ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Play className="h-4 w-4 mr-2" />
            )}
            Run All Providers
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {providers.map((provider) => {
            const result = results.find(r => r.provider === provider);
            
            return (
              <div key={provider} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  {result ? getStatusIcon(result.status) : <div className="h-4 w-4" />}
                  <span className="font-medium capitalize">{provider}</span>
                  {result && (
                    <Badge className={getStatusColor(result.status)}>
                      {result.status}
                    </Badge>
                  )}
                </div>
                
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  {result && result.status === 'success' && result.response && (
                    <>
                      <span>Score: {result.response.score}/10</span>
                      <span>Brands: {result.response.brands?.length || 0}</span>
                      <span>Tokens: {(result.response.tokenIn || 0) + (result.response.tokenOut || 0)}</span>
                    </>
                  )}
                  
                  {result && result.status === 'error' && (
                    <span className="text-red-600 max-w-xs truncate">
                      {result.error}
                    </span>
                  )}
                  
                  {result && (
                    <span>{formatDuration(result.startTime, result.endTime)}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        
        {results.length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <h4 className="text-sm font-medium mb-2">Summary</h4>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Success Rate:</span>
                <div className="font-mono">
                  {results.filter(r => r.status === 'success').length}/{results.length}
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">Avg Duration:</span>
                <div className="font-mono">
                  {Math.round(results
                    .filter(r => r.startTime && r.endTime)
                    .reduce((sum, r) => sum + (r.endTime! - r.startTime!), 0) / results.length)}ms
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">Total Tokens:</span>
                <div className="font-mono">
                  {results
                    .filter(r => r.response)
                    .reduce((sum, r) => sum + ((r.response.tokenIn || 0) + (r.response.tokenOut || 0)), 0)}
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
