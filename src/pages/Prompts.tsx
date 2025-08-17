import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { getSafePromptsData } from '@/lib/prompts/safe-data';
import { runPromptNow } from '../../lib/prompts/data';
import { getSuggestedPrompts, acceptSuggestion, dismissSuggestion, generateSuggestionsNow } from '@/lib/suggestions/data';
import { useToast } from '@/hooks/use-toast';
import { PromptList } from '@/components/PromptList';
import { KeywordManagement } from '@/components/KeywordManagement';
import { AlertCircle } from 'lucide-react';

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
    visibilityScore: Math.random() * 10, // Mock data - replace with actual score
    brandPct: Math.floor(Math.random() * 30) + 10, // Mock data
    competitorPct: Math.floor(Math.random() * 15) + 5, // Mock data
    sentimentDelta: (Math.random() - 0.5) * 0.4, // Mock data between -0.2 and +0.2
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newPromptText, setNewPromptText] = useState('');
  const [runningPrompts, setRunningPrompts] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (orgData?.organizations?.id) {
      loadPromptsData();
    }
  }, [orgData]);

  const loadPromptsData = async () => {
    try {
      setLoading(true);
      const data = await getSafePromptsData();
      setRawPrompts(data);
      setError(null);
    } catch (err: any) {
      setError(err?.message || 'Failed to load prompts');
    } finally {
      setLoading(false);
    }
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

  const handleRunPrompt = async (promptId: string) => {
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

  const handleRunMultiple = async (promptIds: string[]) => {
    if (!orgData?.organizations?.id) return;

    const activePromptIds = promptIds.filter(id => {
      const prompt = rawPrompts.find(p => p.id === id);
      return prompt?.active;
    });

    if (activePromptIds.length === 0) {
      toast({
        title: "Warning",
        description: "No active prompts selected to run",
        variant: "destructive",
      });
      return;
    }

    setRunningPrompts(new Set(activePromptIds));

    let successCount = 0;
    let errorCount = 0;

    // Run prompts sequentially to avoid rate limits
    for (const promptId of activePromptIds) {
      try {
        await runPromptNow(promptId, orgData.organizations.id);
        successCount++;
      } catch (error) {
        console.error(`Error running prompt ${promptId}:`, error);
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
        description: "All selected prompts failed to execute",
        variant: "destructive",
      });
    }

    setRunningPrompts(new Set());
    loadPromptsData();
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
            <div className="space-y-2">
              <h1 className="text-4xl font-display font-bold text-gray-900">Prompts</h1>
              <p className="text-lg text-gray-600">
                Manage search prompts and discover AI-suggested improvements
              </p>
            </div>

            <Tabs defaultValue="prompts" className="w-full">
              <TabsList className="grid w-full grid-cols-2 rounded-2xl bg-white shadow-soft p-1 border border-gray-100">
                <TabsTrigger value="prompts" className="rounded-xl">My Prompts</TabsTrigger>
                <TabsTrigger value="keywords" className="rounded-xl">Business Context</TabsTrigger>
              </TabsList>
              
              <TabsContent value="prompts" className="mt-6">
                <PromptList
                  prompts={transformedPrompts}
                  loading={loading}
                  onToggleActive={handleToggleActive}
                  onRunPrompt={handleRunPrompt}
                  onRunMultiple={handleRunMultiple}
                  onDeletePrompt={handleDeletePrompt}
                  onDeleteMultiple={handleDeleteMultiple}
                  onEditPrompt={handleEditPrompt}
                  onDuplicatePrompt={handleDuplicatePrompt}
                  onAddPrompt={() => setIsAddModalOpen(true)}
                  runningPrompts={runningPrompts}
                />
              </TabsContent>

              <TabsContent value="keywords" className="mt-6">
                <KeywordManagement />
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