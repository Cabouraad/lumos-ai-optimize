import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Checkbox } from '@/components/ui/checkbox';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { ProviderResponseCard } from '@/components/ProviderResponseCard';
import { ProviderResponseData } from '@/lib/data/unified-fetcher';
import { reanalyzeProviderResponse } from '@/lib/analysis/response-analyzer';
import { 
  ChevronDown, 
  ChevronRight, 
  MoreHorizontal, 
  Settings2, 
  Copy, 
  Trash2,
  TrendingUp,
  TrendingDown,
  Minus,
  Clock,
  Target,
  Users,
  BarChart3,
  FileText,
  Eye
} from 'lucide-react';
import { getOrgId } from '@/lib/auth';

type ProviderResult = {
  provider: string;
  runAt: string;
  present: boolean;
  position: number | null;
  competitors: number;
  score: number;
};

interface PromptRowData {
  id: string;
  text: string;
  createdAt: string;
  category: string;
  providers: Array<{ name: string; enabled: boolean; lastRun?: string }>;
  lastRunAt?: string;
  visibilityScore: number;
  brandPct: number;
  competitorPct: number;
  sentimentDelta: number;
  active: boolean;
  org_id?: string;
}

interface PromptRowProps {
  prompt: PromptRowData;
  isSelected: boolean;
  isExpanded: boolean;
  onSelect: (checked: boolean) => void;
  onExpand: () => void;
  onToggleActive: (active: boolean) => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  
}

