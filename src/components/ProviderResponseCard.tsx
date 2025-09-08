import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ProviderResponseData } from '@/lib/data/unified-fetcher';
import { CheckCircle, XCircle, Trophy, Users, FileText, Clock, Zap, AlertTriangle } from 'lucide-react';
import { ResponseClassificationFixer } from './ResponseClassificationFixer';
import { CompetitorChipList } from './CompetitorChip';
import { useOrgBrands } from '@/hooks/useOrgBrands';
import { cleanCompetitors } from '@/lib/brand/competitor-cleaning';
import { useCatalogCompetitors } from '@/hooks/useCatalogCompetitors';

interface ProviderResponseCardProps {
  provider: 'openai' | 'gemini' | 'perplexity';
  response: ProviderResponseData | null;
  promptText: string;
}

const PROVIDER_CONFIG = {
  openai: { name: 'OpenAI', color: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
  gemini: { name: 'Gemini', color: 'bg-purple-50 border-purple-200 text-purple-700' },
  perplexity: { name: 'Perplexity', color: 'bg-blue-50 border-blue-200 text-blue-700' }
};

export function ProviderResponseCard({ provider, response, promptText }: ProviderResponseCardProps) {
  const config = PROVIDER_CONFIG[provider];
  const { orgBrandVariants } = useOrgBrands();
  const { filterCompetitorsByCatalog } = useCatalogCompetitors();

  if (!response) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            {config.name}
            <Badge variant="outline" className="text-xs text-muted-foreground">
              No data
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground text-center py-6">
            No recent responses available
          </div>
        </CardContent>
      </Card>
    );
  }

  // Clean competitors using org brand variants and catalog filter
  const cleanedCompetitors = cleanCompetitors(
    response.competitors_json || [], 
    orgBrandVariants, 
    { catalogFilter: filterCompetitorsByCatalog }
  );

  const getScoreColor = (score: number) => {
    if (score >= 8) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (score >= 5) return 'bg-amber-50 text-amber-700 border-amber-200';
    return 'bg-rose-50 text-rose-700 border-rose-200';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'error': case 'failed': return 'bg-rose-50 text-rose-700 border-rose-200';
      default: return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const getRelativeTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 30) return `${diffDays}d ago`;
    return date.toLocaleDateString();
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

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            {config.name}
          </div>
          <div className="flex items-center gap-2">
            <Badge className={`text-xs ${getStatusColor(response.status)}`}>
              {response.status}
            </Badge>
            <Badge className={`font-bold px-2 py-1 ${getScoreColor(response.score)}`}>
              {response.score}/10
            </Badge>
          </div>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Last Run Time */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          Last run: {getRelativeTime(response.run_at)}
        </div>

        {response.status === 'error' && response.error ? (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg">
            <p className="text-sm font-medium text-rose-800">Error</p>
            <p className="text-xs text-rose-600 mt-1">{typeof response.error === 'string' ? response.error : (response.error as any)?.message || 'Unknown error'}</p>
          </div>
        ) : (
          <>
            {/* Key Metrics */}
            <div className="grid grid-cols-3 gap-3">
              {/* Brand Presence */}
              <div className="flex items-start gap-2">
                {response.org_brand_present ? (
                  <CheckCircle className="h-4 w-4 text-emerald-500 mt-0.5" />
                ) : (
                  <XCircle className="h-4 w-4 text-rose-500 mt-0.5" />
                )}
                <div>
                  <p className="text-xs font-medium">Brand Found</p>
                  <p className="text-xs text-muted-foreground">
                    {response.org_brand_present ? 'Yes' : 'No'}
                  </p>
                </div>
              </div>

              {/* Brand Position */}
              <div className="flex items-start gap-2">
                <Trophy className="h-4 w-4 text-amber-500 mt-0.5" />
                <div>
                  <p className="text-xs font-medium">Position</p>
                   <p className="text-xs text-muted-foreground">
                     {getProminenceText(response.org_brand_prominence, response.raw_ai_response)}
                   </p>
                </div>
              </div>

              {/* Competitors */}
              <div className="flex items-start gap-2">
                <Users className="h-4 w-4 text-blue-500 mt-0.5" />
                <div>
                  <p className="text-xs font-medium">Competitors</p>
                  <p className="text-xs text-muted-foreground">
                    {cleanedCompetitors.length} found
                  </p>
                </div>
              </div>
            </div>

            {/* Competitors Found */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <p className="text-xs font-medium">Competitors Found:</p>
                {cleanedCompetitors.length > 15 && (
                  <Tooltip>
                    <TooltipTrigger>
                      <AlertTriangle className="h-3 w-3 text-amber-500" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>High competitor count may indicate classification issues</p>
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
              <CompetitorChipList 
                competitors={cleanedCompetitors}
                maxDisplay={4}
                size="sm"
                skipCatalogValidation={true}
              />
            </div>

            {/* AI Response Preview */}
            {response.raw_ai_response && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium">AI Response:</p>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" className="h-6 text-xs px-2">
                        <FileText className="h-3 w-3 mr-1" />
                        View Full
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-4xl max-h-[80vh]">
                      <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                          {config.name} Response
                        </DialogTitle>
                        <DialogDescription>
                          Response to: "{promptText.substring(0, 100)}..."
                        </DialogDescription>
                      </DialogHeader>
                      <ScrollArea className="max-h-96 mt-4">
                        <div className="p-4 bg-muted rounded-lg">
                          <pre className="whitespace-pre-wrap text-sm leading-relaxed">
                            {response.raw_ai_response}
                          </pre>
                        </div>
                      </ScrollArea>
                    </DialogContent>
                  </Dialog>
                </div>
                <div className="text-xs text-muted-foreground bg-muted/30 p-2 rounded border-l-2 border-primary/30 line-clamp-3">
                  {response.raw_ai_response.length > 120 
                    ? `${response.raw_ai_response.substring(0, 120)}...` 
                    : response.raw_ai_response
                  }
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}