import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle2, XCircle, Search, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export function CitationDiagnostic() {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const { toast } = useToast();

  const runDiagnostic = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('diagnose-citations');
      
      if (error) throw error;
      
      setResults(data);
      toast({
        title: 'Diagnostic complete',
        description: `Analyzed ${data.analysis.total_responses} responses`,
      });
    } catch (error) {
      console.error('Diagnostic error:', error);
      toast({
        title: 'Diagnostic failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="w-5 h-5" />
          Citation Diagnostic Tool
        </CardTitle>
        <CardDescription>
          Analyze why citations aren't being captured from AI responses
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          onClick={runDiagnostic} 
          disabled={loading}
          className="w-full"
        >
          {loading ? (
            <>
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <Search className="w-4 h-4 mr-2" />
              Run Citation Analysis
            </>
          )}
        </Button>

        {results && (
          <div className="space-y-6 mt-6">
            {/* Summary Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-muted rounded-lg">
                <div className="text-2xl font-bold">
                  {results.analysis.total_responses}
                </div>
                <div className="text-sm text-muted-foreground">Total Responses</div>
              </div>
              <div className="p-4 bg-muted rounded-lg">
                <div className="text-2xl font-bold text-emerald-600">
                  {results.analysis.citation_stats.responses_with_citations}
                </div>
                <div className="text-sm text-muted-foreground">With Citations</div>
              </div>
            </div>

            {/* By Provider */}
            <div>
              <h3 className="font-semibold mb-3">By Provider</h3>
              <div className="space-y-3">
                {Object.entries(results.analysis.by_provider).map(([provider, stats]: [string, any]) => (
                  <div key={provider} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium capitalize">{provider}</span>
                      <Badge variant="outline">{stats.count} responses</Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div className="flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>{stats.with_citations} with cites</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <XCircle className="w-4 h-4 text-amber-600" />
                        <span>{stats.empty_citations} empty</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <AlertCircle className="w-4 h-4 text-rose-600" />
                        <span>{stats.has_response_text} with text</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recommendations */}
            {results.recommendations && results.recommendations.length > 0 && (
              <div>
                <h3 className="font-semibold mb-3">Recommendations</h3>
                <div className="space-y-3">
                  {results.recommendations.map((rec: any, idx: number) => (
                    <div key={idx} className="p-4 border-l-4 border-amber-500 bg-amber-50 dark:bg-amber-950 rounded-r">
                      <div className="font-medium mb-2">{rec.issue}</div>
                      <div className="text-sm space-y-2">
                        <div>
                          <div className="font-medium text-muted-foreground mb-1">Possible Reasons:</div>
                          <ul className="list-disc list-inside space-y-1 ml-2">
                            {rec.reasons.map((reason: string, i: number) => (
                              <li key={i}>{reason}</li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <div className="font-medium text-muted-foreground mb-1">Solutions:</div>
                          <ul className="list-disc list-inside space-y-1 ml-2">
                            {rec.solutions.map((solution: string, i: number) => (
                              <li key={i}>{solution}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Sample Citations */}
            {results.analysis.sample_responses.length > 0 && (
              <div>
                <h3 className="font-semibold mb-3">Sample Citations Found</h3>
                <div className="space-y-3">
                  {results.analysis.sample_responses.map((sample: any, idx: number) => (
                    <div key={idx} className="p-3 bg-muted rounded-lg text-sm">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline" className="capitalize">{sample.provider}</Badge>
                        <span className="text-muted-foreground">
                          {new Date(sample.run_at).toLocaleString()}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {Array.isArray(sample.citations) 
                          ? `${sample.citations.length} citations`
                          : `${sample.citations?.citations?.length || 0} citations`}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
