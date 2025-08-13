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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { getPromptsData, runPromptNow } from '../../lib/prompts/data';
import { useToast } from '@/hooks/use-toast';
import { Plus, Play, CheckCircle, XCircle, Clock } from 'lucide-react';

export default function Prompts() {
  const { orgData } = useAuth();
  const { toast } = useToast();
  const [promptsData, setPromptsData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newPromptText, setNewPromptText] = useState('');
  const [runningPrompts, setRunningPrompts] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (orgData?.organizations?.id) {
      loadPromptsData();
    }
  }, [orgData]);

  const loadPromptsData = async () => {
    if (!orgData?.organizations?.id) return;
    
    try {
      const data = await getPromptsData(orgData.organizations.id, orgData.organizations.plan_tier);
      setPromptsData(data);
    } catch (error) {
      console.error('Error loading prompts:', error);
    } finally {
      setLoading(false);
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

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Prompts</h1>
            <p className="text-muted-foreground">
              Manage and monitor your AI search prompts
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

        {/* Usage indicator */}
        {promptsData && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">Daily Usage</h4>
                  <p className="text-sm text-muted-foreground">
                    {promptsData.usage} / {promptsData.quota} prompts used today
                  </p>
                </div>
                <div className="w-32 bg-muted rounded-full h-2">
                  <div 
                    className="bg-primary h-2 rounded-full" 
                    style={{ width: `${Math.min(100, (promptsData.usage / promptsData.quota) * 100)}%` }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Your Prompts</CardTitle>
            <CardDescription>
              Track how your brand appears in AI search results
            </CardDescription>
          </CardHeader>
          <CardContent>
            {promptsData?.prompts.length > 0 ? (
              <div className="space-y-4">
                {promptsData.prompts.map((prompt: any) => (
                  <div key={prompt.id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-medium">{prompt.text}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Created {new Date(prompt.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch
                          checked={prompt.active}
                          onCheckedChange={(checked) => handleToggleActive(prompt.id, checked)}
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRunNow(prompt.id)}
                          disabled={runningPrompts.has(prompt.id)}
                        >
                          <Play className="mr-1 h-3 w-3" />
                          {runningPrompts.has(prompt.id) ? 'Running...' : 'Run Now'}
                        </Button>
                      </div>
                    </div>

                    {/* Provider results */}
                    <div className="grid gap-2 md:grid-cols-2">
                      {['openai', 'perplexity'].map(providerName => {
                        const runs = Object.values(promptsData.latestRuns).filter((run: any) => 
                          run.prompt_id === prompt.id && run.llm_providers?.name === providerName
                        );
                        const latestRun = runs[0] as any;

                        return (
                          <div key={providerName} className="flex items-center justify-between p-2 bg-muted rounded">
                            <div className="flex items-center space-x-2">
                              <span className="text-sm font-medium capitalize">{providerName}</span>
                              {latestRun && getStatusIcon(latestRun.status)}
                            </div>
                            {latestRun?.visibility_results?.[0] && (
                              <Badge variant="secondary">
                                Score: {latestRun.visibility_results[0].score}
                              </Badge>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No prompts created yet. Add your first prompt to start monitoring.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}