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
    const { action, status } = data;
    
    // Handle close/skip immediately to prevent blocking
    if (action === 'close' || action === 'skip' || status === STATUS.SKIPPED) {
      console.log('[Brands Tour] User closed/skipped tour, marking as complete');
      localStorage.setItem(TOUR_KEY, 'true');
      setRunTour(false);
      
      // Try to save to DB but don't block on it
      if (userData?.id) {
        try {
          const currentCompletions = userData.tour_completions || {};
          await supabase
            .from('users')
            .update({ 
              tour_completions: { ...currentCompletions, brands: true }
            })
            .eq('id', userData.id);
          
          await refreshUserData();
        } catch (error) {
          console.error('Failed to update tour completion:', error);
        }
      }
      return;
    }
    
    if (status === STATUS.FINISHED) {
      console.log('[Brands Tour] Tour finished, marking as complete');
      localStorage.setItem(TOUR_KEY, 'true');
      setRunTour(false);
      
      if (userData?.id) {
        try {
          const currentCompletions = userData.tour_completions || {};
          await supabase
            .from('users')
            .update({ 
              tour_completions: { ...currentCompletions, brands: true }
            })
            .eq('id', userData.id);
          
          await refreshUserData();
        } catch (error) {
          console.error('Failed to update tour completion:', error);
        }
      }
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
      disableOverlayClose={false}
      disableCloseOnEsc={false}
      spotlightClicks={false}
      callback={handleJoyrideCallback}
      styles={{
        options: {
          primaryColor: 'hsl(var(--primary))',
          zIndex: 10000,
          arrowColor: 'hsl(var(--popover))',
          backgroundColor: 'hsl(var(--popover))',
          textColor: 'hsl(var(--popover-foreground))',
        },
        tooltip: {
          borderRadius: 8,
        },
        buttonNext: {
          backgroundColor: 'hsl(var(--primary))',
          borderRadius: 6,
        },
        buttonBack: {
          color: 'hsl(var(--muted-foreground))',
        },
        buttonClose: {
          color: 'hsl(var(--muted-foreground))',
        },
      }}
      locale={{
        back: 'Back',
        close: 'Close',
        last: 'Finish',
        next: 'Next',
        skip: 'Skip Tour',
      }}
    />
  );

  return { TourComponent, resetTour, runTour };
}
