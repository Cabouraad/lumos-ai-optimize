import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { 
  Play, 
  Loader2, 
  AlertCircle, 
  CheckCircle, 
  Eye,
  Target,
  Users,
  Zap,
  Clock
} from 'lucide-react';
import { toast } from 'sonner';
import { getOrgId } from '@/lib/auth';

interface DebugResult {
  provider: string;
  status: 'idle' | 'running' | 'success' | 'error';
  response?: any;
  error?: string;
  startTime?: number;
  endTime?: number;
}

export function ProviderDebugPanel() {
  const [prompts, setPrompts] = useState<any[]>([]);
  const [selectedPromptId, setSelectedPromptId] = useState<string>('');
  const [selectedPrompt, setSelectedPrompt] = useState<any>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<DebugResult[]>([]);

  const providers = ['openai', 'gemini', 'perplexity'];

  // Load prompts on component mount
  useEffect(() => {
    loadPrompts();
  }, []);

  const loadPrompts = async () => {
    try {
      const orgId = await getOrgId();
      const { data, error } = await supabase
        .from('prompts')
        .select('id, text')
        .eq('org_id', orgId)
        .eq('active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPrompts(data || []);
      
      if (data && data.length > 0) {
        setSelectedPromptId(data[0].id);
        setSelectedPrompt(data[0]);
      }
    } catch (error: any) {
      console.error('Error loading prompts:', error);
      toast.error('Failed to load prompts');
    }
  };

  const handlePromptChange = (promptId: string) => {
    const prompt = prompts.find(p => p.id === promptId);
    setSelectedPromptId(promptId);
    setSelectedPrompt(prompt);
    setResults([]); // Clear previous results
  };

  const runAllProviders = async () => {
    if (!selectedPrompt) {
      toast.error('Please select a prompt first');
      return;
    }

    setIsRunning(true);
    setResults(providers.map(p => ({ 
      provider: p, 
      status: 'running' as const, 
      startTime: Date.now() 
    })));

    const orgId = await getOrgId();
    
    console.log('=== PROVIDER DEBUG START ===');
    console.log('Prompt:', selectedPrompt.text.substring(0, 100) + '...');

    const providerPromises = providers.map(async (provider) => {
      const startTime = Date.now();
      
      try {
        console.log(`Running ${provider}...`);
        
        const { data, error } = await supabase.functions.invoke('test-single-provider', {
          body: {
            promptText: selectedPrompt.text,
            provider,
            orgId,
            promptId: selectedPrompt.id
          },
          headers: {
            'Content-Type': 'application/json'
          }
        });

        const endTime = Date.now();

        if (error) {
          console.error(`${provider} error:`, error);
          return { 
            provider, 
            status: 'error' as const, 
            error: error.message || 'Unknown error', 
            startTime, 
            endTime 
          };
        }
        
        // Check if response indicates failure
        if (data && !data.success) {
          console.error(`${provider} API failure:`, data.error);
          return { 
            provider, 
            status: 'error' as const, 
            error: data.error || 'API call failed', 
            startTime, 
            endTime 
          };
        }

        console.log(`✅ ${provider} success:`, data);
        return { 
          provider, 
          status: 'success' as const, 
          response: data, 
          startTime, 
          endTime 
        };
      } catch (err: any) {
        console.error(`${provider} exception:`, err);
        return { 
          provider, 
          status: 'error' as const, 
          error: err.message, 
          startTime, 
          endTime: Date.now() 
        };
      }
    });

    try {
      const allResults = await Promise.all(providerPromises);
      setResults(allResults);
      
      const successCount = allResults.filter(r => r.status === 'success').length;
      toast.success(`Provider test complete: ${successCount}/${providers.length} successful`);
    } catch (error: any) {
      console.error('Provider test error:', error);
      toast.error('Provider test failed');
    } finally {
      setIsRunning(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running': return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case 'success': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error': return <AlertCircle className="h-4 w-4 text-red-500" />;
      default: return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'success': return 'bg-green-100 text-green-800 border-green-200';
      case 'error': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const formatDuration = (startTime?: number, endTime?: number) => {
    if (!startTime || !endTime) return '';
    const ms = endTime - startTime;
    return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Provider Debug Panel
          </span>
          <Button 
            onClick={runAllProviders} 
            disabled={isRunning || !selectedPrompt}
            size="sm"
          >
            {isRunning ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Play className="h-4 w-4 mr-2" />
            )}
            Test All Providers
          </Button>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Prompt Selection */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Select Prompt to Test</label>
          <Select value={selectedPromptId} onValueChange={handlePromptChange}>
            <SelectTrigger>
              <SelectValue placeholder="Choose a prompt..." />
            </SelectTrigger>
            <SelectContent>
              {prompts.map((prompt) => (
                <SelectItem key={prompt.id} value={prompt.id}>
                  {prompt.text.length > 60 
                    ? prompt.text.substring(0, 60) + '...' 
                    : prompt.text
                  }
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Selected Prompt Preview */}
        {selectedPrompt && (
          <div className="p-3 bg-muted/30 rounded-lg">
            <h4 className="text-sm font-medium mb-2">Selected Prompt</h4>
            <p className="text-sm text-muted-foreground break-words">
              {selectedPrompt.text}
            </p>
          </div>
        )}

        {/* Provider Results */}
        {results.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-semibold">Provider Results</h4>
            {results.map((result) => (
              <div key={result.provider} className="border rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(result.status)}
                    <span className="font-medium capitalize">{result.provider}</span>
                    <Badge className={`text-xs ${getStatusColor(result.status)}`}>
                      {result.status}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center gap-4 text-sm">
                    {result.status === 'success' && result.response && (
                      <>
                        <div className="flex items-center gap-1">
                          <Target className="h-3 w-3" />
                          <span>{result.response.score || 0}/10</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          <span>{result.response.competitors?.length || 0}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Zap className="h-3 w-3" />
                          <span>{(result.response.tokenIn || 0) + (result.response.tokenOut || 0)}</span>
                        </div>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm">
                              <Eye className="h-3 w-3 mr-1" />
                              View Response
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                            <DialogHeader>
                              <DialogTitle>{result.provider} Response</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div className="grid grid-cols-3 gap-4 text-sm">
                                <div>
                                  <span className="font-medium">Score:</span> {result.response.score}/10
                                </div>
                                <div>
                                  <span className="font-medium">Brand Present:</span> {result.response.orgBrandPresent ? 'Yes' : 'No'}
                                </div>
                                <div>
                                  <span className="font-medium">Competitors:</span> {result.response.competitors?.length || 0}
                                </div>
                              </div>
                              
                              {result.response.competitors && result.response.competitors.length > 0 && (
                                <div>
                                  <h4 className="font-medium mb-2">Detected Competitors:</h4>
                                  <div className="flex flex-wrap gap-1">
                                    {result.response.competitors.map((comp: string, idx: number) => (
                                      <Badge key={idx} variant="outline" className="text-xs">
                                        {comp}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              )}
                              
                              <div>
                                <h4 className="font-medium mb-2">Raw Response:</h4>
                                <div className="bg-muted p-4 rounded-lg text-sm font-mono max-h-96 overflow-y-auto">
                                  {result.response.responseText || 'No response text available'}
                                </div>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </>
                    )}
                    
                    {result.status === 'error' && (
                      <span className="text-red-600 text-sm max-w-xs truncate">
                        {result.error}
                      </span>
                    )}
                    
                    <span className="text-muted-foreground text-sm">
                      {formatDuration(result.startTime, result.endTime)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
            
            {/* Summary */}
            <div className="mt-4 p-4 bg-muted/30 rounded-lg">
              <h4 className="text-sm font-medium mb-2">Test Summary</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Success Rate:</span>
                  <div className="font-mono font-medium">
                    {results.filter(r => r.status === 'success').length}/{results.length}
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">Avg Duration:</span>
                  <div className="font-mono font-medium">
                    {results.length > 0 && results.every(r => r.startTime && r.endTime)
                      ? `${Math.round(results.reduce((sum, r) => sum + (r.endTime! - r.startTime!), 0) / results.length)}ms`
                      : 'N/A'
                    }
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">Total Tokens:</span>
                  <div className="font-mono font-medium">
                    {results
                      .filter(r => r.response)
                      .reduce((sum, r) => sum + ((r.response.tokenIn || 0) + (r.response.tokenOut || 0)), 0)
                    }
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">Avg Score:</span>
                  <div className="font-mono font-medium">
                    {results.filter(r => r.response?.score).length > 0
                      ? (results
                          .filter(r => r.response?.score)
                          .reduce((sum, r) => sum + (r.response.score || 0), 0) / 
                        results.filter(r => r.response?.score).length
                        ).toFixed(1)
                      : 'N/A'
                    }
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Empty State */}
        {results.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <Target className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <h3 className="font-medium mb-2">Ready to Test Providers</h3>
            <p className="text-sm">
              Select a prompt and click "Test All Providers" to see how it performs across OpenAI, Gemini, and Perplexity.
            </p>
          </div>
        )}

        {prompts.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <h3 className="font-medium mb-2">No Active Prompts</h3>
            <p className="text-sm">
              Create some active prompts first to use the provider debug panel.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}