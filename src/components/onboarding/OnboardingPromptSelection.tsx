import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Sparkles, 
  Clock, 
  Plus,
  Target,
  Users,
  Lightbulb,
  Zap,
  AlertCircle,
  ChevronRight
} from 'lucide-react';
import { generateSuggestionsNow } from '@/lib/suggestions/data';
import { useToast } from '@/hooks/use-toast';

interface Suggestion {
  id: string;
  text: string;
  source: string;
  created_at: string;
}

interface OnboardingPromptSelectionProps {
  onContinue: (selectedSuggestionIds: string[], manualPrompts: string[]) => void;
  onBack: () => void;
  isSubscribed: boolean;
}

export function OnboardingPromptSelection({ 
  onContinue, 
  onBack,
  isSubscribed 
}: OnboardingPromptSelectionProps) {
  const { toast } = useToast();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [manualPrompts, setManualPrompts] = useState<string[]>(['']);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    generateInitialSuggestions();
  }, []);

  const generateInitialSuggestions = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await generateSuggestionsNow();
      
      if (result.suggestions && result.suggestions.length > 0) {
        setSuggestions(result.suggestions);
        // Pre-select all suggestions by default
        const allIds = new Set<string>(result.suggestions.map((s: Suggestion) => s.id));
        setSelectedIds(allIds);
        
        toast({
          title: "Suggestions Generated!",
          description: `${result.suggestions.length} prompts ready to track`,
        });
      } else {
        setError('No suggestions generated. You can add custom prompts below.');
      }
    } catch (err: any) {
      console.error('Generation error:', err);
      setError(err.message || 'Failed to generate suggestions');
      toast({
        title: "Generation Error",
        description: err.message || "Failed to generate suggestions. You can add custom prompts.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateMore = async () => {
    setGenerating(true);
    try {
      const result = await generateSuggestionsNow();
      
      if (result.suggestions && result.suggestions.length > 0) {
        // Add new suggestions to existing ones
        const newSuggestions = result.suggestions.filter(
          (newSug: Suggestion) => !suggestions.some(existing => existing.id === newSug.id)
        );
        
        if (newSuggestions.length > 0) {
          setSuggestions([...suggestions, ...newSuggestions]);
          // Auto-select new suggestions
          const newIds = new Set(selectedIds);
          newSuggestions.forEach((s: Suggestion) => newIds.add(s.id));
          setSelectedIds(newIds);
          
          toast({
            title: "More Suggestions Generated!",
            description: `Added ${newSuggestions.length} new prompts`,
          });
        } else {
          toast({
            title: "No New Suggestions",
            description: "All available suggestions have been generated",
          });
        }
      }
    } catch (err: any) {
      toast({
        title: "Generation Error",
        description: err.message || "Failed to generate more suggestions",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const addManualPromptField = () => {
    setManualPrompts([...manualPrompts, '']);
  };

  const updateManualPrompt = (index: number, value: string) => {
    const updated = [...manualPrompts];
    updated[index] = value;
    setManualPrompts(updated);
  };

  const removeManualPrompt = (index: number) => {
    setManualPrompts(manualPrompts.filter((_, i) => i !== index));
  };

  const handleContinue = () => {
    const validManual = manualPrompts.filter(p => p.trim().length > 0);
    const totalPrompts = selectedIds.size + validManual.length;
    
    if (totalPrompts === 0) {
      toast({
        title: "No Prompts Selected",
        description: "Please select at least one suggestion or add a custom prompt",
        variant: "destructive",
      });
      return;
    }

    onContinue(Array.from(selectedIds), validManual);
  };

  const getSourceIcon = (source: string) => {
    const category = source.startsWith('enhanced-ai-') ? source.substring(12) : source;
    switch (category) {
      case 'market_research':
      case 'industry':
      case 'gap-analysis': return <Lightbulb className="h-4 w-4 text-warning" />;
      case 'competitor_analysis':
      case 'competitors': return <Users className="h-4 w-4 text-secondary" />;
      default: return <Target className="h-4 w-4 text-primary" />;
    }
  };

  const getSourceColor = (source: string) => {
    const category = source.startsWith('enhanced-ai-') ? source.substring(12) : source;
    switch (category) {
      case 'market_research':
      case 'industry': return 'bg-warning/10 text-warning border-warning/20';
      case 'competitor_analysis':
      case 'competitors': return 'bg-secondary/10 text-secondary border-secondary/20';
      default: return 'bg-primary/10 text-primary border-primary/20';
    }
  };

  const getSourceDisplayName = (source: string) => {
    const category = source.startsWith('enhanced-ai-') ? source.substring(12) : source;
    switch (category) {
      case 'market_research': return 'Market Research';
      case 'competitor_analysis': return 'Competitor Analysis';
      case 'industry': return 'Industry';
      case 'gap-analysis': return 'Gap Analysis';
      default: return source.charAt(0).toUpperCase() + source.slice(1);
    }
  };

  const totalSelected = selectedIds.size + manualPrompts.filter(p => p.trim()).length;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-4xl" aria-labelledby="onboarding-prompt-setup">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <Sparkles className="h-6 w-6 text-accent" />
                Set Up Your Prompt Tracking
              </CardTitle>
              <CardDescription className="mt-2">
                Select AI-generated prompts and/or add your own to start monitoring your visibility
              </CardDescription>
              <meta name="description" content="Onboarding prompt tracking setup - select AI-generated suggestions or add custom prompts." />
              <link rel="canonical" href="/onboarding/prompts" />
            </div>
            {loading && (
              <Clock className="h-5 w-5 animate-spin text-muted-foreground" />
            )}
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Info Alert */}
          <Alert className="border-primary/20 bg-primary/5">
            <Zap className="h-4 w-4 text-primary" />
            <AlertDescription className="text-sm">
              <strong>Quick tip:</strong> These prompts will be tracked daily across multiple AI platforms. 
              You can always add, edit, or remove prompts later.
            </AlertDescription>
          </Alert>

          {/* Error State */}
          {error && !loading && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Loading State */}
          {loading ? (
            <div className="space-y-4">
              <div className="text-center py-8">
                <Clock className="h-12 w-12 animate-spin text-accent mx-auto mb-4" />
                <p className="text-muted-foreground">Generating personalized prompt suggestions...</p>
              </div>
            </div>
          ) : (
            <>
              {/* AI Suggestions */}
              {suggestions.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">AI-Generated Suggestions</h3>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleGenerateMore}
                      disabled={generating}
                    >
                      {generating ? (
                        <>
                          <Clock className="mr-2 h-4 w-4 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Sparkles className="mr-2 h-4 w-4" />
                          Generate More
                        </>
                      )}
                    </Button>
                  </div>

                  <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                    {suggestions.map((suggestion) => (
                      <div
                        key={suggestion.id}
                        className={`p-4 border rounded-lg cursor-pointer transition-all ${
                          selectedIds.has(suggestion.id)
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/50'
                        }`}
                        onClick={() => toggleSelection(suggestion.id)}
                      >
                        <div className="flex items-start gap-3">
                          <Checkbox
                            checked={selectedIds.has(suggestion.id)}
                            onCheckedChange={() => toggleSelection(suggestion.id)}
                            className="mt-1"
                          />
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2">
                              {getSourceIcon(suggestion.source)}
                              <Badge 
                                variant="outline" 
                                className={`text-xs ${getSourceColor(suggestion.source)}`}
                              >
                                {getSourceDisplayName(suggestion.source)}
                              </Badge>
                            </div>
                            <p className="text-sm font-medium">{suggestion.text}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Manual Prompts */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Add Custom Prompts</h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={addManualPromptField}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Another
                  </Button>
                </div>

                <div className="space-y-3">
                  {manualPrompts.map((prompt, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        placeholder="e.g., best project management software for teams"
                        value={prompt}
                        onChange={(e) => updateManualPrompt(index, e.target.value)}
                        className="flex-1"
                      />
                      {manualPrompts.length > 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeManualPrompt(index)}
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Selection Summary */}
              <div className="bg-muted/50 p-4 rounded-lg border">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Selected Prompts</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {totalSelected} prompt{totalSelected !== 1 ? 's' : ''} will be activated
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-primary">{totalSelected}</p>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={onBack}
                  className="flex-1"
                >
                  Back
                </Button>
                <Button
                  onClick={handleContinue}
                  disabled={totalSelected === 0}
                  className="flex-1 bg-primary hover:bg-primary/90"
                >
                  Continue
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
