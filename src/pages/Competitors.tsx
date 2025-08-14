import React, { useEffect, useState } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { getOrgId } from '@/lib/auth';
import { Users, TrendingUp, Eye, FileText } from 'lucide-react';

interface CompetitorData {
  name: string;
  totalAppearances: number;
  averageScore: number;
  promptsAppeared: Array<{
    id: string;
    text: string;
    score: number;
    runAt: string;
    provider: string;
  }>;
}

interface VisibilityResult {
  id: string;
  score: number;
  brands_json: string[];
  prompt_runs: {
    id: string;
    run_at: string;
    llm_providers: {
      name: string;
    };
    prompts: {
      id: string;
      text: string;
    };
  };
}

export default function Competitors() {
  const [competitors, setCompetitors] = useState<CompetitorData[]>([]);
  const [loading, setLoading] = useState(true);
  const [orgBrands, setOrgBrands] = useState<string[]>([]);

  useEffect(() => {
    fetchCompetitorsData();
  }, []);

  const fetchCompetitorsData = async () => {
    try {
      setLoading(true);
      const orgId = await getOrgId();

      // Get organization brands to exclude from competitors
      const { data: brandData } = await supabase
        .from('brand_catalog')
        .select('name, variants_json')
        .eq('org_id', orgId)
        .eq('is_org_brand', true);

      const orgBrandNames = new Set<string>();
      brandData?.forEach(brand => {
        orgBrandNames.add(brand.name.toLowerCase());
        if (Array.isArray(brand.variants_json)) {
          brand.variants_json.forEach(variant => {
            if (typeof variant === 'string') {
              orgBrandNames.add(variant.toLowerCase());
            }
          });
        }
      });
      setOrgBrands(Array.from(orgBrandNames));

      // Fetch visibility results with related data
      const { data: visibilityData, error } = await supabase
        .from('visibility_results')
        .select(`
          id,
          score,
          brands_json,
          prompt_runs!inner (
            id,
            run_at,
            llm_providers (name),
            prompts!inner (
              id,
              text,
              org_id
            )
          )
        `)
        .eq('prompt_runs.prompts.org_id', orgId)
        .order('prompt_runs.run_at', { ascending: false });

      if (error) {
        console.error('Error fetching visibility data:', error);
        return;
      }

      // Process data to extract competitors
      const competitorMap = new Map<string, CompetitorData>();

      (visibilityData as VisibilityResult[])?.forEach(result => {
        const brands = result.brands_json || [];
        const promptInfo = {
          id: result.prompt_runs.prompts.id,
          text: result.prompt_runs.prompts.text,
          score: result.score,
          runAt: result.prompt_runs.run_at,
          provider: result.prompt_runs.llm_providers.name
        };

        brands.forEach(brand => {
          const brandLower = brand.toLowerCase().trim();
          
          // Skip if it's an org brand
          if (orgBrandNames.has(brandLower)) {
            return;
          }

          // Filter out AI tools and generic terms (same logic as edge functions)
          const excludedBrands = ['openai', 'claude', 'copilot', 'google', 'chatgpt', 'gpt', 'ai', 'artificial intelligence', 'microsoft', 'azure', 'aws', 'amazon'];
          if (excludedBrands.some(excluded => brandLower.includes(excluded))) {
            return;
          }

          // Skip very short brands or non-brand text
          if (brand.length < 2 || brand.length > 40) {
            return;
          }

          // Skip brands with special characters that indicate they're not real company names
          if (!/^[A-Za-z0-9\s&\-\.\(\)\/]{2,35}$/.test(brand)) {
            return;
          }

          if (!competitorMap.has(brand)) {
            competitorMap.set(brand, {
              name: brand,
              totalAppearances: 0,
              averageScore: 0,
              promptsAppeared: []
            });
          }

          const competitor = competitorMap.get(brand)!;
          competitor.totalAppearances += 1;
          competitor.promptsAppeared.push(promptInfo);
        });
      });

      // Calculate average scores and sort by total appearances
      const competitorsArray = Array.from(competitorMap.values())
        .filter(competitor => competitor.totalAppearances > 0) // Only include competitors with appearances
        .map(competitor => {
          const totalScore = competitor.promptsAppeared.reduce((sum, prompt) => sum + prompt.score, 0);
          competitor.averageScore = totalScore / competitor.promptsAppeared.length;
          
          // Sort prompts by run date (most recent first)
          competitor.promptsAppeared.sort((a, b) => new Date(b.runAt).getTime() - new Date(a.runAt).getTime());
          
          return competitor;
        })
        .sort((a, b) => b.totalAppearances - a.totalAppearances);

      setCompetitors(competitorsArray);
    } catch (error) {
      console.error('Error fetching competitors data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 8) return 'text-green-600';
    if (score >= 5) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (loading) {
    return (
      <Layout>
        <div className="container mx-auto p-6">
          <div className="animate-pulse">
            <div className="h-8 bg-muted rounded w-1/3 mb-6"></div>
            <div className="grid gap-6">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-32 bg-muted rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Users className="h-8 w-8" />
            <div>
              <h1 className="text-3xl font-bold">Competitors</h1>
              <p className="text-muted-foreground">Brands detected in AI responses to your prompts</p>
            </div>
          </div>
          {competitors.length > 0 && (
            <Badge variant="secondary" className="text-sm">
              {competitors.length} competitors detected
            </Badge>
          )}
        </div>

        {competitors.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No competitors detected yet</h3>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>• Run prompts to discover competitor mentions in AI responses</p>
                  <p>• AI tools and generic terms are automatically filtered out</p>
                  <p>• Only real business competitors are shown</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6">
            {competitors.map((competitor) => (
              <Card key={competitor.name} className="relative">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xl">{competitor.name}</CardTitle>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Eye className="h-4 w-4 text-muted-foreground" />
                        <span className="font-semibold">{competitor.totalAppearances}</span>
                        <span className="text-sm text-muted-foreground">appearances</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                        <span className={`font-semibold ${getScoreColor(competitor.averageScore)}`}>
                          {competitor.averageScore.toFixed(1)}/10
                        </span>
                        <span className="text-sm text-muted-foreground">avg score</span>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <FileText className="h-4 w-4" />
                        <h3 className="font-semibold">Recent Prompts</h3>
                      </div>
                      
                      <div className="space-y-3">
                        {competitor.promptsAppeared.slice(0, 5).map((prompt) => (
                          <div key={`${prompt.id}-${prompt.runAt}`} className="border rounded-lg p-3">
                            <div className="flex items-start justify-between gap-3 mb-2">
                              <p className="text-sm font-medium line-clamp-2">{prompt.text}</p>
                              <Badge className={`${getScoreColor(prompt.score)} font-bold`}>
                                {prompt.score}/10
                              </Badge>
                            </div>
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="capitalize">
                                  {prompt.provider}
                                </Badge>
                              </div>
                              <span>{new Date(prompt.runAt).toLocaleDateString()}</span>
                            </div>
                          </div>
                        ))}
                        
                        {competitor.promptsAppeared.length > 5 && (
                          <div className="text-center py-2">
                            <span className="text-sm text-muted-foreground">
                              +{competitor.promptsAppeared.length - 5} more appearances
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}