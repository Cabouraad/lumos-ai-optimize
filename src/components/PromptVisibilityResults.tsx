import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle, XCircle, Eye, Trophy, Users, FileText } from 'lucide-react';

interface VisibilityResult {
  id: string;
  score: number;
  org_brand_present: boolean;
  org_brand_prominence: number | null;
  competitors_count: number;
  brands_json: any; // JSON field from database
  raw_evidence: string | null;
  raw_ai_response: string | null;
  prompt_runs: {
    id: string;
    status: string;
    run_at: string;
    llm_providers: {
      name: string;
    };
  };
}

interface PromptVisibilityResultsProps {
  promptId: string;
  refreshTrigger?: number;
}

export function PromptVisibilityResults({ promptId, refreshTrigger }: PromptVisibilityResultsProps) {
  const [results, setResults] = useState<VisibilityResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAllResults, setShowAllResults] = useState(false);

  useEffect(() => {
    fetchResults();
  }, [promptId, refreshTrigger]);

  const fetchResults = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('visibility_results')
        .select(`
          id,
          score,
          org_brand_present,
          org_brand_prominence,
          competitors_count,
          brands_json,
          raw_evidence,
          raw_ai_response,
          prompt_runs!inner (
            id,
            status,
            run_at,
            llm_providers (name)
          )
        `)
        .eq('prompt_runs.prompt_id', promptId)
        .eq('prompt_runs.status', 'success')
        .order('run_at', { ascending: false, foreignTable: 'prompt_runs' })
        .limit(10);

      if (error) {
        console.error('Error fetching visibility results:', error);
        return;
      }

      setResults(data || []);
    } catch (error) {
      console.error('Error fetching results:', error);
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 8) return 'text-green-600 bg-green-50 border-green-200';
    if (score >= 5) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    return 'text-red-600 bg-red-50 border-red-200';
  };

  const getProminenceText = (prominence: number | null) => {
    if (prominence === null) return 'Not found';
    if (prominence === 0) return '1st position';
    if (prominence === 1) return '2nd position';
    if (prominence === 2) return '3rd position';
    return `${prominence + 1}th position`;
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

  // Get the latest results (most recent run per provider)
  const getLatestResults = () => {
    if (showAllResults) return results;
    
    // Group by provider and get the latest run for each
    const latestByProvider = new Map();
    results.forEach(result => {
      const provider = result.prompt_runs.llm_providers.name;
      const existing = latestByProvider.get(provider);
      if (!existing || new Date(result.prompt_runs.run_at) > new Date(existing.prompt_runs.run_at)) {
        latestByProvider.set(provider, result);
      }
    });
    return Array.from(latestByProvider.values());
  };

  const displayResults = getLatestResults();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Eye className="h-5 w-5" />
          {showAllResults ? 'All Visibility Results' : 'Latest Visibility Results'}
        </h3>
        
        {results.length > displayResults.length && (
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setShowAllResults(!showAllResults)}
          >
            {showAllResults ? `Show Latest Only` : `Show All (${results.length})`}
          </Button>
        )}
      </div>
      
      {displayResults.map((result) => (
        <Card key={result.id} className="relative">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="capitalize">
                  {result.prompt_runs.llm_providers.name}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {new Date(result.prompt_runs.run_at).toLocaleString()}
                </span>
              </div>
              
              <Badge className={`font-bold text-lg px-3 py-1 ${getScoreColor(result.score)}`}>
                {result.score}/10
              </Badge>
            </div>
          </CardHeader>
          
          <CardContent className="pt-0">
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

            {/* Detected Brands with Enhanced Display */}
            {result.brands_json && Array.isArray(result.brands_json) && result.brands_json.length > 0 && (
              <div className="mt-4 pt-4 border-t">
                <p className="text-sm font-medium mb-2">Detected Brands:</p>
                <div className="flex flex-wrap gap-2">
                  {result.brands_json.map((brandData: any, index: number) => {
                    // Handle both old string format and new object format
                    const brandName = typeof brandData === 'string' ? brandData : brandData.brand_name;
                    const brandScore = typeof brandData === 'object' ? brandData.score : null;
                    
                    // Try to determine if this is a user brand or competitor from raw_evidence
                    let isUserBrand = false;
                    let isCompetitor = false;
                    
                    try {
                      if (result.raw_evidence) {
                        const evidence = JSON.parse(result.raw_evidence);
                        if (evidence.userBrands) {
                          isUserBrand = evidence.userBrands.some((ub: any) => ub.name === brandName);
                        }
                        if (evidence.competitors) {
                          isCompetitor = evidence.competitors.some((c: any) => c.name === brandName);
                        }
                      }
                    } catch (e) {
                      // Fallback: assume first brand is user brand if org_brand_present is true
                      if (result.org_brand_present && index === 0) {
                        isUserBrand = true;
                      }
                    }
                    
                    const badgeVariant = isUserBrand ? "default" : isCompetitor ? "destructive" : "secondary";
                    
                    return (
                      <Badge key={index} variant={badgeVariant} className="text-xs">
                        {brandName}
                        {brandScore !== null && ` (${brandScore}/10)`}
                        {isUserBrand && " (You)"}
                        {isCompetitor && " (Competitor)"}
                      </Badge>
                    );
                  })}
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
                        <DialogTitle>Full AI Response - {result.prompt_runs.llm_providers.name}</DialogTitle>
                        <DialogDescription>
                          Response generated on {new Date(result.prompt_runs.run_at).toLocaleString()}
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
          </CardContent>
        </Card>
      ))}
    </div>
  );
}