import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export default function CronSetup() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const setupCronJobs = async () => {
    setLoading(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('setup-cron-jobs', {
        body: { action: 'setup' }
      });

      if (error) throw error;

      setResult({
        success: data?.success || false,
        message: data?.message || 'Cron jobs set up successfully!'
      });
    } catch (error: any) {
      setResult({
        success: false,
        message: error.message || 'Failed to set up cron jobs'
      });
    } finally {
      setLoading(false);
    }
  };

  const checkStatus = async () => {
    setLoading(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('setup-cron-jobs', {
        body: { action: 'status' }
      });

      if (error) throw error;

      const jobs = data?.cronJobs || [];
      setResult({
        success: true,
        message: `Found ${jobs.length} active cron jobs${jobs.length > 0 ? ': ' + jobs.map((j: any) => j.jobname).join(', ') : ''}`
      });
    } catch (error: any) {
      setResult({
        success: false,
        message: error.message || 'Failed to check cron job status'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <Card>
        <CardHeader>
          <CardTitle>Cron Job Setup</CardTitle>
          <CardDescription>
            Set up automated weekly report generation and other scheduled tasks
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <Button 
              onClick={setupCronJobs} 
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Setting up...
                </>
              ) : (
                'Set Up Cron Jobs'
              )}
            </Button>
            
            <Button 
              onClick={checkStatus} 
              variant="outline"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Checking...
                </>
              ) : (
                'Check Status'
              )}
            </Button>
          </div>

          {result && (
            <Alert variant={result.success ? "default" : "destructive"}>
              {result.success ? (
                <CheckCircle className="h-4 w-4" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
              <AlertDescription>{result.message}</AlertDescription>
            </Alert>
          )}

          <div className="mt-6 text-sm text-muted-foreground">
            <p className="font-semibold mb-2">This will set up:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Weekly report generation (Mondays at 8:05 AM UTC)</li>
              <li>Daily batch triggers for prompt execution</li>
              <li>Batch reconciler (every 10 minutes)</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
