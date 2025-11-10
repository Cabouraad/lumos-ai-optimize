import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle, XCircle, Eye, Trophy, Users, FileText, Bug, AlertCircle, RefreshCw } from 'lucide-react';
import { CompetitorChipList } from './CompetitorChip';
import { CitationsDisplay } from './CitationsDisplay';
import { useToast } from '@/hooks/use-toast';
import { useOrgBrands } from '@/hooks/useOrgBrands';
import { cleanCompetitors } from '@/lib/brand/competitor-cleaning';
import { useCatalogCompetitors } from '@/hooks/useCatalogCompetitors';
import { getOrgId } from '@/lib/auth';

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
  citations_json?: {
    provider: string;
    citations: any[];
    collected_at: string;
    ruleset_version: string;
  } | null;
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
  const [fixing, setFixing] = useState(false);
  const { toast } = useToast();
  const { orgBrandVariants } = useOrgBrands();
  const { filterCompetitorsByCatalog } = useCatalogCompetitors();

  useEffect(() => {
    fetchResults();
  }, [promptId, refreshTrigger]);

  const fetchResults = async () => {
    try {
      setLoading(true);

      if (showAllResults) {
        // Get all results for this prompt (last 50)
        const { data, error } = await supabase
          .from('prompt_provider_responses')
          .select('*')
          .eq('prompt_id', promptId)
          .order('run_at', { ascending: false })
          .limit(50);

        if (error) {
          console.error('Error fetching all results:', error);
          setResults([]);
          return;
        }

        setResults((data as unknown as ProviderResponse[]) || []);
      } else {
        // Get latest results per provider for this org, then filter by prompt
        const orgId = await getOrgId();
        const { data, error } = await supabase
          .rpc('get_latest_prompt_provider_responses', { p_org_id: orgId });

        if (error) {
          console.error('Error fetching latest results:', error);
          setResults([]);
          return;
        }

        // Filter results for this specific prompt
        const filteredData = (data || []).filter((r: any) => r.prompt_id === promptId);
        
        console.log('[PromptVisibilityResults] Latest responses:', {
          total: data?.length || 0,
          filtered: filteredData.length,
          promptId,
          providers: filteredData.map((r: any) => r.provider)
        });

        setResults((filteredData as unknown as ProviderResponse[]) || []);
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

  // Helper function to calculate local prominence from raw response
  const calculateLocalProminence = (rawResponse: string, orgBrands: string[]): string => {
    if (!rawResponse || orgBrands.length === 0) return 'Not found';
    
    let bestPosition = 1.0;
    const text = rawResponse.toLowerCase();
    
    for (const brand of orgBrands) {
      const index = text.indexOf(brand.toLowerCase());
      if (index >= 0) {
        const position = index / rawResponse.length;
        bestPosition = Math.min(bestPosition, position);
      }
    }
    
    if (bestPosition === 1.0) return 'Not found';
    
    // Convert to descriptive buckets
    if (bestPosition <= 0.1) return 'Very early';
    if (bestPosition <= 0.25) return 'Early';
    if (bestPosition <= 0.5) return 'Middle';
    if (bestPosition <= 0.75) return 'Late';
    return 'Very late';
  };

  const getProminenceText = (prominence: number | null, rawResponse?: string) => {
    if (prominence === null || prominence === 0) return 'Not found';
    
    // For legacy data with potentially incorrect prominence values,
    // try to compute from raw response if available
    if (rawResponse && prominence === 1 && orgBrandVariants.length > 0) {
      // Use actual org brand variants instead of hardcoded values
      const localProminence = calculateLocalProminence(rawResponse, orgBrandVariants);
      if (localProminence !== 'Not found') {
        return localProminence;
      }
    }
    
    // Map numeric prominence to descriptive buckets (1=best, 10=worst)
    if (prominence <= 2) return 'Very early';
    if (prominence <= 4) return 'Early';
    if (prominence <= 6) return 'Middle';
    if (prominence <= 8) return 'Late';
    return 'Very late';
  };

  const handleFixClassification = async () => {
    setFixing(true);
    try {
      const { data, error } = await supabase.rpc('fix_brand_classification_all_providers');
      
      if (error) {
        throw error;
      }
      
      toast({
        title: "Classification Fixed",
        description: data || "Brand classification has been corrected",
      });
      
      // Refresh results after fix
      await fetchResults();
    } catch (error) {
      console.error('Error fixing classification:', error);
      toast({
        title: "Fix Failed",
        description: "Unable to fix classification. Please try again.",
        variant: "destructive",
      });
    } finally {
      setFixing(false);
    }
  };

  // Detect potential misclassification
  const detectMisclassification = (result: ProviderResponse) => {
    if (!result.raw_ai_response) return false;
    
    // Simple heuristic: if brand is not detected but response contains common brand indicators
    if (!result.org_brand_present) {
      const response = result.raw_ai_response.toLowerCase();
      const brandIndicators = ['hubspot', 'marketing hub', 'our platform', 'our solution', 'our tool'];
      return brandIndicators.some(indicator => response.includes(indicator));
    }
    
    return false;
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
          <p className="text-muted-foreground">No visibility results yet. Results will appear after running prompts through the providers.</p>
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
      
      {displayResults.map((result) => {
        // Clean competitors for this result
        const cleanedCompetitors = cleanCompetitors(
          result.competitors_json || [], 
          orgBrandVariants, 
          { catalogFilter: filterCompetitorsByCatalog }
        );

        return (
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
                  {(result.score * 10).toFixed(1)}
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
                  {/* Potential Misclassification Alert */}
                  {detectMisclassification(result) && (
                    <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5" />
                          <div>
                            <p className="text-sm font-medium text-amber-800">Potential Misclassification</p>
                            <p className="text-sm text-amber-600 mt-1">
                              The response may contain your brand but wasn't detected. This can happen with partial matches.
                            </p>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleFixClassification}
                          disabled={fixing}
                          className="ml-2"
                        >
                          {fixing ? (
                            <RefreshCw className="h-3 w-3 animate-spin mr-1" />
                          ) : (
                            <RefreshCw className="h-3 w-3 mr-1" />
                          )}
                          Fix
                        </Button>
                      </div>
                    </div>
                  )}

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
                          {detectMisclassification(result) && (
                            <span className="text-amber-600 ml-1">(?)</span>
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Brand Position */}
                    <div className="flex items-center gap-2">
                      <Trophy className="h-4 w-4 text-yellow-500" />
                      <div>
                        <p className="text-sm font-medium">Position</p>
                         <p className="text-sm text-muted-foreground">
                           {getProminenceText(result.org_brand_prominence, result.raw_ai_response)}
                         </p>
                      </div>
                    </div>

                    {/* Competitors */}
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-blue-500" />
                      <div>
                        <p className="text-sm font-medium">Competitors</p>
                        <p className="text-sm text-muted-foreground">
                          {cleanedCompetitors.length} found
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
                  <div className="mt-4 pt-4 border-t">
                    <p className="text-sm font-medium mb-3">Competitor Brands:</p>
                    <CompetitorChipList 
                      competitors={cleanedCompetitors}
                      maxDisplay={8}
                      size="sm"
                      skipCatalogValidation={true}
                    />
                  </div>

                  {/* Citations */}
                  {result.citations_json && result.citations_json.citations && (
                    <div className="mt-4 pt-4 border-t">
                      <CitationsDisplay 
                        citations={result.citations_json.citations}
                        provider={result.provider}
                        isCompact={true}
                      />
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
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div>
                        <p><strong>Response ID:</strong> {result.id}</p>
                        <p><strong>Tokens In:</strong> {result.token_in}</p>
                        <p><strong>Tokens Out:</strong> {result.token_out}</p>
                      </div>
                      <div>
                        <p><strong>Model:</strong> {result.model || 'N/A'}</p>
                        <p><strong>Status:</strong> {result.status}</p>
                        {result.metadata?.manual_fix_applied && (
                          <p><strong>Manual Fix:</strong> ✅ Applied</p>
                        )}
                      </div>
                    </div>
                    
                    {/* Analysis metadata from new system */}
                    {result.metadata && (result.metadata.extractionMethod || result.metadata.analysisConfidence) && (
                      <div className="text-xs">
                        <p className="font-medium mb-1">Analysis Details:</p>
                        <div className="bg-muted/50 p-2 rounded text-xs font-mono max-h-32 overflow-y-auto">
                          <div>
                            <p>Method: {result.metadata.extractionMethod || 'new-analysis-v1'}</p>
                            <p>Confidence: {Math.round((result.metadata.analysisConfidence || 0.5) * 100)}%</p>
                            <p>Processing: {result.metadata.processingTime || 0}ms</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Standard metadata */}
                    {result.metadata && (
                      <div className="text-xs">
                        <p className="font-medium mb-1">Metadata:</p>
                        <div className="bg-muted/50 p-2 rounded text-xs font-mono max-h-24 overflow-y-auto">
                          {JSON.stringify(result.metadata, null, 2)}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}