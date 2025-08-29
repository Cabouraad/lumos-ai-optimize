import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { supabase } from '@/integrations/supabase/client';
import { ChevronDown, ChevronRight, PlayCircle, BarChart3, Calendar, Clock, Trophy, Target } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { PromptCompetitors } from '@/components/PromptCompetitors';

interface Citation {
  type: 'url' | 'ref';
  value: string;
}

interface BrandArtifact {
  name: string;
  normalized: string;
  mentions: number;
  first_pos_ratio: number;
}

interface ExtractedArtifacts {
  citations: Citation[];
  brands: BrandArtifact[];
  competitors: BrandArtifact[];
}

/**
 * Extract structured artifacts from AI response text
 */
function extractArtifacts(
  responseText: string, 
  userBrandNorms: string[], 
  gazetteer: string[]
): ExtractedArtifacts {
  const citations = extractCitations(responseText);
  const brandArtifacts = extractBrands(responseText, gazetteer);
  
  // Separate user brands from competitors
  const brands: BrandArtifact[] = [];
  const competitors: BrandArtifact[] = [];
  
  for (const brand of brandArtifacts) {
    if (userBrandNorms.includes(brand.normalized)) {
      brands.push(brand);
    } else {
      competitors.push(brand);
    }
  }
  
  return {
    citations,
    brands,
    competitors
  };
}

/**
 * Extract URLs and bracket references from text
 */
function extractCitations(text: string): Citation[] {
  const citations: Citation[] = [];
  
  // Extract URLs
  const urlRegex = /(https?:\/\/[^\s)\]]+)/g;
  let urlMatch;
  while ((urlMatch = urlRegex.exec(text)) !== null) {
    citations.push({
      type: 'url',
      value: urlMatch[1]
    });
  }
  
  // Extract bracket references like [1], [Smith 2023], [A], etc.
  const refRegex = /\[(?:\d+|[A-Za-z][^\]]{0,30})\]/g;
  let refMatch;
  while ((refMatch = refRegex.exec(text)) !== null) {
    // Store without brackets
    const refValue = refMatch[0].slice(1, -1);
    citations.push({
      type: 'ref',
      value: refValue
    });
  }
  
  return citations;
}

/**
 * Extract brand mentions with positioning and frequency analysis
 */
