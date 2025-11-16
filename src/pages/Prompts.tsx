import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useSubscriptionGate } from '@/hooks/useSubscriptionGate';
import { useBrand } from '@/contexts/BrandContext';
import { UpgradePrompt } from '@/components/UpgradePrompt';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { getUnifiedPromptData, invalidateCache } from '@/lib/data/unified-fetcher';
import { getSuggestedPrompts, acceptSuggestion, dismissSuggestion, generateSuggestionsNow } from '@/lib/suggestions/data';
import { PromptList } from '@/components/PromptList';
import { KeywordManagement } from '@/components/KeywordManagement';
import { PromptSuggestions } from '@/components/PromptSuggestions';
import { BatchPromptRunner } from '@/components/BatchPromptRunner';
import { ProviderDebugPanel } from '@/components/ProviderDebugPanel';
import { DateRangePicker } from '@/components/DateRangePicker';
import { getPromptCategory } from '@/lib/prompt-utils';
import { useAdminAccess } from '@/hooks/useAdminAccess';
import { useClusterPrompts } from '@/hooks/useClusterPrompts';
import { AlertCircle, Sparkles } from 'lucide-react';

// Transform the existing prompt data to match the PromptList interface
const transformPromptData = (prompts: any[], promptDetails: any[]) => {
  return prompts.map(prompt => {
    // Find the corresponding detailed data for this prompt
    const details = promptDetails.find(d => d.promptId === prompt.id);
    
    // Calculate 30-day runs - count responses from last 30 days for rolling history
    let runs_7d = 0;
    let avg_score_7d = 0;
    let scoreCount = 0;
    
    if (details) {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      
      Object.values(details.providers).forEach((provider: any) => {
        if (provider && (provider.status === 'success' || provider.status === 'completed')) {
          const runDate = new Date(provider.run_at);
          if (runDate >= thirtyDaysAgo) {
            runs_7d++;
            avg_score_7d += provider.score;
            scoreCount++;
          }
        }
      });
      
      // Calculate average score for 30-day period
      if (scoreCount > 0) {
        avg_score_7d = avg_score_7d / scoreCount;
      } else {
        avg_score_7d = details.overallScore || 0;
      }
    }

    return {
      id: prompt.id,
      text: prompt.text,
      active: prompt.active,
      created_at: prompt.created_at,
      runs_7d: runs_7d,
      avg_score_7d: Math.round(avg_score_7d * 10) / 10,
      cluster_tag: prompt.cluster_tag,
    };
  });
};

// Categorization function moved to /lib/prompt-utils.ts

