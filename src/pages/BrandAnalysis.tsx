import React, { useState } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { getOrgId } from '@/lib/auth';
import { Search, Sparkles, CheckCircle, XCircle, Trophy, Users } from 'lucide-react';

interface AnalysisResult {
  brands: string[];
  orgBrandPresent: boolean;
  orgBrandPosition: number | null;
  score: number;
}

export default function BrandAnalysis() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);

  const analyzeSearchResults = async () => {
    if (!searchQuery.trim() || !searchResults.trim()) {
      toast({
        title: "Missing Information",
        description: "Please provide both a search query and the search results",
        variant: "destructive",
      });
      return;
    }

    setAnalyzing(true);
    try {
      const orgId = await getOrgId();
      
      // Get organization brands
      const { data: brandData } = await supabase
        .from('brand_catalog')
        .select('name, variants_json')
        .eq('org_id', orgId)
        .eq('is_org_brand', true);

      const orgBrands = new Set<string>();
      brandData?.forEach(brand => {
        orgBrands.add(brand.name.toLowerCase());
        if (Array.isArray(brand.variants_json)) {
          brand.variants_json.forEach(variant => {
            if (typeof variant === 'string') {
              orgBrands.add(variant.toLowerCase());
            }
          });
        }
      });

      // Call edge function to analyze the search results
      const { data: result, error } = await supabase.functions.invoke('analyze-search-results', {
        body: {
          query: searchQuery,
          results: searchResults,
          orgBrands: Array.from(orgBrands)
        },
      });

      if (error) {
        throw new Error(error.message || 'Analysis failed');
      }
      setAnalysis(result);

      toast({
        title: "Analysis Complete",
        description: `Found ${result.brands.length} brands with a visibility score of ${result.score}/10`,
      });

    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setAnalyzing(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 8) return 'text-green-600 bg-green-50 border-green-200';
    if (score >= 5) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    return 'text-red-600 bg-red-50 border-red-200';
  };

  const getPositionText = (position: number | null) => {
    if (position === null) return 'Not found';
    if (position === 0) return '1st position';
    if (position === 1) return '2nd position';
    if (position === 2) return '3rd position';
    return `${position + 1}th position`;
  };

  return (
    <Layout>
      <div className="container mx-auto p-6 max-w-4xl">
        <div className="flex items-center gap-3 mb-6">
          <Search className="h-8 w-8" />
          <h1 className="text-3xl font-bold">Brand Analysis Tool</h1>
        </div>

        <div className="grid gap-6">
          {/* Input Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                Analyze Real Search Results
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="query">Search Query</Label>
                <Textarea
                  id="query"
                  placeholder="e.g., best ai search platforms"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  rows={2}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="results">Search Results (Copy & Paste)</Label>
                <Textarea
                  id="results"
                  placeholder="Paste the actual search results from Google, Bing, or other search engines here. Include titles, descriptions, and any brand names you see..."
                  value={searchResults}
                  onChange={(e) => setSearchResults(e.target.value)}
                  rows={8}
                />
                <p className="text-sm text-muted-foreground">
                  Copy the search results from any search engine and paste them here for accurate brand analysis
                </p>
              </div>

              <Button
                onClick={analyzeSearchResults}
                disabled={analyzing || !searchQuery.trim() || !searchResults.trim()}
                className="w-full"
              >
                {analyzing ? (
                  <>
                    <Sparkles className="mr-2 h-4 w-4 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Search className="mr-2 h-4 w-4" />
                    Analyze Search Results
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Results Section */}
          {analysis && (
            <Card>
              <CardHeader>
                <CardTitle>Analysis Results</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* Score */}
                  <div className="flex items-center justify-center">
                    <Badge className={`font-bold text-2xl px-6 py-3 ${getScoreColor(analysis.score)}`}>
                      {analysis.score}/10
                    </Badge>
                  </div>

                  <Separator />

                  {/* Metrics Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Brand Presence */}
                    <div className="flex items-center gap-3 p-4 border rounded-lg">
                      {analysis.orgBrandPresent ? (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-500" />
                      )}
                      <div>
                        <p className="font-medium">Brand Present</p>
                        <p className="text-sm text-muted-foreground">
                          {analysis.orgBrandPresent ? 'Yes' : 'No'}
                        </p>
                      </div>
                    </div>

                    {/* Brand Position */}
                    <div className="flex items-center gap-3 p-4 border rounded-lg">
                      <Trophy className="h-5 w-5 text-yellow-500" />
                      <div>
                        <p className="font-medium">Position</p>
                        <p className="text-sm text-muted-foreground">
                          {getPositionText(analysis.orgBrandPosition)}
                        </p>
                      </div>
                    </div>

                    {/* Competitors */}
                    <div className="flex items-center gap-3 p-4 border rounded-lg">
                      <Users className="h-5 w-5 text-blue-500" />
                      <div>
                        <p className="font-medium">Competitors</p>
                        <p className="text-sm text-muted-foreground">
                          {analysis.brands.length} found
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Detected Brands */}
                  {analysis.brands.length > 0 && (
                    <div>
                      <h3 className="font-semibold mb-3">Detected Brands:</h3>
                      <div className="flex flex-wrap gap-2">
                        {analysis.brands.map((brand, index) => (
                          <Badge key={index} variant="secondary">
                            {brand}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Instructions */}
          <Card>
            <CardHeader>
              <CardTitle>How to Use</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">1</div>
                <div>
                  <p className="font-medium">Perform a Search</p>
                  <p className="text-sm text-muted-foreground">Go to Google, Bing, or any search engine and search for your target query</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">2</div>
                <div>
                  <p className="font-medium">Copy Results</p>
                  <p className="text-sm text-muted-foreground">Copy the search results including titles, descriptions, and brand names</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">3</div>
                <div>
                  <p className="font-medium">Analyze</p>
                  <p className="text-sm text-muted-foreground">Paste the results here to get accurate brand visibility analysis</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}