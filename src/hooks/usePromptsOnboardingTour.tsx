import { useState, useEffect } from 'react';
import Joyride, { Step, CallBackProps, STATUS } from 'react-joyride';
import { useUser } from '@/contexts/UnifiedAuthProvider';
import { supabase } from '@/integrations/supabase/client';

const TOUR_KEY = 'llumos_prompts_onboarding_completed';

const steps: Step[] = [
  {
    target: '[data-tour="prompt-suggestions"]',
    content: (
      <div className="space-y-2">
        <h4 className="font-semibold">AI-Generated Suggestions</h4>
        <p>We've analyzed your business and generated relevant prompts to track. Click here to review these suggestions.</p>
      </div>
    ),
    placement: 'bottom',
    disableBeacon: true,
  },
  {
    target: '[data-tour="add-prompt"]',
    content: (
      <div className="space-y-2">
        <h4 className="font-semibold">Add Custom Prompts</h4>
        <p>You can also add your own custom prompts. Think about questions your customers might ask AI assistants.</p>
      </div>
    ),
    placement: 'bottom',
  },
  {
    target: '[data-tour="settings-nav"]',
    content: (
      <div className="space-y-2">
        <h4 className="font-semibold">Business Context</h4>
        <p>Make sure your business information is accurate in Settings to get the best prompt suggestions.</p>
      </div>
    ),
    placement: 'right',
  },
  {
    target: 'body',
    content: (
      <div className="space-y-3">
        <h3 className="text-lg font-semibold">You're All Set! 🚀</h3>
        <p>Start adding prompts to track your AI visibility. The dashboard will update as data comes in.</p>
        <p className="text-sm text-muted-foreground">Need help? Click the help button in the sidebar anytime.</p>
      </div>
    ),
    placement: 'center',
  },
];

export function usePromptsOnboardingTour() {
  const { userData, refreshUserData } = useUser();
  const [runTour, setRunTour] = useState(false);

  useEffect(() => {
    // Only run if we're coming from the dashboard onboarding
    const dashboardOnboardingCompleted = userData?.tour_completions?.dashboard_onboarding === true;
    const promptsTourCompleted = userData?.tour_completions?.prompts_onboarding === true;
    const promptsTourCompletedLocally = localStorage.getItem(TOUR_KEY) === 'true';
    
    // Check if we should start the tour (from dashboard onboarding navigation)
    const shouldStartTour = sessionStorage.getItem('start_prompts_tour') === 'true';
    
    if (shouldStartTour && !promptsTourCompleted && !promptsTourCompletedLocally && userData) {
      sessionStorage.removeItem('start_prompts_tour');
      setTimeout(() => setRunTour(true), 500);
    }
  }, [userData]);

  const handleJoyrideCallback = async (data: CallBackProps) => {
    const { action, status } = data;
    
    // Handle close/skip immediately to prevent blocking
    if (action === 'close' || action === 'skip' || status === STATUS.SKIPPED) {
      console.log('[Prompts Tour] User closed/skipped tour, marking as complete');
      localStorage.setItem(TOUR_KEY, 'true');
      setRunTour(false);
      
      // Try to save to DB but don't block on it
      if (userData?.id) {
        try {
          const currentCompletions = userData.tour_completions || {};
          await supabase
            .from('users')
            .update({ 
              tour_completions: { ...currentCompletions, prompts_onboarding: true }
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
      console.log('[Prompts Tour] Tour finished, marking as complete');
      localStorage.setItem(TOUR_KEY, 'true');
      setRunTour(false);
      
      if (userData?.id) {
        try {
          const currentCompletions = userData.tour_completions || {};
          await supabase
            .from('users')
            .update({ 
              tour_completions: { ...currentCompletions, prompts_onboarding: true }
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
    if (userData?.id) {
      try {
        const currentCompletions = userData.tour_completions || {};
        const { prompts_onboarding, ...rest } = currentCompletions;
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
