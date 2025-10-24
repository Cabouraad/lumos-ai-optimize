import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Plus, Info, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { getOrgId } from '@/lib/auth';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ManualCompetitorAddProps {
  onCompetitorAdded?: () => void;
}

export function ManualCompetitorAdd({ onCompetitorAdded }: ManualCompetitorAddProps) {
  const [competitorName, setCompetitorName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleAddCompetitor = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!competitorName.trim()) {
      toast({
        title: "Name required",
        description: "Please enter a competitor name.",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const orgId = await getOrgId();
      
      // Check 50-competitor limit
      const { data: competitorCount } = await supabase
        .from('brand_catalog')
        .select('id', { count: 'exact' })
        .eq('org_id', orgId)
        .eq('is_org_brand', false);

      if (competitorCount && competitorCount.length >= 50) {
        toast({
          title: "Competitor limit reached",
          description: "You can track a maximum of 50 competitors. Please remove some competitors first.",
          variant: "destructive"
        });
        return;
      }
      
      // Check if competitor already exists
      const { data: existing } = await supabase
        .from('brand_catalog')
        .select('id')
        .eq('org_id', orgId)
        .ilike('name', competitorName.trim());

      if (existing && existing.length > 0) {
        toast({
          title: "Competitor already exists",
          description: "This competitor is already in your catalog.",
          variant: "destructive"
        });
        return;
      }

      // Add competitor to catalog
      const { error } = await supabase
        .from('brand_catalog')
        .insert({
          org_id: orgId,
          name: competitorName.trim(),
          is_org_brand: false,
          variants_json: [],
          first_detected_at: new Date().toISOString(),
          last_seen_at: new Date().toISOString(),
          total_appearances: 0,
          average_score: 0
        });

      if (error) {
        console.error('Error adding competitor:', error);
        toast({
          title: "Error adding competitor",
          description: "Failed to add the competitor to your catalog.",
          variant: "destructive"
        });
        return;
      }

      toast({
        title: "Competitor added",
        description: `${competitorName} has been added to your competitor catalog.`
      });

      setCompetitorName('');
      onCompetitorAdded?.();
    } catch (error) {
      console.error('Error in handleAddCompetitor:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Manually Add Competitors</h2>
        <p className="text-muted-foreground">
          Add competitors you want to track in AI responses. These will be monitored when your prompts are run.
        </p>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Once added, these competitors will be detected and tracked when they appear in future AI responses to your prompts.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Add New Competitor
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAddCompetitor} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="competitor-name">Competitor Name</Label>
              <Input
                id="competitor-name"
                placeholder="e.g., Asana, Monday.com, Trello"
                value={competitorName}
                onChange={(e) => setCompetitorName(e.target.value)}
                disabled={isSubmitting}
              />
              <p className="text-xs text-muted-foreground">
                Enter the exact name of the competitor as it typically appears online
              </p>
            </div>

            <Button 
              type="submit" 
              disabled={!competitorName.trim() || isSubmitting}
              className="w-full sm:w-auto"
            >
              <Plus className="h-4 w-4 mr-2" />
              {isSubmitting ? 'Adding...' : 'Add Competitor'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="bg-muted/20">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            How it Works
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-xs">
              1
            </div>
            <div>
              <p className="font-medium text-foreground">Add Competitor Name</p>
              <p className="text-xs">Enter the competitor's brand name you want to track</p>
            </div>
          </div>
          
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-xs">
              2
            </div>
            <div>
              <p className="font-medium text-foreground">Automatic Monitoring</p>
              <p className="text-xs">We'll watch for this competitor in future AI responses</p>
            </div>
          </div>
          
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-xs">
              3
            </div>
            <div>
              <p className="font-medium text-foreground">Track Performance</p>
              <p className="text-xs">View competitor mentions and trends in the Competitors tab</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