export default function Prompts() {
  const { orgData, user, ready } = useAuth();
  const { toast } = useToast();
  const { canCreatePrompts, hasAccessToApp, limits } = useSubscriptionGate();
  const { selectedBrand } = useBrand();
  const clusterPrompts = useClusterPrompts();
  const [rawPrompts, setRawPrompts] = useState<any[]>([]);
  const [providerData, setProviderData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newPromptText, setNewPromptText] = useState('');
  
  // Suggestions state
  const [suggestedPrompts, setSuggestedPrompts] = useState<any[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [generatingSuggestions, setGeneratingSuggestions] = useState(false);

  // Global batch processing state
  const [isRunningGlobalBatch, setIsRunningGlobalBatch] = useState(false);
  
  // Date range filtering state
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [showGlobalBatchDialog, setShowGlobalBatchDialog] = useState(false);
  const [globalBatchOptions, setGlobalBatchOptions] = useState({
    replace: false,
    preflight: false
  });

  useEffect(() => {
    // Wait for auth to be ready before loading data
    if (!ready) return;
    if (!user) {
      setLoading(false);
      return;
    }
    if (orgData?.organizations?.id) {
      loadPromptsData();
      loadSuggestedPrompts();
      
      // No auto-refresh to prevent constant page refreshes
      // Users can manually refresh using the "Refresh Data" button
    }
  }, [ready, user, orgData?.organizations?.id]);

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

  const loadPromptsData = async (showToast = false) => {
    try {
      setLoading(true);

      // Wait for auth to be ready before attempting to load data
      if (!ready || !user) {
        console.log('🔍 Debug: Auth not ready, skipping prompts data load', { ready, hasUser: !!user });
        setError('Authentication required');
        return;
      }

      // Ensure org context is ready
      console.log('🔍 Debug: Loading prompts data with org context:', orgData?.organizations?.id);
      if (!orgData?.organizations?.id) {
        throw new Error('Onboarding incomplete: no org membership');
      }

      // Force fresh load on first page visit to bypass any stale cache
      const isFirstLoad = !rawPrompts.length;

      const attemptFetch = async () => {
        const unifiedData = await getUnifiedPromptData(!isFirstLoad, dateFrom, dateTo);
        
        // 🐛 DEBUG: Log detailed provider data received
        console.log('🔍 [Prompts] Unified data received:', {
          promptsCount: unifiedData.prompts?.length || 0,
          detailsCount: unifiedData.promptDetails?.length || 0,
          samplePromptDetail: unifiedData.promptDetails?.[0] ? {
            promptId: unifiedData.promptDetails[0].promptId,
            providers: Object.keys(unifiedData.promptDetails[0].providers),
            providersWithData: Object.entries(unifiedData.promptDetails[0].providers)
              .filter(([_, data]) => data !== null)
              .map(([provider]) => provider)
          } : 'No details'
        });
        
        // 🐛 DEBUG: Count provider responses across all prompts
        const providerCounts = unifiedData.promptDetails?.reduce((acc: any, detail: any) => {
          Object.entries(detail.providers).forEach(([provider, data]) => {
            if (data !== null) {
              acc[provider] = (acc[provider] || 0) + 1;
            }
          });
          return acc;
        }, {});
        console.log('🔍 [Prompts] Provider responses by type:', providerCounts);
        
        setRawPrompts(unifiedData.prompts);
        setProviderData(unifiedData.promptDetails);
        setError(null);

        if (showToast && unifiedData.promptDetails.length > 0) {
          const recentResponses = unifiedData.promptDetails.filter(prompt =>
            Object.values(prompt.providers).some(p =>
              p && new Date(p.run_at).getTime() > Date.now() - 5 * 60 * 1000 // Last 5 minutes
            )
          );

          if (recentResponses.length > 0) {
            toast({
              title: 'New visibility data available',
              description: `Updated ${recentResponses.length} prompt${recentResponses.length > 1 ? 's' : ''} with fresh provider responses`,
            });
          }
        }
      };

      try {
        await attemptFetch();
      } catch (innerErr: any) {
        const message = innerErr?.message || '';
        const shouldRetry = /auth|token|not authorized|Authentication required/i.test(message);
        if (shouldRetry) {
          console.warn('Auth transient error detected, retrying prompt load once...');
          await new Promise(res => setTimeout(res, 300));
          await attemptFetch();
        } else {
          throw innerErr;
        }
      }
    } catch (err: any) {
      const errorMessage = err?.message || 'Failed to load prompts';
      console.error('🔍 Debug: Prompts load error:', err);
      
      // Provide more specific error messages
      if (errorMessage.includes('Failed to fetch')) {
        setError('Network error: Unable to connect to server. Please check your internet connection and try again.');
      } else if (errorMessage.includes('CORS')) {
        setError('CORS error: Cross-origin request blocked. Please check browser console for details.');
      } else {
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  // Refresh prompts data when returning from other tabs or manual refresh
  const refreshPromptsData = async () => {
    // Invalidate cache to get fresh data
    invalidateCache(['prompts']);
    await loadPromptsData();
    toast({
      title: 'Prompts refreshed',
      description: 'Latest visibility data has been loaded.',
    });
  };

  const handleAddPrompt = async () => {
    if (!newPromptText.trim()) {
      toast({ title: 'Error', description: 'Prompt text is required', variant: 'destructive' });
      return;
    }

    // Check billing limits before adding prompt - count ACTIVE prompts only
    const activePromptsCount = rawPrompts.filter(p => p.active).length;
    const canCreate = canCreatePrompts(activePromptsCount);
    if (!canCreate.hasAccess) {
      toast({ 
        title: 'Subscription Limit Reached', 
        description: canCreate.reason, 
        variant: 'destructive' 
      });
      return;
    }

    if (!orgData?.organizations?.id) return;

    try {
      const insertData: any = {
        org_id: orgData.organizations.id,
        text: newPromptText.trim(),
        active: true
      };

      // Add brand_id if a brand is selected
      if (selectedBrand) {
        insertData.brand_id = selectedBrand.id;
      }

      const { error } = await supabase
        .from('prompts')
        .insert(insertData);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Prompt added successfully",
      });

      setNewPromptText('');
      setIsAddModalOpen(false);
      invalidateCache(['dashboard-data', 'prompt-data']);
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
    // If activating, check if we're at the limit
    if (active) {
      const activePromptsCount = rawPrompts.filter(p => p.active).length;
      const canCreate = canCreatePrompts(activePromptsCount);
      if (!canCreate.hasAccess) {
        toast({ 
          title: 'Subscription Limit Reached', 
          description: `You can only have ${limits.promptsPerDay} active prompts on your current plan. Please deactivate another prompt or upgrade your plan.`,
          variant: 'destructive' 
        });
        return;
      }
    }

    try {
      const { error } = await supabase
        .from('prompts')
        .update({ active })
        .eq('id', promptId);

      if (error) throw error;

      // Optimistic update
      setRawPrompts(prev => prev.map(p => p.id === promptId ? { ...p, active } : p));

      toast({
        title: "Success",
        description: `Prompt ${active ? 'enabled' : 'disabled'} successfully`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      // Revert on error
      loadPromptsData();
    }
  };


  const handleAcceptSuggestion = async (suggestionId: string) => {
    // Check billing limits before accepting suggestion (which creates an active prompt)
    const activePromptsCount = rawPrompts.filter(p => p.active).length;
    const canCreate = canCreatePrompts(activePromptsCount);
    if (!canCreate.hasAccess) {
      toast({ 
        title: 'Subscription Limit Reached', 
        description: `You can only have ${limits.promptsPerDay} active prompts on your current plan. Please deactivate a prompt or upgrade your plan.`,
        variant: 'destructive' 
      });
      return;
    }

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

  const handleDeletePrompt = async (promptId: string) => {
    if (!orgData?.organizations?.id) return;

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
    }
  };

  const handleDeleteMultiple = async (promptIds: string[]) => {
    if (!orgData?.organizations?.id) return;

    try {
      const { error } = await supabase
        .from('prompts')
        .delete()
        .in('id', promptIds)
        .eq('org_id', orgData.organizations.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: `${promptIds.length} prompt${promptIds.length !== 1 ? 's' : ''} deleted successfully`,
      });

      loadPromptsData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleEditPrompt = (promptId: string) => {
    // TODO: Implement edit functionality
    console.log('Edit prompt:', promptId);
  };

  const handleDuplicatePrompt = async (promptId: string) => {
    const prompt = rawPrompts.find(p => p.id === promptId);
    if (!prompt || !orgData?.organizations?.id) return;

    try {
      const { error } = await supabase
        .from('prompts')
        .insert({
          org_id: orgData.organizations.id,
          text: `${prompt.text} (Copy)`,
          active: false
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Prompt duplicated successfully",
      });

      loadPromptsData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleRunGlobalBatch = async (options = { replace: false, preflight: false }) => {
    setIsRunningGlobalBatch(true);
    try {
      console.log('🚀 Starting admin global batch processing...', options);
      
      const { data, error } = await supabase.functions.invoke('admin-batch-trigger', {
        body: options
      });

      if (error) {
        console.error('Function invoke error:', error);
        throw error;
      }

      console.log('✅ Admin batch result:', data);

      // Show detailed results
      const summary = data.summary;
      const successRate = summary.processedOrgs > 0 ? 
        Math.round((summary.successfulJobs / summary.processedOrgs) * 100) : 0;

      let description = '';
      if (options.preflight) {
        description = `Preflight completed: ${summary.totalOrgs} orgs, ${summary.totalPrompts} prompts, ${summary.totalExpectedTasks} expected tasks`;
      } else {
        description = `${data.message}\nSuccess rate: ${successRate}% (${summary.successfulJobs}/${summary.processedOrgs} organizations)\nTotal tasks: ${summary.totalExpectedTasks} | Providers: ${summary.providersUsed.join(', ')}`;
      }

      // Show warning if some orgs were skipped
      if (summary.skippedOrgs > 0) {
        const skippedResults = data.results.filter((r: any) => r.skipReason);
        const skipReasons = [...new Set(skippedResults.map((r: any) => r.skipReason))];
        description += `\n\nSkipped ${summary.skippedOrgs} orgs: ${skipReasons.join(', ')}`;
      }

      toast({
        title: options.preflight ? "Preflight Check Complete" : "Global Batch Processing Started",
        description,
        duration: 10000
      });

    } catch (error: any) {
      console.error('❌ Admin batch error:', error);
      
      // Handle specific error types
      let errorMessage = 'Failed to start global batch processing';
      if (error.message?.includes('404') || error.message?.includes('FunctionsFetchError')) {
        errorMessage = 'Admin batch function not found. Please ensure it is deployed.';
      } else if (error.message?.includes('Forbidden')) {
        errorMessage = 'Access denied. Admin privileges required.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsRunningGlobalBatch(false);
      setShowGlobalBatchDialog(false);
    }
  };


  // Transform data for the PromptList component
  const transformedPrompts = transformPromptData(rawPrompts, providerData);

  // Use role-based admin access
  const { isAdmin } = useAdminAccess();
  // Only allow specific admin email to access debug tools
  const isTestUser = isAdmin && user?.email === 'abouraa.chri@gmail.com';

  // Check app access first
  const appAccess = hasAccessToApp();
  if (!appAccess.hasAccess) {
    return (
      <Layout>
        <div className="container mx-auto p-6">
          <UpgradePrompt 
            feature="prompts management"
            reason={appAccess.reason}
            isTrialExpired={appAccess.isTrialExpired}
          />
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="min-h-screen bg-gradient-subtle p-6">
          <div className="max-w-7xl mx-auto">
            <div className="text-center py-12">
              <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
              <h1 className="text-2xl font-semibold mb-2 text-foreground">Unable to Load Prompts</h1>
              <p className="text-muted-foreground mb-6">{error}</p>
              <Button onClick={() => {
                setError(null);
                loadPromptsData();
              }} className="hover-lift">
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
      <div className="min-h-screen bg-gradient-subtle">
        <div className="p-6">
          <div className="max-w-7xl mx-auto space-y-8">
            {/* Header */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <h1 className="text-4xl font-display font-bold gradient-primary bg-clip-text text-transparent">Prompts</h1>
                  </div>
                  <p className="text-lg text-muted-foreground">
                    Manage search prompts and discover smart improvements
                  </p>
                </div>
                <div className="flex gap-3">
                  <Button 
                    onClick={() => clusterPrompts.mutate({ orgId: orgData?.organizations?.id || '' })}
                    disabled={clusterPrompts.isPending || !rawPrompts.length}
                    variant="outline"
                    className="rounded-xl hover-lift border-border/50 hover:border-primary/50 transition-smooth"
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    {clusterPrompts.isPending ? 'Clustering...' : 'Auto-Tag Prompts'}
                  </Button>
                  {isTestUser && (
                    <Button 
                      onClick={() => setShowGlobalBatchDialog(true)}
                      disabled={isRunningGlobalBatch}
                      variant="default"
                      className="rounded-xl hover-lift bg-gradient-primary text-white border-0 shadow-elegant hover:shadow-glow transition-smooth"
                    >
                      {isRunningGlobalBatch ? 'Processing...' : 'Run for all orgs'}
                    </Button>
                  )}
                  <Button 
                    onClick={refreshPromptsData}
                    variant="outline"
                    className="rounded-xl hover-lift border-border/50 hover:border-primary/50 transition-smooth"
                  >
                    Refresh Data
                  </Button>
                </div>
              </div>
              
              {/* Date Range Filter */}
              <div className="flex items-center gap-3">
                <DateRangePicker 
                  from={dateFrom}
                  to={dateTo}
                  onRangeChange={(from, to) => {
                    setDateFrom(from);
                    setDateTo(to);
                  }}
                />
                {(dateFrom || dateTo) && (
                  <div className="text-sm text-muted-foreground">
                    Showing historical data
                  </div>
                )}
              </div>
              
              {/* Scheduler Status */}
              <div className="max-w-md">
                <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-2xl p-4 shadow-soft">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-success animate-pulse shadow-glow" />
                    <div className="text-sm">
                      <div className="font-medium gradient-primary bg-clip-text text-transparent">All prompts automatically run daily</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <Tabs defaultValue="prompts" className="w-full">
              <TabsList className={`grid w-full ${isTestUser ? 'grid-cols-4' : 'grid-cols-3'} rounded-2xl bg-card/80 backdrop-blur-sm shadow-soft p-1 border border-border/50`}>
                <TabsTrigger value="prompts" className="rounded-xl transition-smooth hover-glow data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">My Prompts</TabsTrigger>
                <TabsTrigger value="suggestions" className="rounded-xl transition-smooth hover-glow data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Prompt Suggestions</TabsTrigger>
                <TabsTrigger value="keywords" className="rounded-xl transition-smooth hover-glow data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Business Context</TabsTrigger>
                {isTestUser && (
                  <TabsTrigger value="debug" className="rounded-xl transition-smooth hover-glow data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Debug Tools</TabsTrigger>
                )}
              </TabsList>
              
              <TabsContent value="prompts" className="mt-6">
                <PromptList
                  prompts={transformedPrompts}
                  providerData={providerData}
                  loading={loading}
                  onToggleActive={handleToggleActive}
                  onDeletePrompt={handleDeletePrompt}
                  onDeleteMultiple={handleDeleteMultiple}
                  onEditPrompt={handleEditPrompt}
                  onDuplicatePrompt={handleDuplicatePrompt}
                  onAddPrompt={() => setIsAddModalOpen(true)}
                />
              </TabsContent>

              <TabsContent value="suggestions" className="mt-6">
                <PromptSuggestions
                  suggestions={suggestedPrompts}
                  loading={suggestionsLoading}
                  generating={generatingSuggestions}
                  onAccept={handleAcceptSuggestion}
                  onDismiss={handleDismissSuggestion}
                  onGenerate={handleGenerateMoreSuggestions}
                  onSettingsUpdated={loadSuggestedPrompts}
                />
              </TabsContent>

              <TabsContent value="keywords" className="mt-6">
                <KeywordManagement />
              </TabsContent>

              {isTestUser && (
                <TabsContent value="debug" className="mt-6">
                  <div className="space-y-8">
                    <div className="text-center">
                      <h3 className="text-lg font-semibold mb-2 gradient-primary bg-clip-text text-transparent">Debug Tools</h3>
                      <p className="text-muted-foreground">
                        Test and analyze prompt responses across all providers
                      </p>
                    </div>
                    
                    {/* Batch Prompt Runner */}
                    <BatchPromptRunner />

                    {/* Provider Debug Panel */}
                    <ProviderDebugPanel />
                  </div>
                </TabsContent>
              )}
            </Tabs>

            {/* Add Prompt Dialog */}
            <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
              <DialogContent className="rounded-2xl max-w-md bg-card/95 backdrop-blur-sm border-border/50 shadow-elegant">
                <DialogHeader>
                  <DialogTitle className="text-xl gradient-primary bg-clip-text text-transparent">Add New Prompt</DialogTitle>
                  <DialogDescription className="text-muted-foreground">
                    Create a new prompt to monitor your brand visibility
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="prompt-text" className="text-foreground font-medium">Prompt Text</Label>
                    <Textarea
                      id="prompt-text"
                      placeholder="e.g., What are the best project management tools?"
                      value={newPromptText}
                      onChange={(e) => setNewPromptText(e.target.value)}
                      rows={4}
                      className="rounded-xl resize-none border-border/50 bg-background/50 backdrop-blur-sm focus:border-primary/50 transition-smooth"
                    />
                  </div>
                  <div className="flex justify-end space-x-2">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setIsAddModalOpen(false)}
                      className="rounded-xl hover-lift border-border/50 hover:border-primary/50 transition-smooth"
                    >
                      Cancel
                    </Button>
                    <Button 
                      onClick={handleAddPrompt} 
                      disabled={!newPromptText.trim()}
                      className="rounded-xl hover-lift shadow-glow transition-smooth"
                    >
                      Add Prompt
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            {/* Global Batch Processing Dialog */}
            <Dialog open={showGlobalBatchDialog} onOpenChange={setShowGlobalBatchDialog}>
              <DialogContent className="rounded-2xl max-w-md bg-card/95 backdrop-blur-sm border-border/50 shadow-elegant">
                <DialogHeader>
                  <DialogTitle className="text-xl gradient-primary bg-clip-text text-transparent">
                    Run Global Batch Processing
                  </DialogTitle>
                  <DialogDescription className="text-muted-foreground">
                    Execute batch processing for all organizations in the system. This will run all active prompts across enabled providers.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="replace-jobs"
                      checked={globalBatchOptions.replace}
                      onCheckedChange={(checked) => 
                        setGlobalBatchOptions(prev => ({ ...prev, replace: checked as boolean }))
                      }
                    />
                    <Label htmlFor="replace-jobs" className="text-sm">
                      Cancel existing jobs before starting new ones
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="preflight-only"
                      checked={globalBatchOptions.preflight}
                      onCheckedChange={(checked) => 
                        setGlobalBatchOptions(prev => ({ ...prev, preflight: checked as boolean }))
                      }
                    />
                    <Label htmlFor="preflight-only" className="text-sm">
                      Preflight check only (don't start actual batches)
                    </Label>
                  </div>
                  <div className="bg-muted/50 p-3 rounded-lg text-xs text-muted-foreground">
                    <strong>Note:</strong> This will process all organizations with active prompts. 
                    Use preflight mode to see what would be processed without starting actual jobs.
                  </div>
                </div>
                <div className="flex justify-end gap-3">
                  <Button 
                    variant="outline" 
                    onClick={() => setShowGlobalBatchDialog(false)}
                    disabled={isRunningGlobalBatch}
                  >
                    Cancel
                  </Button>
                  <Button 
                    onClick={() => handleRunGlobalBatch(globalBatchOptions)}
                    disabled={isRunningGlobalBatch}
                    className="bg-gradient-primary text-white border-0"
                  >
                    {isRunningGlobalBatch ? 'Processing...' : 
                     globalBatchOptions.preflight ? 'Run Preflight' : 'Start Batch Processing'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>
    </Layout>
  );
}
