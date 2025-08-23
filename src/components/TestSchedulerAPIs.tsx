
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export function TestSchedulerAPIs() {
  const [loading, setLoading] = useState(false);
  const [auditLoading, setAuditLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [auditResults, setAuditResults] = useState<any>(null);
  const { toast } = useToast();

  const testSchedulerAPIs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('test-scheduler-apis');
      
      if (error) {
        throw error;
      }
      
      setResults(data);
      toast({
        title: "API Test Complete",
        description: "Check the results below for detailed information.",
      });
    } catch (error: any) {
      console.error('Test failed:', error);
      toast({
        title: "Test Failed",
        description: error.message || "Unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const auditVisibilityData = async () => {
    setAuditLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('audit-visibility');
      
      if (error) {
        throw error;
      }
      
      setAuditResults(data);
      toast({
        title: "Visibility Audit Complete",
        description: `Status: ${data.summary?.status || 'Unknown'}`,
        variant: data.summary?.status === 'HEALTHY' ? 'default' : 'destructive',
      });
    } catch (error: any) {
      console.error('Audit failed:', error);
      toast({
        title: "Audit Failed",
        description: error.message || "Unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setAuditLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>API Testing & Diagnostics</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <Button 
              onClick={testSchedulerAPIs}
              disabled={loading}
              variant="outline"
            >
              {loading ? "Testing..." : "Test Scheduler APIs"}
            </Button>
            
            <Button 
              onClick={auditVisibilityData}
              disabled={auditLoading}
              variant="outline"
            >
              {auditLoading ? "Auditing..." : "Audit Visibility Data"}
            </Button>
          </div>

          {auditResults && (
            <div className="mt-4">
              <h4 className="font-medium mb-2">Visibility Data Audit Results:</h4>
              <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium">Status:</span>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    auditResults.summary?.status === 'HEALTHY' 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {auditResults.summary?.status || 'Unknown'}
                  </span>
                </div>
                <div>
                  <span className="font-medium">Message:</span>
                  <span className="ml-2">{auditResults.summary?.message}</span>
                </div>
                
                {auditResults.summary?.recommendations && auditResults.summary.recommendations.length > 0 && (
                  <div>
                    <span className="font-medium">Recommendations:</span>
                    <ul className="ml-4 mt-1 list-disc">
                      {auditResults.summary.recommendations.map((rec: string, idx: number) => (
                        <li key={idx} className="text-sm">{rec}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <details className="mt-4">
                  <summary className="cursor-pointer font-medium">View Detailed Checks</summary>
                  <div className="mt-2 space-y-2 text-sm">
                    <div>Prompts: {auditResults.checks?.prompts?.count || 0} total, {auditResults.checks?.prompts?.active || 0} active</div>
                    <div>Recent Runs (24h): {auditResults.checks?.recentRuns?.successful || 0} successful, {auditResults.checks?.recentRuns?.failed || 0} failed</div>
                    <div>Visibility Results: {auditResults.checks?.visibilityResults?.count || 0} results, avg score {auditResults.checks?.visibilityResults?.avgScore || 0}</div>
                    <div>Competitor Mentions: {auditResults.checks?.competitorMentions?.count || 0} total, {auditResults.checks?.competitorMentions?.recentMentions || 0} recent</div>
                    <div>Brand Catalog: {auditResults.checks?.brandCatalog?.totalBrands || 0} brands ({auditResults.checks?.brandCatalog?.competitorBrands || 0} competitors)</div>
                  </div>
                </details>
              </div>
            </div>
          )}

          {results && (
            <div className="mt-4">
              <h4 className="font-medium mb-2">API Test Results:</h4>
              <pre className="bg-muted/50 p-4 rounded-lg text-xs overflow-auto max-h-96">
                {JSON.stringify(results, null, 2)}
              </pre>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