export function PromptRow({
  prompt,
  isSelected,
  isExpanded,
  onSelect,
  onExpand,
  onToggleActive,
  onEdit,
  onDuplicate,
  onDelete,
  
}: PromptRowProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [rawResponses, setRawResponses] = useState<Array<{
    provider: string;
    response: string;
    timestamp: string;
    score: number;
  }>>([]);
  const [isLoadingResponses, setIsLoadingResponses] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<string>('');

  // Provider-specific data states
  const [providerData, setProviderData] = useState<{
    openai: ProviderResponseData | null;
    gemini: ProviderResponseData | null;
    perplexity: ProviderResponseData | null;
  }>({ openai: null, gemini: null, perplexity: null });
  const [loadingProviders, setLoadingProviders] = useState(false);
  const [topCompetitors, setTopCompetitors] = useState<Array<{ name: string; share: number }>>([]);
  const [loadingCompetitors, setLoadingCompetitors] = useState(false);
  const [trendAvg, setTrendAvg] = useState<number | null>(null);
  const [trendRuns, setTrendRuns] = useState<number>(0);

  const getScoreColor = (score: number) => {
    if (score >= 8) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (score >= 5) return 'bg-amber-50 text-amber-700 border-amber-200';
    return 'bg-rose-50 text-rose-700 border-rose-200';
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'Brand Visibility': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'Competitor Monitoring': return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'Content Optimization': return 'bg-green-50 text-green-700 border-green-200';
      default: return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const getSentimentIcon = (delta: number) => {
    if (delta > 0.05) return <TrendingUp className="h-3 w-3 text-green-600" />;
    if (delta < -0.05) return <TrendingDown className="h-3 w-3 text-red-600" />;
    return <Minus className="h-3 w-3 text-gray-400" />;
  };

  const getRelativeTime = (dateString?: string) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
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

  const handleRowClick = (e: React.MouseEvent) => {
    // Don't expand if clicking on interactive elements
    if ((e.target as HTMLElement).closest('button, input, [role="switch"]')) {
      return;
    }
    onExpand();
  };

  const fetchRawResponses = async (promptId: string, providerName: string) => {
    setSelectedProvider(providerName);
    setIsLoadingResponses(true);
    try {
      const { data, error } = await supabase
        .from('prompt_provider_responses')
        .select('*')
        .eq('prompt_id', promptId)
        .eq('provider', providerName.toLowerCase())
        .not('raw_ai_response', 'is', null)
        .order('run_at', { ascending: false })
        .limit(10);

      if (error) {
        console.error('Error fetching raw responses:', error);
        return;
      }

      const responses = data?.map(response => ({
        provider: response.provider || 'unknown',
        response: response.raw_ai_response || '',
        timestamp: response.run_at,
        score: response.score || 0
      })).filter(r => r.response) || [];

      setRawResponses(responses);
    } catch (error) {
      console.error('Error fetching raw responses:', error);
    } finally {
      setIsLoadingResponses(false);
    }
  };

  // Fetch provider-specific data when expanded (with caching to prevent repeated calls)
  useEffect(() => {
    if (!isExpanded) {
      // Reset provider data when collapsed to save memory
      setProviderData({ openai: null, gemini: null, perplexity: null });
      return;
    }

    // Don't refetch if we already have recent data
    const hasRecentData = providerData.openai || providerData.gemini || providerData.perplexity;
    if (hasRecentData && !loadingProviders) {
      return;
    }

    const fetchProviderData = async () => {
      try {
        setLoadingProviders(true);
        
        // Fetch latest provider responses from database instead of making new API calls
        const { data: responses, error } = await supabase
          .from('prompt_provider_responses')
          .select('*')
          .eq('prompt_id', prompt.id)
          .in('provider', ['openai', 'gemini', 'perplexity'])
          .order('run_at', { ascending: false });

        if (error) {
          console.error('Error fetching provider responses:', error);
          setProviderData({ openai: null, gemini: null, perplexity: null });
          return;
        }

        // Get the latest response for each provider
        const latestResponses = {
          openai: responses?.find(r => r.provider === 'openai') || null,
          gemini: responses?.find(r => r.provider === 'gemini') || null,
          perplexity: responses?.find(r => r.provider === 'perplexity') || null,
        };

        // Transform the database responses to match the expected format
        const providers = {
          openai: latestResponses.openai ? {
            id: latestResponses.openai.id,
            provider: 'openai',
            status: latestResponses.openai.status || 'success',
            score: latestResponses.openai.score || 0,
            org_brand_present: latestResponses.openai.org_brand_present || false,
            org_brand_prominence: latestResponses.openai.org_brand_prominence,
            competitors_count: latestResponses.openai.competitors_count || 0,
            competitors_json: Array.isArray(latestResponses.openai.competitors_json) 
              ? latestResponses.openai.competitors_json as string[]
              : [],
            brands_json: Array.isArray(latestResponses.openai.brands_json) 
              ? latestResponses.openai.brands_json as string[]
              : [],
            raw_ai_response: latestResponses.openai.raw_ai_response || '',
            token_in: latestResponses.openai.token_in || 0,
            token_out: latestResponses.openai.token_out || 0,
            run_at: latestResponses.openai.run_at,
            model: latestResponses.openai.model || 'gpt-4o-mini',
            error: latestResponses.openai.error
          } : null,
          gemini: latestResponses.gemini ? {
            id: latestResponses.gemini.id,
            provider: 'gemini',
            status: latestResponses.gemini.status || 'success',
            score: latestResponses.gemini.score || 0,
            org_brand_present: latestResponses.gemini.org_brand_present || false,
            org_brand_prominence: latestResponses.gemini.org_brand_prominence,
            competitors_count: latestResponses.gemini.competitors_count || 0,
            competitors_json: Array.isArray(latestResponses.gemini.competitors_json) 
              ? latestResponses.gemini.competitors_json as string[]
              : [],
            brands_json: Array.isArray(latestResponses.gemini.brands_json) 
              ? latestResponses.gemini.brands_json as string[]
              : [],
            raw_ai_response: latestResponses.gemini.raw_ai_response || '',
            token_in: latestResponses.gemini.token_in || 0,
            token_out: latestResponses.gemini.token_out || 0,
            run_at: latestResponses.gemini.run_at,
            model: latestResponses.gemini.model || 'gemini-2.0-flash-exp',
            error: latestResponses.gemini.error
          } : null,
          perplexity: latestResponses.perplexity ? {
            id: latestResponses.perplexity.id,
            provider: 'perplexity',
            status: latestResponses.perplexity.status || 'success',
            score: latestResponses.perplexity.score || 0,
            org_brand_present: latestResponses.perplexity.org_brand_present || false,
            org_brand_prominence: latestResponses.perplexity.org_brand_prominence,
            competitors_count: latestResponses.perplexity.competitors_count || 0,
            competitors_json: Array.isArray(latestResponses.perplexity.competitors_json) 
              ? latestResponses.perplexity.competitors_json as string[]
              : [],
            brands_json: Array.isArray(latestResponses.perplexity.brands_json) 
              ? latestResponses.perplexity.brands_json as string[]
              : [],
            raw_ai_response: latestResponses.perplexity.raw_ai_response || '',
            token_in: latestResponses.perplexity.token_in || 0,
            token_out: latestResponses.perplexity.token_out || 0,
            run_at: latestResponses.perplexity.run_at,
            model: latestResponses.perplexity.model || 'sonar',
            error: latestResponses.perplexity.error
          } : null,
        };

        setProviderData(providers);
      } catch (error) {
        console.error('Error in fetchProviderData:', error);
        setProviderData({ openai: null, gemini: null, perplexity: null });
      } finally {
        setLoadingProviders(false);
      }
    };

    const fetchCompetitors = async () => {
      try {
        setLoadingCompetitors(true);
        
        const orgId = await getOrgId();
        
        // Use brand_catalog instead of competitor_mentions for competitor data
        const { data, error } = await supabase
          .from('brand_catalog')
          .select('name, total_appearances')
          .eq('org_id', orgId)
          .eq('is_org_brand', false)
          .gt('total_appearances', 0)
          .order('total_appearances', { ascending: false })
          .limit(5);
          
        if (error) {
          console.error('Error fetching competitors:', error);
          setTopCompetitors([]);
          return;
        }
        
        const competitors = (data || []).map(comp => ({
          name: comp.name,
          mentions: comp.total_appearances
        }));
        
        const total = competitors.reduce((sum, comp) => sum + comp.mentions, 0);
        if (total === 0) {
          setTopCompetitors([]);
          return;
        }
        
        setTopCompetitors(
          competitors.map(comp => ({
            name: comp.name,
            share: Math.round((comp.mentions / total) * 100),
          }))
        );
      } catch (error) {
        console.error('Error fetching competitors:', error);
        setTopCompetitors([]);
      } finally {
        setLoadingCompetitors(false);
      }
    };

    const fetchTrend = async () => {
      const { data, error } = await supabase.rpc('get_prompt_visibility_7d');
      
      if (error) {
        console.error('Error fetching trend:', error);
        setTrendAvg(null);
        setTrendRuns(0);
        return;
      }
      
      const promptData = data?.find(item => item.prompt_id === prompt.id);
      if (promptData) {
        setTrendAvg(promptData.avg_score_7d ?? null);
        setTrendRuns(Number(promptData.runs_7d) || 0);
      } else {
        setTrendAvg(null);
        setTrendRuns(0);
      }
    };

    fetchProviderData();
    fetchCompetitors();
    fetchTrend();
  }, [isExpanded, prompt.id]);

  return (
    <TooltipProvider>
      <div 
        className={`
          bg-white rounded-2xl border transition-all duration-200 overflow-hidden
          ${isExpanded ? 'border-primary/30 shadow-soft-lg' : 'border-gray-100 hover:border-gray-200'}
          ${isHovered ? 'bg-gray-50/50' : ''}
        `}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Summary Row */}
        <div
          className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto] gap-4 px-4 py-3 cursor-pointer"
          onClick={handleRowClick}
          role="button"
          tabIndex={0}
          aria-expanded={isExpanded}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onExpand();
            }
          }}
        >
          {/* Checkbox & Expand Toggle */}
          <div className="flex items-center gap-2 py-1">
            <Checkbox
              checked={isSelected}
              onCheckedChange={onSelect}
              className="h-4 w-4"
            />
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 hover:bg-gray-100"
              onClick={(e) => {
                e.stopPropagation();
                onExpand();
              }}
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 text-gray-500" />
              ) : (
                <ChevronRight className="h-4 w-4 text-gray-500" />
              )}
            </Button>
          </div>

          {/* Left Section - Prompt Text & Metadata */}
          <div className="min-w-0 py-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="text-sm font-medium text-gray-900 line-clamp-1" title={prompt.text}>
                  {prompt.text}
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" align="start" className="max-w-md">
                <p>{prompt.text}</p>
              </TooltipContent>
            </Tooltip>
            
            {/* Mobile metadata line */}
            <div className="md:hidden flex items-center gap-2 mt-1">
              <span className="text-xs text-gray-500">
                {new Date(prompt.createdAt).toLocaleDateString()}
              </span>
              <span className="text-gray-300">•</span>
              <Badge 
                variant="outline" 
                className={`text-xs h-4 px-1.5 ${getCategoryColor(prompt.category)}`}
              >
                {prompt.category}
              </Badge>
            </div>
          </div>

          {/* Middle KPIs */}
          <div className="hidden md:flex items-center gap-4 py-1">
            {/* Visibility Score */}
            <div className="flex items-center gap-1">
              <Badge className={`text-xs h-5 px-2 rounded-full border ${getScoreColor(prompt.visibilityScore)}`}>
                {prompt.visibilityScore > 0 ? prompt.visibilityScore.toFixed(1) : '0.0'}
              </Badge>
            </div>

            {/* Brand/Competitor Metrics */}
            <div className="flex items-center gap-3 text-xs text-gray-600">
              <div className="flex items-center gap-1">
                <Target className="h-3 w-3 text-blue-500" />
                <span>{prompt.brandPct}%</span>
              </div>
              <div className="flex items-center gap-1">
                <Users className="h-3 w-3 text-purple-500" />
                <span>{prompt.competitorPct}%</span>
              </div>
              <div className="flex items-center gap-1">
                {getSentimentIcon(prompt.sentimentDelta)}
              </div>
            </div>

            {/* Last Run */}
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <Clock className="h-3 w-3" />
              <span>{getRelativeTime(prompt.lastRunAt)}</span>
            </div>

            {/* Providers */}
            <div className="flex gap-1">
              {prompt.providers.map((provider) => (
                <Badge
                  key={provider.name}
                  variant="outline"
                  className={`
                    text-xs h-5 px-1.5 border rounded-full
                    ${provider.enabled 
                      ? 'bg-slate-100 text-slate-700 border-slate-200' 
                      : 'bg-slate-50 text-slate-400 border-slate-200 opacity-60'
                    }
                  `}
                >
                  {provider.name === 'openai' ? '🤖' : provider.name === 'perplexity' ? '🔍' : '✨'}
                </Badge>
              ))}
            </div>
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-2 py-1">
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-500 hidden sm:inline">Active</span>
              <Switch
                checked={prompt.active}
                onCheckedChange={onToggleActive}
                className="h-4 w-7 [&>span]:h-3 [&>span]:w-3"
              />
            </div>


            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 hover:bg-gray-100"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreHorizontal className="h-4 w-4 text-gray-500" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-32">
                <DropdownMenuItem onClick={onEdit} className="text-xs">
                  <Settings2 className="mr-2 h-3 w-3" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onDuplicate} className="text-xs">
                  <Copy className="mr-2 h-3 w-3" />
                  Duplicate
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={onDelete} 
                  className="text-xs text-red-600 focus:text-red-600"
                >
                  <Trash2 className="mr-2 h-3 w-3" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Expandable Details Panel */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              className="overflow-hidden"
            >
              <div className="border-t border-gray-100 bg-gray-50/50 p-4">
                <div className="space-y-6">
                  {/* Provider Results Grid */}
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900 mb-4">Latest Provider Results</h4>
                    {loadingProviders ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="text-center">
                          <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2"></div>
                          <p className="text-sm text-muted-foreground">Loading results...</p>
                        </div>
                      </div>
                    ) : (
                      <div className="grid lg:grid-cols-3 gap-4">
                        <ProviderResponseCard 
                          provider="openai" 
                          response={providerData.openai} 
                          promptText={prompt.text}
                        />
                        <ProviderResponseCard 
                          provider="gemini" 
                          response={providerData.gemini} 
                          promptText={prompt.text}
                        />
                        <ProviderResponseCard 
                          provider="perplexity" 
                          response={providerData.perplexity} 
                          promptText={prompt.text}
                        />
                      </div>
                    )}
                  </div>
                  
                  {/* Competitor & Trend Analysis */}
                  <div className="grid md:grid-cols-2 gap-6">
                    {/* Competitors */}
                    <div>
                      <h5 className="text-sm font-semibold text-gray-900 mb-3">Top Competitors</h5>
                      {loadingCompetitors ? (
                        <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
                          <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full mr-2"></div>
                          Loading competitors...
                        </div>
                      ) : topCompetitors.length === 0 ? (
                        <div className="text-sm text-muted-foreground bg-white rounded-lg border border-dashed p-4">
                          No competitor mentions found yet
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {topCompetitors.map((competitor, index) => (
                            <div key={index} className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-100">
                              <span className="text-sm font-medium text-gray-900">{competitor.name}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-600">{competitor.share}%</span>
                                <div className="w-16 h-2 bg-gray-100 rounded overflow-hidden">
                                  <div 
                                    className="h-full bg-purple-500" 
                                    style={{ width: `${competitor.share}%` }} 
                                  />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Trend Analysis */}
                    <div>
                      <h5 className="text-sm font-semibold text-gray-900 mb-3">7-Day Performance</h5>
                      
                      {/* Mini trend using real data */}
                      <div className="bg-white rounded-lg border border-gray-100 p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-gray-700">Average Score</span>
                          {trendRuns > 0 ? (
                            <div className="flex items-center gap-1 text-xs text-gray-600">
                              <BarChart3 className="h-3 w-3" />
                              {trendAvg !== null ? `${trendAvg.toFixed(1)}/10` : '—'}
                            </div>
                          ) : null}
                        </div>
                        {trendRuns === 0 ? (
                          <div className="h-8 rounded border border-dashed text-xs flex items-center justify-center text-muted-foreground">
                            No trend data yet
                          </div>
                        ) : (
                          <div className="h-2 rounded bg-gray-100 overflow-hidden">
                            <div
                              className="h-full bg-blue-500"
                              style={{ width: `${Math.min(100, Math.max(0, (trendAvg || 0) * 10))}%` }}
                            />
                          </div>
                        )}
                        {trendRuns > 0 && (
                          <div className="text-xs text-gray-500 mt-2">
                            {trendRuns} runs in last 7 days
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer actions */}
                <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-100">
                  <Button size="sm" variant="outline" onClick={() => onToggleActive(!prompt.active)} className="h-7 text-xs">
                    {prompt.active ? 'Pause' : 'Resume'}
                  </Button>
                  <Button size="sm" variant="outline" onClick={onEdit} className="h-7 text-xs">
                    <Settings2 className="mr-1 h-3 w-3" />
                    Edit
                  </Button>
                  <Button size="sm" variant="outline" onClick={onDelete} className="h-7 text-xs text-red-600 hover:text-red-600 hover:bg-red-50">
                    <Trash2 className="mr-1 h-3 w-3" />
                    Delete
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </TooltipProvider>
  );
}