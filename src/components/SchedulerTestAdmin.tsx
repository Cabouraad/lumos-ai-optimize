import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, PlayCircle, CheckCircle, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface TestResult {
  status: string;
  testMode?: boolean;
  organizationId?: string;
  key?: string;
  timestamp: string;
  result?: any;
}

export function SchedulerTestAdmin() {
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runEndToEndTest = async () => {
    setIsRunning(true);
    setError(null);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('daily-scan', {
        body: { 
          test: true,
          organizationId: null // Test all organizations
        }
      });

      if (error) throw error;

      setResult(data);
    } catch (e) {
      console.error('Test failed:', e);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsRunning(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return <Badge variant="default" className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" />Success</Badge>;
      case 'error':
        return <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1" />Error</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PlayCircle className="w-5 h-5" />
          Scheduler End-to-End Test
        </CardTitle>
        <CardDescription>
          Test the complete scheduler workflow by bypassing time gates and idempotency checks.
          This will run the daily scan immediately for all organizations.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          onClick={runEndToEndTest}
          disabled={isRunning}
          className="w-full"
        >
          {isRunning && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {isRunning ? "Running Test..." : "Run End-to-End Test"}
        </Button>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {result && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-medium">Test Status:</span>
              {getStatusBadge(result.status)}
            </div>

            {result.testMode && (
              <div className="flex items-center justify-between">
                <span className="font-medium">Mode:</span>
                <Badge variant="outline">Test Mode</Badge>
              </div>
            )}

            <div className="flex items-center justify-between">
              <span className="font-medium">Timestamp:</span>
              <span className="text-sm text-muted-foreground">
                {new Date(result.timestamp).toLocaleString()}
              </span>
            </div>

            {result.key && (
              <div className="flex items-center justify-between">
                <span className="font-medium">Run Key:</span>
                <span className="text-sm text-muted-foreground">{result.key}</span>
              </div>
            )}

            {result.result && (
              <div className="mt-4">
                <h4 className="font-medium mb-2">Scan Results:</h4>
                <div className="bg-muted p-3 rounded-md">
                  <pre className="text-xs overflow-auto">
                    {JSON.stringify(result.result, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>
        )}

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Note:</strong> This test bypasses normal scheduler constraints and runs immediately.
            Use this to verify the scheduler logic works correctly before relying on automatic daily execution.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}