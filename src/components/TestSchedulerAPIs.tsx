import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Play, CheckCircle, XCircle, Clock, AlertTriangle, Zap } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { SchedulerTestAdmin } from './SchedulerTestAdmin';

interface APITestResult {
  provider: string;
  success: boolean;
  response?: string;
  model?: string;
  tokenIn?: number;
  tokenOut?: number;
  error?: string;
  duration?: number;
}

interface TestSummary {
  timestamp: string;
  nyTime: string;
  isPast3AM: boolean;
  testPrompt: string;
  apiTests: APITestResult[];
  schedulerReady: boolean;
  databaseStatus: {
    organizations: number;
    activePrompts: number;
    enabledProviders: string[];
  };
  recommendations: {
    readyForScheduledRun: boolean;
    issues: string[];
  };
}

export default function TestSchedulerAPIs() {
  const [loading, setLoading] = useState(false);
  const [isManualRunning, setIsManualRunning] = useState(false);
  const [results, setResults] = useState<TestSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [manualRunResult, setManualRunResult] = useState<any | null>(null);
  const [manualRunError, setManualRunError] = useState<string | null>(null);

  const runTest = async () => {
    setLoading(true);
    setError(null);
    setResults(null);

    try {
      const { data, error: invocationError } = await supabase.functions.invoke('test-scheduler-apis', {});

      if (invocationError) {
        throw invocationError;
      }

      setResults(data as TestSummary);
    } catch (err: any) {
      setError(err.message || 'Failed to run API tests');
      console.error('Test error:', err);
    } finally {
      setLoading(false);
    }
  };

  const runAllPrompts = async () => {
    setIsManualRunning(true);
    setManualRunError(null);
    setManualRunResult(null);

    try {
      const { data, error: invocationError } = await supabase.functions.invoke('daily-scan', {
        body: { manualRun: true }
      });

      if (invocationError) {
        throw invocationError;
      }

      setManualRunResult(data);
    } catch (err: any) {
      setManualRunError(err.message || 'Failed to run all prompts');
      console.error('Manual run error:', err);
    } finally {
      setIsManualRunning(false);
    }
  };

  const getProviderIcon = (result: APITestResult) => {
    if (result.success) {
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    }
    return <XCircle className="h-4 w-4 text-red-500" />;
  };

  const getProviderBadge = (result: APITestResult) => {
    return (
      <Badge variant={result.success ? 'default' : 'destructive'}>
        {result.success ? 'Working' : 'Failed'}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Play className="h-5 w-5" />
            Scheduler API Tests
          </CardTitle>
          <CardDescription>
            Test all three AI provider APIs (OpenAI, Perplexity, Gemini) to ensure the scheduler can run properly at 3AM EST.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={runTest} 
            disabled={loading}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Running Tests...
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                Test All APIs
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {results && (
        <div className="space-y-4">
          {/* Overall Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Scheduler Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Current NY Time</p>
                  <p className="font-mono">{results.nyTime}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Past 3AM EST</p>
                  <Badge variant={results.isPast3AM ? 'default' : 'secondary'}>
                    {results.isPast3AM ? 'Yes' : 'No'}
                  </Badge>
                </div>
              </div>
              
              <div>
                <p className="text-sm text-muted-foreground">Ready for Scheduled Run</p>
                <Badge variant={results.recommendations.readyForScheduledRun ? 'default' : 'destructive'}>
                  {results.recommendations.readyForScheduledRun ? 'Ready' : 'Not Ready'}
                </Badge>
              </div>

              {results.recommendations.issues.length > 0 && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Issues Found:</strong>
                    <ul className="mt-2 space-y-1">
                      {results.recommendations.issues.map((issue, index) => (
                        <li key={index} className="text-sm">• {issue}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* API Test Results */}
          <Card>
            <CardHeader>
              <CardTitle>API Provider Tests</CardTitle>
              <CardDescription>Test prompt: "{results.testPrompt}"</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {results.apiTests.map((result) => (
                  <div key={result.provider} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {getProviderIcon(result)}
                        <span className="font-medium capitalize">{result.provider}</span>
                        {result.model && (
                          <Badge variant="outline">{result.model}</Badge>
                        )}
                      </div>
                      {getProviderBadge(result)}
                    </div>

                    {result.success ? (
                      <div className="space-y-2 text-sm text-muted-foreground">
                        <p>
                          <strong>Duration:</strong> {result.duration}ms
                        </p>
                        <p>
                          <strong>Tokens:</strong> {result.tokenIn} in / {result.tokenOut} out
                        </p>
                        {result.response && (
                          <div>
                            <strong>Response Preview:</strong>
                            <p className="mt-1 p-2 bg-muted rounded text-xs max-h-24 overflow-y-auto">
                              {result.response.substring(0, 200)}
                              {result.response.length > 200 && '...'}
                            </p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-sm text-red-600">
                        <strong>Error:</strong> {result.error}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Database Status */}
          <Card>
            <CardHeader>
              <CardTitle>Database Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Organizations</p>
                  <p className="text-2xl font-bold">{results.databaseStatus.organizations}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Active Prompts</p>
                  <p className="text-2xl font-bold">{results.databaseStatus.activePrompts}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Enabled Providers</p>
                  <p className="text-2xl font-bold">{results.databaseStatus.enabledProviders.length}</p>
                </div>
              </div>
              
              {results.databaseStatus.enabledProviders.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm text-muted-foreground mb-2">Enabled Providers:</p>
                  <div className="flex gap-2">
                    {results.databaseStatus.enabledProviders.map((provider) => (
                      <Badge key={provider} variant="outline">
                        {provider}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="text-xs text-muted-foreground">
            Last tested: {new Date(results.timestamp).toLocaleString()}
          </div>
        </div>
      )}

      {/* Manual Run All Prompts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Manual Run All Prompts
          </CardTitle>
          <CardDescription>
            Manually trigger the daily scan to run all active prompts across all organizations immediately. This bypasses the 3AM EST schedule and idempotency checks.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={runAllPrompts} 
            disabled={isManualRunning}
            className="w-full"
            variant="secondary"
          >
            {isManualRunning ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Running All Prompts...
              </>
            ) : (
              <>
                <Zap className="mr-2 h-4 w-4" />
                Run All Prompts Now
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {manualRunError && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>{manualRunError}</AlertDescription>
        </Alert>
      )}

      {manualRunResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              Manual Run Results
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <Badge variant="default">{manualRunResult.status}</Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Run Type</p>
                <Badge variant="outline">
                  {manualRunResult.manualRun ? 'Manual' : manualRunResult.testMode ? 'Test' : 'Scheduled'}
                </Badge>
              </div>
            </div>
            
            {manualRunResult.result && (
              <>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Organizations Processed</p>
                    <p className="text-2xl font-bold">{manualRunResult.result.organizations}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Runs</p>
                    <p className="text-2xl font-bold">{manualRunResult.result.totalRuns}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Successful Runs</p>
                    <p className="text-2xl font-bold text-green-600">{manualRunResult.result.successfulRuns}</p>
                  </div>
                </div>
                
                <div className="text-sm text-muted-foreground">
                  <p><strong>Success Rate:</strong> {manualRunResult.result.totalRuns > 0 ? Math.round((manualRunResult.result.successfulRuns / manualRunResult.result.totalRuns) * 100) : 0}%</p>
                  <p><strong>Completed at:</strong> {new Date(manualRunResult.timestamp).toLocaleString()}</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      <SchedulerTestAdmin />
    </div>
  );
}