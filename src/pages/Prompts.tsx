import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import { getSafePromptsData } from '@/lib/prompts/safe-data';
import { runPromptNow } from '../../lib/prompts/data';
import { getSuggestedPrompts, acceptSuggestion, dismissSuggestion, generateSuggestionsNow } from '@/lib/suggestions/data';
import { useToast } from '@/hooks/use-toast';
import { Plus, Play, CheckCircle, XCircle, Clock, Lightbulb, Check, X, Sparkles, ChevronDown, ChevronRight, Trash2, Eye, Search, Filter, Target, Users, BarChart3, Zap, Settings2, TrendingUp, Award } from 'lucide-react';
import { KeywordManagement } from '@/components/KeywordManagement';
import { PromptVisibilityResults } from '@/components/PromptVisibilityResults';
import { Skeleton } from '@/components/ui/skeleton';

export default function Prompts() {
  const { orgData } = useAuth();
  const { toast } = useToast();
  const [prompts, setPrompts] = useState<any[]>([]);
  const [filteredPrompts, setFilteredPrompts] = useState<any[]>([]);
  const [suggestedPrompts, setSuggestedPrompts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [generatingsuggestions, setGeneratingSuggestions] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newPromptText, setNewPromptText] = useState('');
  const [runningPrompts, setRunningPrompts] = useState<Set<string>>(new Set());
  const [collapsedPrompts, setCollapsedPrompts] = useState<Set<string>>(new Set());
  const [deletingPrompts, setDeletingPrompts] = useState<Set<string>>(new Set());
  const [runningAll, setRunningAll] = useState(false);
  const [providerResponses, setProviderResponses] = useState<Record<string, Record<string, { response: string; run_at: string }>>>({});
  const [viewingResponse, setViewingResponse] = useState<{provider: string, response: string, runAt?: string} | null>(null);
  
  // New search and filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [filterProvider, setFilterProvider] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');

  useEffect(() => {
    if (orgData?.organizations?.id) {
      loadPromptsData();
      loadSuggestedPrompts();
    }
  }, [orgData]);

  useEffect(() => {
    // Filter prompts based on search and filters
    let filtered = prompts.filter(prompt => {
      // Search filter
      const searchMatch = prompt.text.toLowerCase().includes(searchQuery.toLowerCase());
      
      // Status filter
      const statusMatch = filterStatus === 'all' || 
                         (filterStatus === 'active' && prompt.active) ||
                         (filterStatus === 'paused' && !prompt.active);
      
      // Category filter (mock categories based on keywords)
      const categoryMatch = filterCategory === 'all' ||
                            (filterCategory === 'brand' && (prompt.text.toLowerCase().includes('brand') || prompt.text.toLowerCase().includes('company'))) ||
                            (filterCategory === 'competitor' && (prompt.text.toLowerCase().includes('competitor') || prompt.text.toLowerCase().includes('vs') || prompt.text.toLowerCase().includes('alternative'))) ||
                            (filterCategory === 'content' && (prompt.text.toLowerCase().includes('content') || prompt.text.toLowerCase().includes('blog') || prompt.text.toLowerCase().includes('article')));

      return searchMatch && statusMatch && categoryMatch;
    });

    setFilteredPrompts(filtered);
  }, [prompts, searchQuery, filterStatus, filterCategory]);

  const loadPromptsData = async () => {
    try {
      const data = await getSafePromptsData();
      setPrompts(data);
      
      // Load raw responses for each prompt
      if (orgData?.organizations?.id) {
        await loadProviderResponses(data);
      }
      
      setError(null);
    } catch (err: any) {
      setError(err?.message || 'Failed to load prompts');
    } finally {
      setLoading(false);
    }
  };

  const loadProviderResponses = async (promptsData: any[]) => {
    try {
      const responses: Record<string, Record<string, { response: string; run_at: string }>> = {};
      
      for (const prompt of promptsData) {
        // Get latest runs for this prompt with raw responses via relations
        const { data: runs, error: runsError } = await supabase
          .from('prompt_runs')
          .select(`
            id,
            run_at,
            prompt_id,
            llm_providers ( name ),
            visibility_results ( raw_ai_response )
          `)
          .eq('prompt_id', prompt.id)
          .order('run_at', { ascending: false });

        if (runsError) {
          console.error('Runs query error for prompt', prompt.id, ':', runsError);
        }

        if (runs && runs.length > 0) {
          responses[prompt.id] = {};
          
          // Get the latest response for each provider
          const providerResponsesMap: Record<string, { response: string; run_at: string }> = {};
          runs.forEach((run: any) => {
            const providerNameRaw = run.llm_providers?.name;
            if (!providerNameRaw) return;
            const providerKey = typeof providerNameRaw === 'string' ? providerNameRaw.toLowerCase() : String(providerNameRaw);
            const runAt = run.run_at as string;
            const vr = Array.isArray(run.visibility_results) ? run.visibility_results[0] : run.visibility_results;
            const rawResponse = vr?.raw_ai_response as string | undefined;
            if (!rawResponse) return;
            
            if (!providerResponsesMap[providerKey] || new Date(runAt) > new Date(providerResponsesMap[providerKey].run_at)) {
              providerResponsesMap[providerKey] = {
                response: rawResponse,
                run_at: runAt
              };
            }
          });
          
          // Store the latest responses
          Object.entries(providerResponsesMap).forEach(([provider, data]) => {
            responses[prompt.id][provider] = data;
          });
        }
      }
      
      setProviderResponses(responses);
    } catch (error) {
      console.error('Error loading provider responses:', error);
    }
  };

  const handleViewResponse = (provider: string, promptId: string) => {
    const entry = providerResponses[promptId]?.[provider];
    if (entry?.response) {
      setViewingResponse({ provider, response: entry.response, runAt: entry.run_at });
    }
  };

  const loadSuggestedPrompts = async () => {
    try {
      setSuggestionsLoading(true);
      const data = await getSuggestedPrompts();
      setSuggestedPrompts(data);
    } catch (err) {
      console.error('Failed to load suggested prompts:', err);
    } finally {
      setSuggestionsLoading(false);
    }
  };

  const handleAddPrompt = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newPromptText.trim() || !orgData?.organizations?.id) return;

    try {
      const { error } = await supabase
        .from('prompts')
        .insert({
          org_id: orgData.organizations.id,
          text: newPromptText.trim(),
          active: true
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Prompt added successfully",
      });

      setNewPromptText('');
      setIsAddModalOpen(false);
      loadPromptsData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleToggleActive = async (promptId: string, active: boolean) => {
    try {
      const { error } = await supabase
        .from('prompts')
        .update({ active })
        .eq('id', promptId);

      if (error) throw error;

      loadPromptsData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleRunNow = async (promptId: string) => {
    if (!orgData?.organizations?.id) return;

    setRunningPrompts(prev => new Set(prev).add(promptId));

    try {
      await runPromptNow(promptId, orgData.organizations.id);
      
      toast({
        title: "Success",
        description: "Prompt executed successfully",
      });

      loadPromptsData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setRunningPrompts(prev => {
        const next = new Set(prev);
        next.delete(promptId);
        return next;
      });
    }
  };

  const handleRunAll = async () => {
    const activePrompts = filteredPrompts.filter(prompt => prompt.active);
    if (activePrompts.length === 0 || !orgData?.organizations?.id) return;

    setRunningAll(true);
    const allPromptIds = activePrompts.map(p => p.id);
    setRunningPrompts(new Set(allPromptIds));

    let successCount = 0;
    let errorCount = 0;

    // Run prompts sequentially to avoid rate limits
    for (const prompt of activePrompts) {
      try {
        await runPromptNow(prompt.id, orgData.organizations.id);
        successCount++;
      } catch (error: any) {
        console.error(`Error running prompt ${prompt.id}:`, error);
        errorCount++;
      }
    }

    if (successCount > 0) {
      toast({
        title: "Batch Run Complete",
        description: `${successCount} prompts completed successfully${errorCount > 0 ? `, ${errorCount} failed` : ''}`,
      });
    } else {
      toast({
        title: "Batch Run Failed",
        description: "All prompts failed to execute",
        variant: "destructive",
      });
    }

    setRunningPrompts(new Set());
    setRunningAll(false);
    loadPromptsData();
  };

  const handleDeletePrompt = async (promptId: string) => {
    if (!orgData?.organizations?.id) return;

    setDeletingPrompts(prev => new Set(prev).add(promptId));

    try {
      const { error } = await supabase
        .from('prompts')
        .delete()
        .eq('id', promptId)
        .eq('org_id', orgData.organizations.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Prompt deleted successfully",
      });

      loadPromptsData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setDeletingPrompts(prev => {
        const next = new Set(prev);
        next.delete(promptId);
        return next;
      });
    }
  };

  const handleAcceptSuggestion = async (suggestionId: string) => {
    try {
      await acceptSuggestion(suggestionId);
      toast({
        title: "Success",
        description: "Suggestion accepted and added as prompt",
      });
      loadPromptsData();
      loadSuggestedPrompts();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDismissSuggestion = async (suggestionId: string) => {
    try {
      await dismissSuggestion(suggestionId);
      toast({
        title: "Success",
        description: "Suggestion dismissed",
      });
      loadSuggestedPrompts();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleGenerateMoreSuggestions = async () => {
    try {
      setGeneratingSuggestions(true);
      const result = await generateSuggestionsNow();
      
      if (result.suggestionsCreated === 0) {
        toast({
          title: "Info",
          description: result.message || "No new suggestions to add - all current suggestions already exist",
        });
      } else {
        toast({
          title: "Success",
          description: `${result.suggestionsCreated} new suggestions generated`,
        });
      }
      
      loadSuggestedPrompts();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setGeneratingSuggestions(false);
    }
  };

  const getSourceIcon = (source: string) => {
    switch (source) {
      case 'industry': return <Lightbulb className="h-4 w-4 text-chart-4" />;
      case 'competitors': return <Users className="h-4 w-4 text-chart-5" />;
      case 'gap': return <Target className="h-4 w-4 text-warning" />;
      default: return <Sparkles className="h-4 w-4 text-success" />;
    }
  };

  const getPromptCategory = (text: string) => {
    const lowerText = text.toLowerCase();
    if (lowerText.includes('brand') || lowerText.includes('company')) return 'Brand Visibility';
    if (lowerText.includes('competitor') || lowerText.includes('vs') || lowerText.includes('alternative')) return 'Competitor Monitoring';
    if (lowerText.includes('content') || lowerText.includes('blog') || lowerText.includes('article')) return 'Content Optimization';
    return 'General';
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'Brand Visibility': return 'bg-primary/10 text-primary border-primary/20';
      case 'Competitor Monitoring': return 'bg-chart-5/10 text-chart-5 border-chart-5/20';
      case 'Content Optimization': return 'bg-success/10 text-success border-success/20';
      default: return 'bg-muted text-muted-foreground border-muted';
    }
  };

  const getVisibilityScore = (promptId: string) => {
    // Mock score calculation - in real app this would come from actual data
    const scores = [6.2, 7.1, 8.4, 5.9, 9.2, 6.8, 7.5, 8.1];
    const index = parseInt(promptId.slice(-1), 16) % scores.length;
    return scores[index] || 6.5;
  };

  const getSentimentScore = (promptId: string) => {
    // Mock sentiment - in real app this would come from actual analysis
    const sentiments = [0.8, 0.6, 0.9, 0.4, 0.7, 0.85, 0.65];
    const index = parseInt(promptId.slice(-2, -1), 16) % sentiments.length;
    return sentiments[index] || 0.7;
  };

  if (loading) {
    return (
      <Layout>
        <div className="min-h-screen bg-background p-6">
          <div className="max-w-7xl mx-auto space-y-8">
            {/* Header Skeleton */}
            <div className="space-y-2">
              <Skeleton className="h-9 w-48" />
              <Skeleton className="h-5 w-96" />
            </div>

            {/* Cards Skeleton */}
            <div className="space-y-6">
              {[...Array(3)].map((_, i) => (
                <Card key={i} className="shadow-soft">
                  <CardContent className="p-6">
                    <Skeleton className="h-32 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="min-h-screen bg-background p-6">
          <div className="max-w-7xl mx-auto">
            <div className="text-center py-12">
              <XCircle className="h-12 w-12 text-error mx-auto mb-4" />
              <h1 className="text-2xl font-semibold mb-2">Unable to Load Prompts</h1>
              <p className="text-muted-foreground mb-6">{error}</p>
              <Button onClick={() => window.location.reload()}>
                Try Again
              </Button>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Header */}
          <div className="space-y-4">
            <div className="flex justify-between items-start">
              <div className="space-y-2">
                <h1 className="text-4xl font-display font-bold text-foreground">Prompts</h1>
                <p className="text-lg text-muted-foreground">
                  Manage search prompts and discover AI-suggested improvements
                </p>
              </div>
              
              <div className="flex items-center gap-3">
                {filteredPrompts.filter(p => p.active).length > 0 && (
                  <Button
                    variant="outline"
                    onClick={handleRunAll}
                    disabled={runningAll || runningPrompts.size > 0}
                    className="bg-primary/10 border-primary/30 hover:bg-primary/20"
                  >
                    <Play className="mr-2 h-4 w-4" />
                    {runningAll ? `Running ${filteredPrompts.filter(p => p.active).length} prompts...` : `Run All (${filteredPrompts.filter(p => p.active).length})`}
                  </Button>
                )}

                <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
                  <DialogTrigger asChild>
                    <Button className="bg-primary hover:bg-primary-hover shadow-soft">
                      <Plus className="mr-2 h-4 w-4" />
                      Add Prompt
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="rounded-2xl">
                    <DialogHeader>
                      <DialogTitle className="text-xl">Add New Prompt</DialogTitle>
                      <DialogDescription>
                        Create a new prompt to monitor your brand visibility
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleAddPrompt} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="prompt-text">Prompt Text</Label>
                        <Textarea
                          id="prompt-text"
                          placeholder="e.g., What are the best project management tools?"
                          value={newPromptText}
                          onChange={(e) => setNewPromptText(e.target.value)}
                          rows={4}
                          required
                          className="rounded-xl"
                        />
                      </div>
                      <div className="flex justify-end space-x-2">
                        <Button type="button" variant="outline" onClick={() => setIsAddModalOpen(false)}>
                          Cancel
                        </Button>
                        <Button type="submit" disabled={!newPromptText.trim()}>
                          Add Prompt
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            {/* Search and Filters */}
            <Card className="shadow-soft rounded-2xl border-0">
              <CardContent className="p-6">
                <div className="flex flex-col lg:flex-row gap-4">
                  <div className="flex-1">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                      <Input
                        placeholder="Search prompts..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 rounded-xl bg-muted/50 border-0"
                      />
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                      <SelectTrigger className="w-36 rounded-xl bg-muted/50 border-0">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="paused">Paused</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select value={filterCategory} onValueChange={setFilterCategory}>
                      <SelectTrigger className="w-44 rounded-xl bg-muted/50 border-0">
                        <SelectValue placeholder="Category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Categories</SelectItem>
                        <SelectItem value="brand">Brand Visibility</SelectItem>
                        <SelectItem value="competitor">Competitor Monitoring</SelectItem>
                        <SelectItem value="content">Content Optimization</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="prompts" className="w-full">
            <TabsList className="grid w-full grid-cols-2 rounded-2xl bg-muted/30 p-1">
              <TabsTrigger value="prompts" className="rounded-xl">My Prompts</TabsTrigger>
              <TabsTrigger value="keywords" className="rounded-xl">Business Context</TabsTrigger>
            </TabsList>
            
            <TabsContent value="prompts" className="space-y-6">
              {/* Prompts Overview */}
              <Card className="shadow-soft rounded-2xl border-0">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold text-lg">Prompts Overview</h4>
                      <p className="text-muted-foreground">
                        {filteredPrompts.length} prompt{filteredPrompts.length !== 1 ? 's' : ''} {searchQuery || filterStatus !== 'all' || filterCategory !== 'all' ? 'matching filters' : 'configured'}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-primary">
                          {filteredPrompts.filter(p => p.active).length}
                        </div>
                        <div className="text-xs text-muted-foreground">Active</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-muted-foreground">
                          {filteredPrompts.filter(p => !p.active).length}
                        </div>
                        <div className="text-xs text-muted-foreground">Paused</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Prompts Cards */}
              {filteredPrompts.length > 0 ? (
                <div className="space-y-6">
                  {filteredPrompts.map((prompt: any) => {
                    const isCollapsed = collapsedPrompts.has(prompt.id);
                    const isDeleting = deletingPrompts.has(prompt.id);
                    const category = getPromptCategory(prompt.text);
                    const visibilityScore = getVisibilityScore(prompt.id);
                    const sentimentScore = getSentimentScore(prompt.id);
                    const brandMentions = Math.floor(Math.random() * 15) + 5; // Mock data
                    const competitorMentions = Math.floor(Math.random() * 8) + 2; // Mock data
                    
                    return (
                      <Card key={prompt.id} className="shadow-soft rounded-2xl border-0 overflow-hidden">
                        <CardHeader className="pb-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-start gap-3 mb-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setCollapsedPrompts(prev => {
                                    const next = new Set(prev);
                                    if (next.has(prompt.id)) {
                                      next.delete(prompt.id);
                                    } else {
                                      next.add(prompt.id);
                                    }
                                    return next;
                                  })}
                                  className="p-1 h-auto hover:bg-muted/50 rounded-lg"
                                >
                                  {isCollapsed ? (
                                    <ChevronRight className="h-4 w-4" />
                                  ) : (
                                    <ChevronDown className="h-4 w-4" />
                                  )}
                                </Button>
                                <div className="flex-1">
                                  <h3 className="text-lg font-semibold text-foreground leading-tight">
                                    {prompt.text}
                                  </h3>
                                  <div className="flex items-center gap-2 mt-2">
                                    <Badge 
                                      variant="outline" 
                                      className={`text-xs ${getCategoryColor(category)}`}
                                    >
                                      {category}
                                    </Badge>
                                    <span className="text-xs text-muted-foreground">
                                      Created {new Date(prompt.created_at).toLocaleDateString()}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="flex items-center space-x-2">
                                <span className="text-sm text-muted-foreground">Active</span>
                                <Switch
                                  checked={prompt.active}
                                  onCheckedChange={(checked) => handleToggleActive(prompt.id, checked)}
                                />
                              </div>
                            </div>
                          </div>
                        </CardHeader>

                        <CardContent className="space-y-6">
                          {/* Provider Pills */}
                          <div className="flex flex-wrap gap-2">
                            {['openai', 'perplexity'].map(providerName => {
                              const hasResponse = Boolean(providerResponses[prompt.id]?.[providerName]?.response);
                              return (
                                <TooltipProvider key={providerName}>
                                  <Tooltip>
                                    <TooltipTrigger>
                                      <Badge 
                                        variant="outline" 
                                        className={`
                                          ${hasResponse 
                                            ? 'bg-success/10 text-success border-success/20' 
                                            : 'bg-muted/50 text-muted-foreground border-muted'
                                          }
                                          capitalize hover:scale-105 transition-transform cursor-help
                                        `}
                                      >
                                        {providerName === 'openai' ? '🤖' : '🔍'} {providerName}
                                      </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Last run: {hasResponse ? new Date(providerResponses[prompt.id][providerName].run_at).toLocaleString() : 'Never'}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              );
                            })}
                          </div>

                          {/* Performance Snapshot */}
                          <div className="bg-muted/20 rounded-xl p-4">
                            <h4 className="font-medium text-sm text-muted-foreground mb-3 uppercase tracking-wide">Performance Snapshot</h4>
                            <div className="grid grid-cols-3 gap-4">
                              <div className="text-center">
                                <div className="flex items-center justify-center mb-1">
                                  <Target className="h-4 w-4 text-primary mr-1" />
                                  <span className="text-lg font-bold text-primary">{brandMentions}%</span>
                                </div>
                                <div className="text-xs text-muted-foreground">Brand Mentions</div>
                              </div>
                              <div className="text-center">
                                <div className="flex items-center justify-center mb-1">
                                  <Users className="h-4 w-4 text-chart-5 mr-1" />
                                  <span className="text-lg font-bold text-chart-5">{competitorMentions}%</span>
                                </div>
                                <div className="text-xs text-muted-foreground">Competitor Mentions</div>
                              </div>
                              <div className="text-center">
                                <div className="flex items-center justify-center mb-1">
                                  <BarChart3 className="h-4 w-4 text-success mr-1" />
                                  <span className="text-lg font-bold text-success">{(sentimentScore * 100).toFixed(0)}%</span>
                                </div>
                                <div className="text-xs text-muted-foreground">Sentiment Score</div>
                              </div>
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleRunNow(prompt.id)}
                              disabled={runningPrompts.has(prompt.id)}
                              className="bg-primary hover:bg-primary-hover text-primary-foreground shadow-soft"
                            >
                              <Play className="mr-2 h-3 w-3" />
                              {runningPrompts.has(prompt.id) ? 'Running...' : 'Run Now'}
                            </Button>
                            
                            {['openai', 'perplexity'].map(providerName => {
                              const hasResponse = Boolean(providerResponses[prompt.id]?.[providerName]?.response);
                              if (!hasResponse) return null;
                              return (
                                <Button
                                  key={providerName}
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleViewResponse(providerName, prompt.id)}
                                  className="text-xs bg-muted/50 hover:bg-muted"
                                >
                                  <Eye className="mr-1 h-3 w-3" />
                                  View {providerName}
                                </Button>
                              );
                            })}
                            
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-muted-foreground hover:text-foreground"
                            >
                              <Settings2 className="mr-2 h-3 w-3" />
                              Edit
                            </Button>
                            
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={isDeleting}
                                  className="text-error hover:text-error hover:bg-error/10 border-error/20"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent className="rounded-2xl">
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Prompt</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete this prompt? This will also remove all associated visibility results and cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDeletePrompt(prompt.id)}
                                    className="bg-error hover:bg-error/90 text-error-foreground"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>

                          {/* Expanded Content */}
                          {!isCollapsed && (
                            <div className="space-y-4 pt-4 border-t border-muted/30">
                              {/* Visibility Results */}
                              <PromptVisibilityResults 
                                promptId={prompt.id} 
                                refreshTrigger={runningPrompts.has(prompt.id) ? Date.now() : 0} 
                              />
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <Card className="shadow-soft rounded-2xl border-0">
                  <CardContent className="text-center py-12">
                    <Zap className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-foreground mb-2">No prompts found</h3>
                    <p className="text-muted-foreground mb-6">
                      {searchQuery || filterStatus !== 'all' || filterCategory !== 'all' 
                        ? 'Try adjusting your search or filters' 
                        : 'Add your first prompt to start monitoring your brand visibility in AI search results'
                      }
                    </p>
                    {(!searchQuery && filterStatus === 'all' && filterCategory === 'all') && (
                      <Button onClick={() => setIsAddModalOpen(true)}>
                        <Plus className="mr-2 h-4 w-4" />
                        Add Your First Prompt
                      </Button>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* AI Suggested Prompts Section */}
              <Card className="shadow-soft rounded-2xl border-0">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-accent" />
                        AI Suggested Prompts
                      </CardTitle>
                      <CardDescription>
                        {suggestedPrompts.length > 0 
                          ? "Recommended prompts to improve your search visibility"
                          : "Get AI-powered suggestions for prompts to track your brand visibility"}
                      </CardDescription>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleGenerateMoreSuggestions}
                      disabled={generatingsuggestions}
                      className="bg-accent/10 border-accent/30 hover:bg-accent/20 text-accent"
                    >
                      {generatingsuggestions ? (
                        <>
                          <Clock className="mr-2 h-4 w-4 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Sparkles className="mr-2 h-4 w-4" />
                          {suggestedPrompts.length > 0 ? 'Generate More' : 'Generate Suggestions'}
                        </>
                      )}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {suggestedPrompts.length > 0 ? (
                    <div className="space-y-4">
                      {suggestedPrompts.map((suggestion: any) => (
                        <div key={suggestion.id} className="border border-accent/20 rounded-xl p-4 bg-accent/5">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 space-y-2">
                              <div className="flex items-center gap-2">
                                {getSourceIcon(suggestion.source)}
                                <Badge variant="secondary" className="text-xs">
                                  {suggestion.source}
                                </Badge>
                              </div>
                              <p className="text-sm font-medium">{suggestion.text}</p>
                              <p className="text-xs text-muted-foreground">
                                Suggested {new Date(suggestion.created_at).toLocaleDateString()}
                              </p>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleAcceptSuggestion(suggestion.id)}
                                className="text-success hover:text-success hover:bg-success/10 border-success/20"
                              >
                                <Check className="mr-1 h-3 w-3" />
                                Accept
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDismissSuggestion(suggestion.id)}
                                className="text-muted-foreground hover:text-foreground hover:bg-muted/50"
                              >
                                <X className="mr-1 h-3 w-3" />
                                Dismiss
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Award className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-foreground mb-2">No suggestions yet</h3>
                      <p className="text-muted-foreground mb-4">
                        Click "Generate Suggestions" to get AI-powered prompt recommendations tailored to your brand and industry.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

            </TabsContent>

            <TabsContent value="keywords" className="space-y-6">
              <KeywordManagement />
            </TabsContent>
          </Tabs>

          {/* Raw Response Viewing Dialog */}
          <Dialog open={!!viewingResponse} onOpenChange={() => setViewingResponse(null)}>
            <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden rounded-2xl">
              <DialogHeader>
                <DialogTitle className="capitalize">
                  Full AI Response - {viewingResponse?.provider}
                </DialogTitle>
                <DialogDescription>
                  {viewingResponse?.runAt
                    ? `Response generated on ${new Date(viewingResponse.runAt).toLocaleString()}`
                    : `Complete AI response from ${viewingResponse?.provider}`}
                </DialogDescription>
              </DialogHeader>
              <div className="overflow-y-auto max-h-[60vh] bg-muted/30 p-4 rounded-xl">
                <pre className="text-sm whitespace-pre-wrap font-mono leading-relaxed">
                  {viewingResponse?.response || 'No response available'}
                </pre>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </Layout>
  );
}