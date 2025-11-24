import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Loader2, Sparkles, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

interface StarterPromptsSelectionProps {
  orgId: string;
  orgName: string;
}

const STARTER_PROMPTS = [
  "Top brands in {industry} for {use case}",
  "Best {product} for {audience}",
  "Which {brand} is recommended for {problem}?",
  "Top alternatives to {brand}",
  "{Brand} vs {Competitor} — which is better?",
  "Best rated {product category} brands",
  "Which brands do experts recommend for {topic}?",
  "Best affordable options for {product}",
  "Most reliable {product} brands",
  "What do AI tools recommend for {problem}?"
];

export function StarterPromptsSelection({ orgId, orgName }: StarterPromptsSelectionProps) {
  const [selectedPrompts, setSelectedPrompts] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleToggle = (index: number) => {
    setSelectedPrompts(prev => 
      prev.includes(index) 
        ? prev.filter(i => i !== index)
        : [...prev, index]
    );
  };

  const handleSelectAll = () => {
    if (selectedPrompts.length === STARTER_PROMPTS.length) {
      setSelectedPrompts([]);
    } else {
      setSelectedPrompts(STARTER_PROMPTS.map((_, i) => i));
    }
  };

  const handleSubmit = async () => {
    if (selectedPrompts.length === 0) {
      toast.error('Please select at least one prompt');
      return;
    }

    setLoading(true);
    try {
      // Insert selected prompts
      const promptsToInsert = selectedPrompts.map(index => ({
        org_id: orgId,
        text: STARTER_PROMPTS[index],
        active: true
      }));

      const { error: insertError } = await supabase
        .from('prompts')
        .insert(promptsToInsert);

      if (insertError) throw insertError;

      toast.success(`Added ${selectedPrompts.length} prompts to your account`);
      
      // Navigate to dashboard with a flag to trigger first scan
      navigate('/dashboard', { state: { runFirstScan: true } });
    } catch (error) {
      console.error('Error adding prompts:', error);
      toast.error('Failed to add prompts. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-subtle">
      <Card className="w-full max-w-3xl shadow-2xl border-2">
        <CardHeader className="text-center pb-6">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-gradient-to-br from-primary to-secondary rounded-full flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-primary-foreground" />
            </div>
          </div>
          <CardTitle className="text-3xl mb-2">Choose Your Starter Prompts</CardTitle>
          <CardDescription className="text-base">
            Select the prompts you want to track for <strong>{orgName}</strong>. You can add more later.
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <Badge variant="outline" className="text-sm">
              {selectedPrompts.length} of {STARTER_PROMPTS.length} selected
            </Badge>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={handleSelectAll}
            >
              {selectedPrompts.length === STARTER_PROMPTS.length ? 'Deselect All' : 'Select All'}
            </Button>
          </div>

          <div className="grid gap-3 max-h-96 overflow-y-auto pr-2">
            {STARTER_PROMPTS.map((prompt, index) => (
              <label
                key={index}
                className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                  selectedPrompts.includes(index)
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50 hover:bg-muted/50'
                }`}
              >
                <Checkbox
                  checked={selectedPrompts.includes(index)}
                  onCheckedChange={() => handleToggle(index)}
                  className="mt-0.5"
                />
                <div className="flex-1">
                  <p className="text-sm font-medium leading-relaxed">{prompt}</p>
                </div>
                {selectedPrompts.includes(index) && (
                  <CheckCircle className="w-5 h-5 text-primary flex-shrink-0" />
                )}
              </label>
            ))}
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => navigate('/dashboard')}
              disabled={loading}
            >
              Skip for Now
            </Button>
            <Button
              className="flex-1"
              onClick={handleSubmit}
              disabled={loading || selectedPrompts.length === 0}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Adding Prompts...
                </>
              ) : (
                `Add Selected Prompts & Continue`
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
