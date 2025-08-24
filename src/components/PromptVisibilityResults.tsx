
import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle, XCircle, Eye, Trophy, Users, FileText, Bug, AlertCircle } from 'lucide-react';

interface ProviderResponse {
  id: string;
  provider: string;
  model: string | null;
  status: string;
  run_at: string;
  score: number;
  org_brand_present: boolean;
  org_brand_prominence: number | null;
  competitors_count: number;
  brands_json: any[];
  competitors_json: any[];
  raw_ai_response: string | null;
  raw_evidence: string | null;
  error: string | null;
  token_in: number;
  token_out: number;
  metadata: any;
}

interface PromptVisibilityResultsProps {
  promptId: string;
  refreshTrigger?: number;
}

export function PromptVisibilityResults({ promptId, refreshTrigger }: PromptVisibilityResultsProps) {
  const [results, setResults] = useState<ProviderResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAllResults, setShowAllResults] = useState(false);
  const [debugMode, setDebugMode] = useState(false);

  useEffect(() => {
    fetchResults();
  }, [promptId, refreshTrigger]);

  const fetchResults = async () => {
    try {
      setLoading(true);

      if (showAllResults) {
        // Get all results for this prompt using RPC call
        const { data, error } = await supabase.rpc('get_prompt_responses', {
          p_prompt_id: promptId,
          p_limit: 50
        });

        if (error) {
          console.error('Error fetching all results:', error);
          setResults([]);
          return;
        }

        setResults(data || []);
      } else {
        // Get latest results per provider using RPC call
        const { data, error } = await supabase.rpc('get_latest_prompt_responses', {
          p_prompt_id: promptId
        });

        if (error) {
          console.error('Error fetching latest results:', error);
          setResults([]);
          return;
        }

        setResults(data || []);
      }
    } catch (error) {
      console.error('Error fetching results:', error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 8) return 'text-green-600 bg-green-50 border-green-200';
    if (score >= 5) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    return 'text-red-600 bg-red-50 border-red-200';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'bg-green-100 text-green-800';
      case 'error': case 'failed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getProminenceText = (prominence: number | null) => {
    if (prominence === null) return 'Not found';
    if (prominence === 1) return '1st position';
    if (prominence === 2) return '2nd position';
    if (prominence === 3) return '3rd position';
    return `${prominence}th position`;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="animate-pulse">
            <div className="h-4 bg-muted rounded w-1/2 mb-2"></div>
            <div className="h-4 bg-muted rounded w-3/4"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (results.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Visibility Results
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No visibility results yet. Results will appear after the next automated run at 3:00 AM ET.</p>
        </CardContent>
      </Card>
    );
  }

  // Group results by provider for latest view
  const displayResults = showAllResults 
    ? results 
    : Array.from(new Map(results.map(r => [r.provider, r])).values());

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Eye className="h-5 w-5" />
          {showAllResults ? 'All Provider Results' : 'Latest Provider Results'}
        </h3>
        
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setDebugMode(!debugMode)}
          >
            <Bug className="h-4 w-4 mr-1" />
            {debugMode ? 'Hide Debug' : 'Debug'}
          </Button>
          
          {results.length > displayResults.length && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                setShowAllResults(!showAllResults);
                // Refetch when switching views
                setTimeout(() => fetchResults(), 100);
              }}
            >
              {showAllResults ? 'Show Latest Only' : `Show All (${results.length})`}
            </Button>
          )}
        </div>
      </div>
      
      {displayResults.map((result) => (
        <Card key={`${result.id}-${result.run_at}`} className="relative">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="capitalize">
                  {result.provider}
                </Badge>
                {result.model && (
                  <Badge variant="secondary" className="text-xs">
                    {result.model}
                  </Badge>
                )}
                <Badge className={`text-xs ${getStatusColor(result.status)}`}>
                  {result.status}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {new Date(result.run_at).toLocaleString()}
                </span>
              </div>
              
              <Badge className={`font-bold text-lg px-3 py-1 ${getScoreColor(result.score)}`}>
                {result.score}/10
              </Badge>
            </div>
          </CardHeader>
          
          <CardContent className="pt-0">
            {result.status === 'error' && result.error ? (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-red-500 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-red-800">Execution Error</p>
                    <p className="text-sm text-red-600 mt-1">{result.error}</p>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Brand Presence */}
                  <div className="flex items-center gap-2">
                    {result.org_brand_present ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500" />
                    )}
                    <div>
                      <p className="text-sm font-medium">Brand Present</p>
                      <p className="text-sm text-muted-foreground">
                        {result.org_brand_present ? 'Yes' : 'No'}
                      </p>
                    </div>
                  </div>

                  {/* Brand Position */}
                  <div className="flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-yellow-500" />
                    <div>
                      <p className="text-sm font-medium">Position</p>
                      <p className="text-sm text-muted-foreground">
                        {getProminenceText(result.org_brand_prominence)}
                      </p>
                    </div>
                  </div>

                  {/* Competitors */}
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-blue-500" />
                    <div>
                      <p className="text-sm font-medium">Competitors</p>
                      <p className="text-sm text-muted-foreground">
                        {result.competitors_count} found
                      </p>
                    </div>
                  </div>
                </div>

                {/* Detected Brands */}
                {result.brands_json && Array.isArray(result.brands_json) && result.brands_json.length > 0 && (
                  <div className="mt-4 pt-4 border-t">
                    <p className="text-sm font-medium mb-2">All Detected Brands:</p>
                    <div className="flex flex-wrap gap-2">
                      {result.brands_json.map((brand: string, index: number) => (
                        <Badge key={index} variant="secondary" className="text-xs">
                          {brand}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Competitors */}
                {result.competitors_json && Array.isArray(result.competitors_json) && result.competitors_json.length > 0 && (
                  <div className="mt-4 pt-4 border-t">
                    <p className="text-sm font-medium mb-2">Competitor Brands:</p>
                    <div className="flex flex-wrap gap-2">
                      {result.competitors_json.map((competitor: string, index: number) => (
                        <Badge key={index} variant="destructive" className="text-xs">
                          {competitor}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Raw AI Response */}
                {result.raw_ai_response && (
                  <div className="mt-4 pt-4 border-t">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium">AI Response:</p>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm" className="h-7">
                            <FileText className="h-3 w-3 mr-1" />
                            View Full Response
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-4xl max-h-[80vh]">
                          <DialogHeader>
                            <DialogTitle>Full AI Response - {result.provider}</DialogTitle>
                            <DialogDescription>
                              Response generated on {new Date(result.run_at).toLocaleString()}
                              {result.model && ` using ${result.model}`}
                            </DialogDescription>
                          </DialogHeader>
                          <div className="mt-4 max-h-96 overflow-y-auto">
                            <div className="p-4 bg-muted rounded-lg">
                              <pre className="whitespace-pre-wrap text-sm font-mono leading-relaxed">
                                {result.raw_ai_response}
                              </pre>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                    <div className="text-sm text-muted-foreground bg-muted/30 p-3 rounded border-l-4 border-primary/30">
                      {result.raw_ai_response.length > 200 
                        ? `${result.raw_ai_response.substring(0, 200)}...` 
                        : result.raw_ai_response
                      }
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Debug Information */}
            {debugMode && (
              <div className="mt-4 pt-4 border-t">
                <p className="text-sm font-medium mb-2">Debug Info:</p>
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <p><strong>Response ID:</strong> {result.id}</p>
                    <p><strong>Tokens In:</strong> {result.token_in}</p>
                    <p><strong>Tokens Out:</strong> {result.token_out}</p>
                  </div>
                  <div>
                    <p><strong>Model:</strong> {result.model || 'N/A'}</p>
                    <p><strong>Status:</strong> {result.status}</p>
                    {result.metadata && (
                      <p><strong>Metadata:</strong> {JSON.stringify(result.metadata, null, 2).substring(0, 100)}...</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
