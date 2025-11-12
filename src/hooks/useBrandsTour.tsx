import { useState, useEffect } from 'react';
import Joyride, { Step, CallBackProps, STATUS } from 'react-joyride';
import { useUser } from '@/contexts/UnifiedAuthProvider';
import { supabase } from '@/integrations/supabase/client';

const TOUR_KEY = 'llumos_brands_tour_completed';

const steps: Step[] = [
  {
    target: 'body',
    content: 'Welcome to your Brands dashboard! Let me show you around.',
    placement: 'center',
    disableBeacon: true,
  },
  {
    target: '[data-tour="search"]',
    content: 'Search for brands by name or domain to quickly find what you need.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="create-brand"]',
    content: 'Click here to add a new brand and start tracking its AI visibility.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="brand-card"]',
    content: 'Each card shows key metrics: total prompts tracked, presence rate, and overall visibility score.',
    placement: 'top',
  },
  {
    target: '[data-tour="help-button"]',
    content: 'Need help? Click here anytime to access support or learn more about the platform.',
    placement: 'bottom',
  },
];

export function useBrandsTour() {
  const { userData, refreshUserData } = useUser();
  const [runTour, setRunTour] = useState(false);

  useEffect(() => {
    // Check database first, fallback to localStorage for non-authenticated users
    const tourCompletedInDb = userData?.tour_completions?.brands === true;
    const tourCompletedLocally = localStorage.getItem(TOUR_KEY) === 'true';
    
    if (!tourCompletedInDb && !tourCompletedLocally && userData) {
      // Delay to ensure DOM is ready
      setTimeout(() => setRunTour(true), 500);
    }
  }, [userData]);

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
              tour_completions: { ...currentCompletions, brands: true }
            })
            .eq('id', userData.id);
          
          // Refresh user data to reflect the change
          await refreshUserData();
        } catch (error) {
          console.error('Failed to update tour completion:', error);
        }
      }
      
      // Also update localStorage as backup
      localStorage.setItem(TOUR_KEY, 'true');
      setRunTour(false);
    }
  };

  const resetTour = async () => {
    // Clear from database if user is authenticated
    if (userData?.id) {
      try {
        const currentCompletions = userData.tour_completions || {};
        const { brands, ...rest } = currentCompletions;
        await supabase
          .from('users')
          .update({ tour_completions: rest })
          .eq('id', userData.id);
        
        await refreshUserData();
      } catch (error) {
        console.error('Failed to reset tour completion:', error);
      }
    }
    
    localStorage.removeItem(TOUR_KEY);
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
