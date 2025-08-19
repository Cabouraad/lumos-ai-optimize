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

  // Live data states (no mock data)
  const [latestResults, setLatestResults] = useState<ProviderResult[]>([]);
  const [loadingLatest, setLoadingLatest] = useState(false);
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
        .from('prompt_runs')
        .select(`
          id,
          run_at,
          llm_providers!inner(name),
          visibility_results(raw_ai_response, score)
        `)
        .eq('prompt_id', promptId)
        .eq('llm_providers.name', providerName)
        .not('visibility_results.raw_ai_response', 'is', null)
        .order('run_at', { ascending: false })
        .limit(10);

      if (error) {
        console.error('Error fetching raw responses:', error);
        return;
      }

      const responses = data?.map(run => ({
        provider: run.llm_providers?.name || 'unknown',
        response: run.visibility_results?.[0]?.raw_ai_response || '',
        timestamp: run.run_at,
        score: run.visibility_results?.[0]?.score || 0
      })).filter(r => r.response) || [];

      setRawResponses(responses);
    } catch (error) {
      console.error('Error fetching raw responses:', error);
    } finally {
      setIsLoadingResponses(false);
    }
  };

  // Fetch live data when expanded
  useEffect(() => {
    if (!isExpanded) return;

    const fetchLatest = async () => {
      try {
        setLoadingLatest(true);
        const { data, error } = await supabase
          .from('prompt_runs')
          .select(`
            run_at,
            status,
            llm_providers!inner(name),
            visibility_results(
              org_brand_present,
              org_brand_prominence,
              competitors_count,
              score,
              raw_ai_response
            )
          `)
          .eq('prompt_id', prompt.id)
          .eq('status', 'success')
          .order('run_at', { ascending: false })
          .limit(50);

        if (error) {
          console.error('Error fetching latest results:', error);
          setLatestResults([]);
        } else {
          const byProvider = new Map<string, ProviderResult>();
          (data || []).forEach((run: any) => {
            const provider = run.llm_providers?.name;
            const vr = run.visibility_results?.[0];
            if (!provider || !vr) return;
            if (!byProvider.has(provider)) {
              byProvider.set(provider, {
                provider,
                runAt: run.run_at,
                present: !!vr.org_brand_present,
                position: vr.org_brand_prominence ?? null,
                competitors: vr.competitors_count ?? 0,
                score: vr.score ?? 0,
              });
            }
          });
          setLatestResults(Array.from(byProvider.values()));
        }
      } finally {
        setLoadingLatest(false);
      }
    };

    const fetchCompetitors = async () => {
      try {
        setLoadingCompetitors(true);
        const { data, error } = await supabase
          .from('competitor_mentions')
          .select('competitor_name, mention_count')
          .eq('prompt_id', prompt.id)
          .order('mention_count', { ascending: false })
          .limit(5);
        if (error) {
          console.error('Error fetching competitors:', error);
          setTopCompetitors([]);
          return;
        }
        const rows = data || [];
        const total = rows.reduce((sum: number, r: any) => sum + (r.mention_count || 0), 0);
        if (total === 0) {
          setTopCompetitors([]);
          return;
        }
        setTopCompetitors(
          rows.map((r: any) => ({
            name: r.competitor_name,
            share: Math.round(((r.mention_count || 0) / total) * 100),
          }))
        );
      } finally {
        setLoadingCompetitors(false);
      }
    };

    const fetchTrend = async () => {
      const { data, error } = await supabase
        .from('v_prompt_visibility_7d')
        .select('avg_score_7d, runs_7d')
        .eq('prompt_id', prompt.id)
        .limit(1);
      if (error) {
        console.error('Error fetching trend:', error);
        setTrendAvg(null);
        setTrendRuns(0);
        return;
      }
      if (data && data.length > 0) {
        setTrendAvg(data[0].avg_score_7d ?? null);
        setTrendRuns(Number(data[0].runs_7d) || 0);
      } else {
        setTrendAvg(null);
        setTrendRuns(0);
      }
    };

    fetchLatest();
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

            <div className="text-xs text-muted-foreground px-3 py-1.5 bg-muted/50 rounded-lg">
              Runs automatically at 3:00 AM ET
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
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Left Column - Latest Visibility Results */}
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900 mb-3">Latest Visibility Results</h4>
                    <div className="space-y-3">
                      {loadingLatest ? (
                        <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
                          <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full mr-2"></div>
                          Loading latest results...
                        </div>
                      ) : latestResults.length === 0 ? (
                        <div className="text-sm text-muted-foreground bg-white rounded-lg border border-dashed p-4">
                          No results yet. Run this prompt to see provider visibility.
                        </div>
                      ) : (
                        latestResults.map((result, index) => (
                          <div key={index} className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-100">
                            <div className="flex items-center gap-3">
                              <div className="text-lg">
                                {result.provider === 'openai' ? '🤖' : result.provider === 'perplexity' ? '🔍' : '✨'}
                              </div>
                              <div>
                                <div className="text-sm font-medium text-gray-900 capitalize">{result.provider}</div>
                                <div className="text-xs text-gray-500">{getRelativeTime(result.runAt)}</div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge 
                                variant="outline" 
                                className={`text-xs h-5 px-2 ${result.present ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-gray-700 border-gray-200'}`}
                              >
                                {result.present ? (result.position !== null ? `#${result.position}` : 'Found') : 'Not found'}
                              </Badge>
                              <Badge className={`text-xs h-5 px-2 rounded-full border ${getScoreColor(result.score)}`}>
                                {Number.isFinite(result.score) ? result.score.toFixed(1) : '0.0'}
                              </Badge>
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="h-6 px-2 text-xs text-blue-600 hover:bg-blue-50"
                                    onClick={() => fetchRawResponses(prompt.id, result.provider)}
                                  >
                                    <Eye className="mr-1 h-3 w-3" />
                                    View
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-4xl max-h-[80vh]">
                                  <DialogHeader>
                                    <DialogTitle className="flex items-center gap-2">
                                      <FileText className="h-5 w-5" />
                                      Raw {selectedProvider.charAt(0).toUpperCase() + selectedProvider.slice(1)} Responses for "{prompt.text}"
                                    </DialogTitle>
                                  </DialogHeader>
                                  <ScrollArea className="max-h-[60vh]">
                                    {isLoadingResponses ? (
                                      <div className="flex items-center justify-center py-8">
                                        <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full"></div>
                                        <span className="ml-2 text-sm text-muted-foreground">Loading responses...</span>
                                      </div>
                                    ) : rawResponses.length === 0 ? (
                                      <div className="text-center py-8 text-muted-foreground">
                                        <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                                        <p className="text-lg font-medium mb-1">No data to show</p>
                                        <p>No raw responses found for {selectedProvider.charAt(0).toUpperCase() + selectedProvider.slice(1)} on this prompt</p>
                                      </div>
                                    ) : (
                                      <div className="space-y-4">
                                        {rawResponses.map((response, idx) => (
                                          <div key={idx} className="border rounded-lg p-4 bg-gray-50/50">
                                            <div className="flex items-center justify-between mb-3">
                                              <div className="flex items-center gap-2">
                                                <div className="text-lg">
                                                  {response.provider === 'openai' ? '🤖' : response.provider === 'perplexity' ? '🔍' : '✨'}
                                                </div>
                                                <div>
                                                  <div className="text-sm font-medium text-gray-900 capitalize">
                                                    {response.provider}
                                                  </div>
                                                  <div className="text-xs text-gray-500">
                                                    {new Date(response.timestamp).toLocaleString()}
                                                  </div>
                                                </div>
                                              </div>
                                              <Badge className={`text-xs h-5 px-2 rounded-full border ${getScoreColor(response.score)}`}>
                                                Score: {response.score}
                                              </Badge>
                                            </div>
                                            <div className="bg-white rounded border p-3">
                                              <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono leading-relaxed">
                                                {response.response}
                                              </pre>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </ScrollArea>
                                </DialogContent>
                              </Dialog>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Right Column - Performance Snapshot */}
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900 mb-3">Performance Snapshot</h4>
                    
                    {/* Mini trend using real data */}
                    <div className="bg-white rounded-lg border border-gray-100 p-3 mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-gray-700">7-Day Trend</span>
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
                            className="h-full bg-[hsl(var(--accent))]"
                            style={{ width: `${Math.min(100, Math.max(0, (trendAvg || 0) * 10))}%` }}
                          />
                        </div>
                      )}
                    </div>

                    {/* Top competitors from real data */}
                    <div className="bg-white rounded-lg border border-gray-100 p-3">
                      <h5 className="text-xs font-medium text-gray-700 mb-2">Top Competitors</h5>
                      {loadingCompetitors ? (
                        <div className="flex items-center justify-center py-4 text-xs text-muted-foreground">
                          <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full mr-2"></div>
                          Loading…
                        </div>
                      ) : topCompetitors.length === 0 ? (
                        <div className="text-xs text-muted-foreground border border-dashed rounded p-3">
                          No competitor mentions yet
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {topCompetitors.map((c) => (
                            <div key={c.name} className="flex items-center justify-between text-xs">
                              <span className="text-gray-900">{c.name}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-gray-600">{c.share}%</span>
                                <div className="w-16 h-1 bg-gray-100 rounded overflow-hidden">
                                  <div className="h-full bg-[hsl(var(--primary))]" style={{ width: `${c.share}%` }} />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Footer actions */}
                <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-100">
                  <div className="text-xs text-muted-foreground px-3 py-1.5 bg-muted/50 rounded-lg">
                    Runs automatically at 3:00 AM ET
                  </div>
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