import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useUser } from '@/contexts/UserProvider';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { RotateCcw, Check } from 'lucide-react';

const TOUR_KEYS = [
  { key: 'brands', label: 'Brands Dashboard Tour' },
  { key: 'dashboard', label: 'Main Dashboard Tour' },
  { key: 'settings', label: 'Settings Tour' },
];

export function TourManagement() {
  const { userData, refreshUserData } = useUser();
  const { toast } = useToast();

  const resetTour = async (tourKey: string) => {
    if (!userData?.id) return;

    try {
      const currentCompletions = userData.tour_completions || {};
      const { [tourKey]: _, ...rest } = currentCompletions;
      
      await supabase
        .from('users')
        .update({ tour_completions: rest })
        .eq('id', userData.id);
      
      // Also clear localStorage
      localStorage.removeItem(`llumos_${tourKey}_tour_completed`);
      
      await refreshUserData();
      
      toast({
        title: 'Tour Reset',
        description: `The ${tourKey} tour will show again on your next visit to that page.`,
      });
    } catch (error) {
      console.error(`Failed to reset ${tourKey} tour:`, error);
      toast({
        title: 'Reset Failed',
        description: 'Could not reset the tour. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const resetAllTours = async () => {
    if (!userData?.id) return;

    try {
      await supabase
        .from('users')
        .update({ tour_completions: {} })
        .eq('id', userData.id);
      
      // Clear all localStorage entries
      TOUR_KEYS.forEach(({ key }) => {
        localStorage.removeItem(`llumos_${key}_tour_completed`);
      });
      
      await refreshUserData();
      
      toast({
        title: 'All Tours Reset',
        description: 'All onboarding tours will show again on your next visits.',
      });
    } catch (error) {
      console.error('Failed to reset all tours:', error);
      toast({
        title: 'Reset Failed',
        description: 'Could not reset tours. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const isTourCompleted = (tourKey: string) => {
    return userData?.tour_completions?.[tourKey] === true;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Onboarding Tours</CardTitle>
        <CardDescription>
          Manage guided tours for different sections of the platform. Reset tours to see them again.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {TOUR_KEYS.map(({ key, label }) => (
          <div key={key} className="flex items-center justify-between border rounded-lg p-3">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium">{label}</span>
              {isTourCompleted(key) && (
                <Check className="h-4 w-4 text-green-600" />
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => resetTour(key)}
              disabled={!isTourCompleted(key)}
              className="gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              Reset
            </Button>
          </div>
        ))}
        
        <div className="pt-4 border-t">
          <Button
            variant="secondary"
            onClick={resetAllTours}
            className="w-full gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            Reset All Tours
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
