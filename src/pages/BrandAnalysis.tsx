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
import { Search, Sparkles, CheckCircle, XCircle, Trophy, Users, Bot } from 'lucide-react';

interface AnalysisResult {
  brands: string[];
  orgBrandPresent: boolean;
  orgBrandPosition: number | null;
  score: number;
  rawResponse: string;
}

export default function BrandAnalysis() {
  const { toast } = useToast();
  const [prompt, setPrompt] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [provider, setProvider] = useState<'openai' | 'perplexity'>('openai');
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [testingPrompt, setTestingPrompt] = useState(false);

  const testPromptWithAI = async () => {
    if (!prompt.trim()) {
      toast({
        title: "Missing Prompt",
        description: "Please provide a prompt to test",
        variant: "destructive",
      });
      return;
    }

    setTestingPrompt(true);
    try {
      const { data: result, error } = await supabase.functions.invoke('test-prompt-response', {
        body: {
          prompt: prompt.trim(),
          provider
        },
      });

      if (error) {
        throw new Error(error.message || 'Failed to get AI response');
      }

      setAiResponse(result.response);
      toast({
        title: "AI Response Generated",
        description: `Got response from ${provider.toUpperCase()}. Now analyze it for brand mentions.`,
      });

    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setTestingPrompt(false);
    }
  };

  const analyzeAIResponse = async () => {
    if (!prompt.trim() || !aiResponse.trim()) {
      toast({
        title: "Missing Information",
        description: "Please provide both a prompt and the AI response to analyze",
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

      // Call edge function to analyze the AI response
      const { data: result, error } = await supabase.functions.invoke('analyze-ai-response', {
        body: {
          prompt: prompt,
          response: aiResponse,
          provider: provider,
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
          <Bot className="h-8 w-8" />
          <h1 className="text-3xl font-bold">AI Response Analysis</h1>
        </div>

        <div className="grid gap-6">
          {/* Input Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                Analyze AI Prompt Responses
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="prompt">Prompt</Label>
                <Textarea
                  id="prompt"
                  placeholder="e.g., What are the best AI search platforms for enterprise?"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>AI Provider</Label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      value="openai"
                      checked={provider === 'openai'}
                      onChange={(e) => setProvider(e.target.value as 'openai')}
                    />
                    OpenAI
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      value="perplexity"
                      checked={provider === 'perplexity'}
                      onChange={(e) => setProvider(e.target.value as 'perplexity')}
                    />
                    Perplexity
                  </label>
                </div>
              </div>

              <Button
                onClick={testPromptWithAI}
                disabled={testingPrompt || !prompt.trim()}
                className="w-full"
                variant="outline"
              >
                {testingPrompt ? (
                  <>
                    <Bot className="mr-2 h-4 w-4 animate-spin" />
                    Getting {provider.toUpperCase()} Response...
                  </>
                ) : (
                  <>
                    <Bot className="mr-2 h-4 w-4" />
                    Test Prompt with {provider.toUpperCase()}
                  </>
                )}
              </Button>
              
              <div className="space-y-2">
                <Label htmlFor="response">AI Response</Label>
                <Textarea
                  id="response"
                  placeholder="Paste or generate the AI response here..."
                  value={aiResponse}
                  onChange={(e) => setAiResponse(e.target.value)}
                  rows={8}
                />
                <p className="text-sm text-muted-foreground">
                  Use "Test Prompt" to automatically get a response, or paste an existing AI response here
                </p>
              </div>

              <Button
                onClick={analyzeAIResponse}
                disabled={analyzing || !prompt.trim() || !aiResponse.trim()}
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
                    Analyze AI Response for Brands
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
                  <p className="font-medium">Enter Your Prompt</p>
                  <p className="text-sm text-muted-foreground">Type the same prompt you use in your tracking system</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">2</div>
                <div>
                  <p className="font-medium">Get AI Response</p>
                  <p className="text-sm text-muted-foreground">Use "Test Prompt" to get a fresh response from OpenAI or Perplexity, or paste an existing response</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">3</div>
                <div>
                  <p className="font-medium">Analyze for Brands</p>
                  <p className="text-sm text-muted-foreground">Extract all brand mentions and check your organization's visibility score</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}