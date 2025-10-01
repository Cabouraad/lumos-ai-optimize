import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';
import { toast } from 'sonner';
import { Play, CheckCircle2, XCircle, Clock, Loader2, Terminal, AlertTriangle, Users } from 'lucide-react';

interface TestResult {
  name: string;
  passed: boolean;
  output: string;
  duration: number;
}

interface TestSummary {
  total: number;
  passed: number;
  failed: number;
  duration: number;
}

export default function TestDashboard() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<TestResult[]>([]);
  const [summary, setSummary] = useState<TestSummary | null>(null);
  const [selectedTest, setSelectedTest] = useState<TestResult | null>(null);

  useEffect(() => {
    checkAdminAccess();
  }, [user]);

  const checkAdminAccess = async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    
    try {
      const { data: userData, error } = await supabase
        .from('users')
        .select('role, org_id')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      setIsAdmin(userData.role === 'owner');
    } catch (error) {
      console.error('Error checking admin access:', error);
      setIsAdmin(false);
    } finally {
      setLoading(false);
    }
  };

  const runTests = async (suite: 'quick' | 'all') => {
    setRunning(true);
    setResults([]);
    setSummary(null);
    setSelectedTest(null);

    try {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase.functions.invoke('run-tests', {
        body: { suite },
      });

      if (error) throw error;

      if (data?.error) {
        throw new Error(data.error);
      }

      setResults(data.results || []);
      setSummary(data.summary || null);

      if (data.summary?.failed === 0) {
        toast.success(`All ${data.summary.passed} tests passed! 🎉`);
      } else {
        toast.error(`${data.summary.failed} test(s) failed`);
      }
    } catch (error: any) {
      console.error('Test error:', error);
      toast.error(`Failed to run tests: ${error.message || error}`);
    } finally {
      setRunning(false);
    }
  };

  if (!user || loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Alert>
          <Users className="h-4 w-4" />
          <AlertDescription>
            Test Dashboard access is restricted to organization owners only.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Test Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Run edge function tests and view results
          </p>
        </div>
      </div>

      {/* Test Controls */}
      <Card>
          <CardHeader>
            <CardTitle>Test Suites</CardTitle>
            <CardDescription>
              Run edge function tests to verify everything is working correctly
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <Button
                onClick={() => runTests('quick')}
                disabled={running}
                className="flex items-center gap-2"
              >
                {running ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                Quick Test (4 core functions)
              </Button>
              <Button
                onClick={() => runTests('all')}
                disabled={running}
                variant="outline"
                className="flex items-center gap-2"
              >
                {running ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                Run All Tests
              </Button>
            </div>

            {summary && (
              <div className="flex gap-4 p-4 bg-muted rounded-lg">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">
                    <strong>{summary.duration}ms</strong> total
                  </span>
                </div>
                <Separator orientation="vertical" />
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span className="text-sm">
                    <strong>{summary.passed}</strong> passed
                  </span>
                </div>
                {summary.failed > 0 && (
                  <>
                    <Separator orientation="vertical" />
                    <div className="flex items-center gap-2">
                      <XCircle className="h-4 w-4 text-destructive" />
                      <span className="text-sm">
                        <strong>{summary.failed}</strong> failed
                      </span>
                    </div>
                  </>
                )}
              </div>
            )}
        </CardContent>
      </Card>

      {/* Test Results */}
      {results.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Results List */}
            <Card>
              <CardHeader>
                <CardTitle>Test Results</CardTitle>
                <CardDescription>
                  Click on a test to view detailed output
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px]">
                  <div className="space-y-2">
                    {results.map((result, idx) => (
                      <button
                        key={idx}
                        onClick={() => setSelectedTest(result)}
                        className={`w-full p-4 rounded-lg border text-left transition-colors ${
                          selectedTest === result
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:bg-muted/50'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            {result.passed ? (
                              <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                            ) : (
                              <XCircle className="h-5 w-5 text-destructive flex-shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{result.name}</p>
                              <p className="text-sm text-muted-foreground">
                                {result.duration}ms
                              </p>
                            </div>
                          </div>
                          <Badge variant={result.passed ? 'default' : 'destructive'}>
                            {result.passed ? 'Passed' : 'Failed'}
                          </Badge>
                        </div>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Test Output */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Terminal className="h-5 w-5" />
                  Test Output
                </CardTitle>
                <CardDescription>
                  {selectedTest ? selectedTest.name : 'Select a test to view output'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {selectedTest ? (
                  <ScrollArea className="h-[500px]">
                    <pre className="text-xs font-mono bg-muted p-4 rounded-lg overflow-x-auto whitespace-pre-wrap break-words">
                      {selectedTest.output}
                    </pre>
                  </ScrollArea>
                ) : (
                  <div className="h-[500px] flex items-center justify-center text-muted-foreground">
                    Select a test to view detailed output
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Test Guide */}
        <Card>
          <CardHeader>
            <CardTitle>Testing Guide</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">Quick Test Suite</h3>
              <p className="text-sm text-muted-foreground">
                Runs 4 core function tests: generate-visibility-recommendations, run-prompt-now,
                llms-generate, and diag. Use this for quick smoke testing.
              </p>
            </div>
            <Separator />
            <div>
              <h3 className="font-semibold mb-2">Local Testing</h3>
              <p className="text-sm text-muted-foreground mb-2">
                You can also run tests locally using these commands:
              </p>
              <pre className="text-xs bg-muted p-3 rounded-lg">
                {`# Quick smoke test
./scripts/quick-test.sh

# All edge function tests
./scripts/test-functions.sh

# Frontend tests
npm run test`}
              </pre>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
