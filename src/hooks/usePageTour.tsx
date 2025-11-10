import { useState, useEffect } from 'react';
import Joyride, { Step, CallBackProps, STATUS } from 'react-joyride';
import { useUser } from '@/contexts/UserProvider';
import { supabase } from '@/integrations/supabase/client';

interface UsePageTourProps {
  tourKey: string;
  steps: Step[];
}

/**
 * Generic reusable tour hook that stores completion status in the database
 * @param tourKey - Unique identifier for this tour (e.g., 'dashboard', 'analytics', 'settings')
 * @param steps - Array of Joyride step configurations
 */
export function usePageTour({ tourKey, steps }: UsePageTourProps) {
  const { userData, refreshUserData } = useUser();
  const [runTour, setRunTour] = useState(false);
  const localStorageKey = `llumos_${tourKey}_tour_completed`;

  useEffect(() => {
    // Check database first, fallback to localStorage for non-authenticated users
    const tourCompletedInDb = userData?.tour_completions?.[tourKey] === true;
    const tourCompletedLocally = localStorage.getItem(localStorageKey) === 'true';
    
    if (!tourCompletedInDb && !tourCompletedLocally && userData) {
      // Delay to ensure DOM is ready
      setTimeout(() => setRunTour(true), 500);
    }
  }, [userData, tourKey, localStorageKey]);

  const handleJoyrideCallback = async (data: CallBackProps) => {
    const { status } = data;
    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      // Update database if user is authenticated
      if (userData?.id) {
        try {
          const currentCompletions = userData.tour_completions || {};
          await supabase
            .from('users')
            .update({ 
              tour_completions: { ...currentCompletions, [tourKey]: true }
            })
            .eq('id', userData.id);
          
          // Refresh user data to reflect the change
          await refreshUserData();
        } catch (error) {
          console.error(`Failed to update ${tourKey} tour completion:`, error);
        }
      }
      
      // Also update localStorage as backup
      localStorage.setItem(localStorageKey, 'true');
      setRunTour(false);
    }
  };

  const resetTour = async () => {
    // Clear from database if user is authenticated
    if (userData?.id) {
      try {
        const currentCompletions = userData.tour_completions || {};
        const { [tourKey]: _, ...rest } = currentCompletions;
        await supabase
          .from('users')
          .update({ tour_completions: rest })
          .eq('id', userData.id);
        
        await refreshUserData();
      } catch (error) {
        console.error(`Failed to reset ${tourKey} tour completion:`, error);
      }
    }
    
    localStorage.removeItem(localStorageKey);
    setRunTour(true);
  };

  const TourComponent = () => (
    <Joyride
      steps={steps}
      run={runTour}
      continuous
      showProgress
      showSkipButton
      callback={handleJoyrideCallback}
      styles={{
        options: {
          primaryColor: 'hsl(var(--primary))',
          zIndex: 10000,
        },
      }}
    />
  );

  return { TourComponent, resetTour, runTour };
}
