import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { getPromptsWithScores } from '@/lib/prompts/data-with-scores';
import { getPromptsWithProviderData } from '@/lib/prompts/provider-data';
import { getSuggestedPrompts, acceptSuggestion, dismissSuggestion, generateSuggestionsNow } from '@/lib/suggestions/data';
import { PromptList } from '@/components/PromptList';
import { KeywordManagement } from '@/components/KeywordManagement';
import { AIPromptSuggestions } from '@/components/AIPromptSuggestions';
import TestSchedulerAPIs from '@/components/TestSchedulerAPIs';
import { AlertCircle } from 'lucide-react';
import { ProviderDebugPanel } from '@/components/ProviderDebugPanel';

// Transform the existing prompt data to match the PromptList interface
const transformPromptData = (prompts: any[]) => {
  return prompts.map(prompt => ({
    id: prompt.id,
    text: prompt.text,
    createdAt: prompt.created_at,
    category: getPromptCategory(prompt.text),
    providers: [
      { name: 'openai', enabled: true, lastRun: prompt.created_at },
      { name: 'perplexity', enabled: true, lastRun: prompt.created_at },
    ],
    lastRunAt: prompt.created_at,
    visibilityScore: prompt.visibilityScore, // Use actual data from database
    brandPct: prompt.brandPct, // Use actual data from database
    competitorPct: prompt.competitorPct, // Use actual data from database
    sentimentDelta: 0, // Start at 0 until we have actual sentiment data
    active: prompt.active,
  }));
};

const getPromptCategory = (text: string) => {
  const lowerText = text.toLowerCase();
  if (lowerText.includes('brand') || lowerText.includes('company')) return 'Brand Visibility';
  if (lowerText.includes('competitor') || lowerText.includes('vs') || lowerText.includes('alternative')) return 'Competitor Monitoring';
  if (lowerText.includes('content') || lowerText.includes('blog') || lowerText.includes('article')) return 'Content Optimization';
  return 'Brand Visibility'; // Default category
};

export default function Prompts() {
  const { orgData } = useAuth();
  const { toast } = useToast();
  const [rawPrompts, setRawPrompts] = useState<any[]>([]);
  const [providerData, setProviderData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newPromptText, setNewPromptText] = useState('');
  
  // AI Suggestions state
  const [suggestedPrompts, setSuggestedPrompts] = useState<any[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [generatingSuggestions, setGeneratingSuggestions] = useState(false);

  useEffect(() => {
    if (orgData?.organizations?.id) {
      loadPromptsData();
      loadSuggestedPrompts();
    }
  }, [orgData]);

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

  const loadPromptsData = async () => {
    try {
      setLoading(true);
      const [basicData, detailedData] = await Promise.all([
        getPromptsWithScores(),
        getPromptsWithProviderData(),
      ]);
      setRawPrompts(basicData);
      setProviderData(detailedData);
      setError(null);
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

  // Transform data for the PromptList component
  const transformedPrompts = transformPromptData(rawPrompts);

  if (error) {
    return (
      <Layout>
        <div className="min-h-screen bg-gray-50 p-6">
          <div className="max-w-7xl mx-auto">
            <div className="text-center py-12">
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h1 className="text-2xl font-semibold mb-2">Unable to Load Prompts</h1>
              <p className="text-gray-600 mb-6">{error}</p>
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
      <div className="min-h-screen bg-gray-50">
        <div className="p-6">
          <div className="max-w-7xl mx-auto space-y-8">
            {/* Header */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <h1 className="text-4xl font-display font-bold text-gray-900">Prompts</h1>
                  <p className="text-lg text-gray-600">
                    Manage search prompts and discover AI-suggested improvements
                  </p>
                </div>
                <Button 
                  onClick={refreshPromptsData}
                  variant="outline"
                  className="rounded-xl"
                >
                  Refresh Data
                </Button>
              </div>
              
              {/* Scheduler Status */}
              <div className="max-w-md">
                <div className="bg-primary/5 border border-primary/10 rounded-2xl p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
                    <div className="text-sm">
                      <div className="font-medium text-primary">Automated daily runs at 3:00 AM ET</div>
                      <div className="text-muted-foreground text-xs mt-1">All active prompts run automatically</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <Tabs defaultValue="prompts" className="w-full">
              <TabsList className="grid w-full grid-cols-4 rounded-2xl bg-white shadow-soft p-1 border border-gray-100">
                <TabsTrigger value="prompts" className="rounded-xl">My Prompts</TabsTrigger>
                <TabsTrigger value="suggestions" className="rounded-xl">AI Suggestions</TabsTrigger>
                <TabsTrigger value="keywords" className="rounded-xl">Business Context</TabsTrigger>
                <TabsTrigger value="debug" className="rounded-xl">Debug Tools</TabsTrigger>
              </TabsList>
              
              <TabsContent value="prompts" className="mt-6">
                <PromptList
                  prompts={transformedPrompts}
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
                <AIPromptSuggestions
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

              <TabsContent value="debug" className="mt-6">
                {rawPrompts.length > 0 && orgData?.organizations?.id ? (
                  <div className="space-y-6">
                    <div className="text-center">
                      <h3 className="text-lg font-semibold mb-2">Debug Tools</h3>
                      <p className="text-muted-foreground">Test individual prompts across all providers and view raw responses</p>
                    </div>
                    
                    {rawPrompts.slice(0, 3).map((prompt) => (
                      <div key={prompt.id} className="space-y-4">
                        <div className="p-4 bg-muted rounded-lg">
                          <h4 className="font-medium mb-2">Test Prompt: {prompt.text.substring(0, 100)}...</h4>
                          <ProviderDebugPanel 
                            promptId={prompt.id}
                            promptText={prompt.text}
                            orgId={orgData.organizations.id}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">Add some prompts to use debug tools</p>
                  </div>
                )}
              </TabsContent>
            </Tabs>

            {/* Add Prompt Dialog */}
            <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
              <DialogContent className="rounded-2xl max-w-md">
                <DialogHeader>
                  <DialogTitle className="text-xl">Add New Prompt</DialogTitle>
                  <DialogDescription>
                    Create a new prompt to monitor your brand visibility
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="prompt-text">Prompt Text</Label>
                    <Textarea
                      id="prompt-text"
                      placeholder="e.g., What are the best project management tools?"
                      value={newPromptText}
                      onChange={(e) => setNewPromptText(e.target.value)}
                      rows={4}
                      className="rounded-xl resize-none"
                    />
                  </div>
                  <div className="flex justify-end space-x-2">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setIsAddModalOpen(false)}
                      className="rounded-xl"
                    >
                      Cancel
                    </Button>
                    <Button 
                      onClick={handleAddPrompt} 
                      disabled={!newPromptText.trim()}
                      className="rounded-xl bg-primary hover:bg-primary-hover"
                    >
                      Add Prompt
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>
    </Layout>
  );
}
