import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { useSubscriptionGate } from '@/hooks/useSubscriptionGate';
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
import { AlertCircle } from 'lucide-react';

// Transform the existing prompt data to match the PromptList interface
const transformPromptData = (prompts: any[], promptDetails: any[]) => {
  return prompts.map(prompt => {
    // Find the corresponding detailed data for this prompt
    const details = promptDetails.find(d => d.promptId === prompt.id);
    
    // Calculate 7-day runs - count responses from last 7 days
    let runs_7d = 0;
    let avg_score_7d = 0;
    let scoreCount = 0;
    
    if (details) {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      
      Object.values(details.providers).forEach((provider: any) => {
        if (provider && provider.status === 'success') {
          const runDate = new Date(provider.run_at);
          if (runDate >= sevenDaysAgo) {
            runs_7d++;
            avg_score_7d += provider.score;
            scoreCount++;
          }
        }
      });
      
      // Calculate average score for 7 days
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
    };
  });
};

const getPromptCategory = (text: string) => {
  const lowerText = text.toLowerCase();
  if (lowerText.includes('brand') || lowerText.includes('company')) return 'Brand Visibility';
  if (lowerText.includes('competitor') || lowerText.includes('vs') || lowerText.includes('alternative')) return 'Competitor Monitoring';
  if (lowerText.includes('content') || lowerText.includes('blog') || lowerText.includes('article')) return 'Content Optimization';
  return 'Brand Visibility'; // Default category
};

export default function Prompts() {
  const { orgData, user } = useAuth();
  const { toast } = useToast();
  const { canCreatePrompts, hasAccessToApp } = useSubscriptionGate();
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
  const [showGlobalBatchDialog, setShowGlobalBatchDialog] = useState(false);
  const [globalBatchOptions, setGlobalBatchOptions] = useState({
    replace: false,
    preflight: false
  });

  useEffect(() => {
    if (orgData?.organizations?.id) {
      loadPromptsData();
      loadSuggestedPrompts();
      
      // No auto-refresh to prevent constant page refreshes
      // Users can manually refresh using the "Refresh Data" button
    }
  }, [orgData?.organizations?.id]);

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
      
      // Debug authentication
      console.log('🔍 Debug: Loading prompts data...');
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      console.log('🔍 Debug: Current auth user:', user?.id, userError);
      
      if (!user) {
        throw new Error('Not authenticated - please sign in again');
      }
      
      // Check if user exists in users table
      const { data: userData, error: userDbError } = await supabase
        .from('users')
        .select('id, org_id, email')
        .eq('id', user.id)
        .single();
      
      console.log('🔍 Debug: User in database:', userData, userDbError);
      
      if (userDbError || !userData) {
        throw new Error('User profile not found - please complete onboarding');
      }
      
      // Force fresh load on first page visit to bypass any stale cache
      const isFirstLoad = !rawPrompts.length;
      const unifiedData = await getUnifiedPromptData(!isFirstLoad);
      console.log('🔍 Debug: Unified data received:', {
        promptsCount: unifiedData.prompts?.length || 0,
        detailsCount: unifiedData.promptDetails?.length || 0
      });
      
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
    } catch (err: any) {
      setError(err?.message || 'Failed to load prompts');
    } finally {
      setLoading(false);
    }
  };

  // Refresh prompts data when returning from other tabs or manual refresh
  const refreshPromptsData = async () => {
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

    // Check billing limits before adding prompt
    const canCreate = canCreatePrompts(rawPrompts.length);
    if (!canCreate.hasAccess) {
      toast({ 
        title: 'Subscription Required', 
        description: canCreate.reason, 
        variant: 'destructive' 
      });
      return;
    }

    if (!orgData?.organizations?.id) return;

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

  // Check if user is test user for debug tools access
  const isTestUser = user?.email === 'abouraa.chri@gmail.com';
  
  // Check if user is admin for global batch processing
  const isAdmin = user?.email === 'abouraa.chri@gmail.com' || user?.email === 'amirdt22@gmail.com';

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
              <Button onClick={() => window.location.reload()} className="hover-lift">
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
                  <h1 className="text-4xl font-display font-bold gradient-primary bg-clip-text text-transparent">Prompts</h1>
                  <p className="text-lg text-muted-foreground">
                    Manage search prompts and discover smart improvements
                  </p>
                </div>
                <div className="flex gap-3">
                  {isAdmin && (
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
