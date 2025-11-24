import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Joyride, { Step, CallBackProps, STATUS, ACTIONS, EVENTS } from 'react-joyride';
import { useUser } from '@/contexts/UnifiedAuthProvider';
import { supabase } from '@/integrations/supabase/client';

const TOUR_KEY = 'llumos_dashboard_onboarding_completed';

const dashboardSteps: Step[] = [
  {
    target: 'body',
    content: (
      <div className="space-y-3">
        <h3 className="text-lg font-semibold">Welcome to Llumos! 🎉</h3>
        <p>Let's take a quick tour to help you get started tracking your AI visibility.</p>
        <p className="text-sm text-muted-foreground">This will only take a minute.</p>
        <p className="text-sm font-medium mt-4">Click Next to continue to the Prompts page.</p>
      </div>
    ),
    placement: 'center',
    disableBeacon: true,
  },
];

const promptsPageSteps: Step[] = [
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
    disableBeacon: true,
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
    disableBeacon: true,
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

export function useDashboardOnboardingTour() {
  const { userData, refreshUserData } = useUser();
  const navigate = useNavigate();
  const [runTour, setRunTour] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [tourStage, setTourStage] = useState<'dashboard' | 'prompts'>('dashboard');

  useEffect(() => {
    // Check if tour has been completed
    const tourCompletedInDb = userData?.tour_completions?.dashboard_onboarding === true;
    const tourCompletedLocally = localStorage.getItem(TOUR_KEY) === 'true';
    
    if (!tourCompletedInDb && !tourCompletedLocally && userData) {
      // Delay to ensure DOM is ready
      setTimeout(() => setRunTour(true), 1000);
    }
  }, [userData]);

  const handleJoyrideCallback = async (data: CallBackProps) => {
    const { action, index, status, type } = data;

    // Handle close/skip immediately to prevent blocking
    if (action === ACTIONS.CLOSE || action === ACTIONS.SKIP || status === STATUS.SKIPPED) {
      console.log('[Tour] User closed/skipped tour, marking as complete');
      localStorage.setItem(TOUR_KEY, 'true');
      setRunTour(false);
      
      // Try to save to DB but don't block on it
      if (userData?.id) {
        try {
          const currentCompletions = userData.tour_completions || {};
          await supabase
            .from('users')
            .update({ 
              tour_completions: { ...currentCompletions, dashboard_onboarding: true }
            })
            .eq('id', userData.id);
          
          await refreshUserData();
        } catch (error) {
          console.error('Failed to update tour completion:', error);
          // Don't block user if DB update fails
        }
      }
      return;
    }

    // When user completes the welcome step on dashboard
    if (type === EVENTS.STEP_AFTER && tourStage === 'dashboard' && index === 0) {
      // After welcome screen, navigate directly to prompts page
      setRunTour(false);
      navigate('/prompts');
      // Start prompts tour after navigation
      setTimeout(() => {
        setTourStage('prompts');
        setCurrentStep(0);
        setRunTour(true);
      }, 800);
      return;
    }

    // Handle tour completion
    if (status === STATUS.FINISHED) {
      console.log('[Tour] Tour finished, marking as complete');
      localStorage.setItem(TOUR_KEY, 'true');
      setRunTour(false);
      
      if (userData?.id) {
        try {
          const currentCompletions = userData.tour_completions || {};
          await supabase
            .from('users')
            .update({ 
              tour_completions: { ...currentCompletions, dashboard_onboarding: true }
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
        const { dashboard_onboarding, ...rest } = currentCompletions;
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
    setTourStage('dashboard');
    setCurrentStep(0);
    setRunTour(true);
  };

  const steps = tourStage === 'dashboard' ? dashboardSteps : promptsPageSteps;

  const TourComponent = () => (
    <Joyride
      steps={steps}
      run={runTour}
      stepIndex={currentStep}
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

  return { TourComponent, resetTour, runTour, tourStage };
}