function extractBrands(text: string, gazetteer: string[]): BrandArtifact[] {
  const brands: Map<string, BrandArtifact> = new Map();
  const textLength = text.length;
  
  // Process each brand in the gazetteer
  for (const brandName of gazetteer) {
    const normalized = brandName.toLowerCase().trim();
    
    // Skip very short brands to avoid false positives
    if (normalized.length < 3) continue;
    
    // Find all mentions of this brand (case-insensitive)
    const brandRegex = new RegExp(brandName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    const matches = Array.from(text.matchAll(brandRegex));
    
    if (matches.length > 0) {
      // Calculate first position ratio
      const firstIndex = matches[0].index || 0;
      const firstPosRatio = textLength > 0 ? firstIndex / textLength : 0;
      
      brands.set(normalized, {
        name: brandName,
        normalized,
        mentions: matches.length,
        first_pos_ratio: firstPosRatio
      });
    }
  }
  
  return Array.from(brands.values());
}

/**
 * Create a comprehensive brand gazetteer from brand catalog and common brands
 */
function createBrandGazetteer(brandCatalog: Array<{ name: string; variants_json?: string[] }>): string[] {
  const gazetteer = new Set<string>();
  
  // Add user's brands and variants
  for (const brand of brandCatalog) {
    gazetteer.add(brand.name);
    
    // Add variants if available
    if (brand.variants_json) {
      for (const variant of brand.variants_json) {
        gazetteer.add(variant);
      }
    }
  }
  
  // Add common tech brands/companies that frequently appear in AI responses
  const commonBrands = [
    'Apple', 'Google', 'Microsoft', 'Amazon', 'Meta', 'Facebook', 'Instagram', 
    'Twitter', 'X', 'LinkedIn', 'YouTube', 'TikTok', 'Snapchat',
    'Netflix', 'Spotify', 'Adobe', 'Salesforce', 'Oracle', 'IBM', 'Intel',
    'NVIDIA', 'Tesla', 'Uber', 'Airbnb', 'Zoom', 'Slack', 'Dropbox',
    'GitHub', 'GitLab', 'Atlassian', 'Jira', 'Confluence', 'Trello',
    'Notion', 'Airtable', 'Monday.com', 'Asana', 'ClickUp', 'Basecamp',
    'HubSpot', 'Mailchimp', 'Stripe', 'PayPal', 'Square', 'Shopify',
    'AWS', 'Azure', 'GCP', 'Heroku', 'Vercel', 'Netlify', 'Cloudflare'
  ];
  
  for (const brand of commonBrands) {
    gazetteer.add(brand);
  }
  
  return Array.from(gazetteer);
}

interface PromptWithStats {
  id: string;
  text: string;
  active: boolean;
  created_at: string;
  runs_7d?: number;
  avg_score_7d?: number;
}

interface ProviderResponse {
  id: string;
  provider: string;
  score: number;
  org_brand_present: boolean;
  competitors_count: number;
  run_at: string;
  status: string;
}

interface PromptRowProps {
  prompt: PromptWithStats;
  onRunPrompt: (promptId: string) => void;
  onEdit: (prompt: PromptWithStats) => void;
  canRunPrompts: boolean;
  isRunning?: boolean;
}

const getScoreColor = (score: number) => {
  if (score >= 7) return 'text-green-600 bg-green-50 border-green-200';
  if (score >= 5) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
  return 'text-red-600 bg-red-50 border-red-200';
};

const getScoreIcon = (score: number) => {
  if (score >= 7) return '🏆';
  if (score >= 5) return '⚡';
  return '📊';
};

export function PromptRow({ prompt, onRunPrompt, onEdit, canRunPrompts, isRunning = false }: PromptRowProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [responses, setResponses] = useState<ProviderResponse[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch latest responses when expanded
  useEffect(() => {
    if (isExpanded && responses.length === 0) {
      fetchLatestResponses();
    }
  }, [isExpanded, prompt.id]);

  const fetchLatestResponses = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .rpc('get_latest_prompt_provider_responses', { p_prompt_id: prompt.id });

      if (error) {
        console.error('Error fetching responses:', error);
        return;
      }

      setResponses(data || []);
    } catch (error) {
      console.error('Error fetching responses:', error);
    } finally {
      setLoading(false);
    }
  };

  const averageScore = responses.length > 0 
    ? responses.reduce((sum, r) => sum + r.score, 0) / responses.length 
    : (prompt.avg_score_7d || 0);

  const totalCompetitors = responses.reduce((sum, r) => sum + r.competitors_count, 0);
  const brandMentioned = responses.some(r => r.org_brand_present);

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <Card className="hover:shadow-md transition-all duration-200 border-l-4 border-l-primary/20">
        <CollapsibleTrigger asChild>
          <div className="cursor-pointer">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                {/* Expand/Collapse Icon */}
                <div className="flex-shrink-0 mt-1">
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>

                {/* Prompt Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <p className="font-medium text-foreground leading-relaxed mb-3">
                        {prompt.text}
                      </p>
                      
                      <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          <span>Created {format(new Date(prompt.created_at), 'MMM d, yyyy')}</span>
                        </div>
                        {prompt.runs_7d !== undefined && (
                          <div className="flex items-center gap-1">
                            <BarChart3 className="h-3 w-3" />
                            <span>{prompt.runs_7d} runs (7d)</span>
                          </div>
                        )}
                        {responses.length > 0 && (
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            <span>Last run {format(new Date(Math.max(...responses.map(r => new Date(r.run_at).getTime()))), 'MMM d, h:mm a')}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Score and Actions */}
                    <div className="flex items-center gap-3 flex-shrink-0">
                      {averageScore > 0 && (
                        <div className={cn(
                          "px-3 py-1 rounded-full border text-sm font-medium",
                          getScoreColor(averageScore)
                        )}>
                          <span className="mr-1">{getScoreIcon(averageScore)}</span>
                          {averageScore.toFixed(1)}
                        </div>
                      )}
                      
                      {!prompt.active && (
                        <Badge variant="secondary" className="text-xs">
                          Inactive
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Quick Stats Row */}
                  {responses.length > 0 && (
                    <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        {brandMentioned ? (
                          <>
                            <Trophy className="h-3 w-3 text-green-600" />
                            <span className="text-green-600 font-medium">Brand mentioned</span>
                          </>
                        ) : (
                          <>
                            <Target className="h-3 w-3 text-amber-600" />
                            <span className="text-amber-600 font-medium">Brand not found</span>
                          </>
                        )}
                      </div>
                      <span>•</span>
                      <span>{totalCompetitors} total competitor mentions</span>
                      <span>•</span>
                      <span>{responses.length} provider responses</span>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="border-t bg-muted/30">
            <CardContent className="p-6">
              {loading ? (
                <div className="text-center py-8">
                  <div className="animate-pulse text-muted-foreground">Loading response details...</div>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Provider Responses */}
                  {responses.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-foreground mb-3">Recent Provider Responses</h4>
                      <div className="grid gap-3">
                        {responses.map((response) => (
                          <div key={response.id} className="flex items-center justify-between p-3 bg-card rounded-lg border">
                            <div className="flex items-center gap-3">
                              <div className="capitalize font-medium text-sm">
                                {response.provider}
                              </div>
                              <div className={cn(
                                "px-2 py-1 rounded text-xs font-medium border",
                                getScoreColor(response.score)
                              )}>
                                {response.score.toFixed(1)}
                              </div>
                              {response.org_brand_present && (
                                <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                                  <Trophy className="h-3 w-3 mr-1" />
                                  Brand found
                                </Badge>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {response.competitors_count} competitors • {format(new Date(response.run_at), 'MMM d, h:mm a')}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Competitors Analysis */}
                  <div>
                    <h4 className="text-sm font-semibold text-foreground mb-3">Competitor Analysis</h4>
                    <div className="bg-card rounded-lg border p-4">
                      <PromptCompetitors promptId={prompt.id} />
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-3 pt-4 border-t">
                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRunPrompt(prompt.id);
                      }}
                      disabled={!canRunPrompts || isRunning}
                      size="sm"
                      className="flex items-center gap-2"
                    >
                      <PlayCircle className="h-4 w-4" />
                      {isRunning ? 'Running...' : 'Run Now'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEdit(prompt);
                      }}
                    >
                      Edit Prompt
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
