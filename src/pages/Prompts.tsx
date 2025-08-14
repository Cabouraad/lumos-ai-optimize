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
import { supabase } from '@/integrations/supabase/client';
import { getSafePromptsData } from '@/lib/prompts/safe-data';
import { runPromptNow } from '../../lib/prompts/data';
import { getSuggestedPrompts, acceptSuggestion, dismissSuggestion, generateSuggestionsNow } from '@/lib/suggestions/data';
import { useToast } from '@/hooks/use-toast';
import { Plus, Play, CheckCircle, XCircle, Clock, Lightbulb, Check, X, Sparkles } from 'lucide-react';
import { KeywordManagement } from '@/components/KeywordManagement';

export default function Prompts() {
  const { orgData } = useAuth();
  const { toast } = useToast();
  const [prompts, setPrompts] = useState<any[]>([]);
  const [suggestedPrompts, setSuggestedPrompts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [generatingsuggestions, setGeneratingSuggestions] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newPromptText, setNewPromptText] = useState('');
  const [runningPrompts, setRunningPrompts] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (orgData?.organizations?.id) {
      loadPromptsData();
      loadSuggestedPrompts();
    }
  }, [orgData]);

  const loadPromptsData = async () => {
    try {
      const data = await getSafePromptsData();
      setPrompts(data);
      setError(null);
    } catch (err) {
      setError(err?.message || 'Failed to load prompts');
    } finally {
      setLoading(false);
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
      case 'industry': return <Lightbulb className="h-4 w-4 text-blue-500" />;
      case 'competitors': return <CheckCircle className="h-4 w-4 text-purple-500" />;
      case 'gap': return <XCircle className="h-4 w-4 text-orange-500" />;
      default: return <Sparkles className="h-4 w-4 text-green-500" />;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error': return <XCircle className="h-4 w-4 text-red-500" />;
      case 'timeout': return <Clock className="h-4 w-4 text-yellow-500" />;
      default: return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Prompts</h1>
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Prompts</h1>
            <div className="mt-4 p-4 bg-destructive/10 text-destructive rounded-lg">
              {error}
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Prompts</h1>
            <p className="text-muted-foreground">
              Manage your search prompts and discover AI-suggested improvements.
            </p>
          </div>
          
          <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Prompt
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Prompt</DialogTitle>
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

        <Tabs defaultValue="prompts" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="prompts">My Prompts</TabsTrigger>
            <TabsTrigger value="keywords">Business Context</TabsTrigger>
          </TabsList>
          
          <TabsContent value="prompts" className="space-y-6">
            {/* Prompts summary */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">Prompts Overview</h4>
                    <p className="text-sm text-muted-foreground">
                      {prompts.length} prompt{prompts.length !== 1 ? 's' : ''} configured
                    </p>
                  </div>
                  <Badge variant="secondary">
                    {prompts.filter(p => p.active).length} active
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Your Tracked Prompts Section - Now shown first */}
            <Card className="border-primary/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Play className="h-5 w-5 text-primary" />
                  Your Tracked Prompts
                </CardTitle>
                <CardDescription>
                  Monitor your brand visibility across these search queries. Use "Run Now" for real-time visibility analysis.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {prompts.length > 0 ? (
                  <div className="space-y-4">
                    {prompts.map((prompt: any) => (
                      <div key={prompt.id} className="border-2 border-primary/20 rounded-lg p-4 space-y-3 bg-primary/5">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-foreground">{prompt.text}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Created {new Date(prompt.created_at).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="flex items-center space-x-3">
                            <div className="flex items-center space-x-2">
                              <span className="text-xs text-muted-foreground">Active</span>
                              <Switch
                                checked={prompt.active}
                                onCheckedChange={(checked) => handleToggleActive(prompt.id, checked)}
                              />
                            </div>
                            <Button
                              size="sm"
                              onClick={() => handleRunNow(prompt.id)}
                              disabled={runningPrompts.has(prompt.id)}
                              className="bg-primary hover:bg-primary/90 text-primary-foreground"
                            >
                              <Play className="mr-1 h-3 w-3" />
                              {runningPrompts.has(prompt.id) ? 'Running...' : 'Run Now'}
                            </Button>
                          </div>
                        </div>

                        {/* Provider status with enhanced styling */}
                        <div className="grid gap-3 md:grid-cols-2">
                          {['openai', 'perplexity'].map(providerName => (
                            <div key={providerName} className="flex items-center justify-between p-3 bg-background rounded-md border">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                <span className="text-sm font-medium capitalize">{providerName}</span>
                              </div>
                              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                Ready
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <Play className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-foreground mb-2">No prompts tracked yet</h3>
                    <p className="text-muted-foreground mb-4">
                      Add your first prompt to start monitoring your brand visibility in AI search results.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* AI Suggested Prompts Section - Now shown after tracked prompts */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-primary" />
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
                  <div className="space-y-3">
                    {suggestedPrompts.map((suggestion: any) => (
                      <div key={suggestion.id} className="border border-primary/20 rounded-lg p-4 bg-primary/5">
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
                              className="text-green-600 hover:text-green-700 hover:bg-green-50"
                            >
                              <Check className="mr-1 h-3 w-3" />
                              Accept
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDismissSuggestion(suggestion.id)}
                              className="text-gray-600 hover:text-gray-700 hover:bg-gray-50"
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
                    <Sparkles className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
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
      </div>
    </Layout>
  );
}