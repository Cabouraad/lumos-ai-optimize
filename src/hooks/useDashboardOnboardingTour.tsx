import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Joyride, { Step, CallBackProps, STATUS, ACTIONS, EVENTS } from 'react-joyride';
import { useUser } from '@/contexts/UnifiedAuthProvider';
import { supabase } from '@/integrations/supabase/client';

const TOUR_KEY = 'llumos_dashboard_onboarding_completed';

// All tour steps in a single unified flow
const allSteps: Step[] = [
  {
    target: 'body',
    content: (
      <div className="space-y-3">
        <h3 className="text-lg font-semibold">Welcome to Llumos! 🎉</h3>
        <p>Let's take a quick tour to help you get started tracking your AI visibility.</p>
        <p className="text-sm text-muted-foreground">This will only take a minute.</p>
      </div>
    ),
    placement: 'center',
    disableBeacon: true,
  },
  {
    target: '[data-tour="prompts-nav"]',
    content: (
      <div className="space-y-2">
        <h4 className="font-semibold">Prompts Page</h4>
        <p>This is where you manage the prompts you're tracking. Let's go there now.</p>
      </div>
    ),
    placement: 'right',
    disableBeacon: true,
    spotlightClicks: true,
  },
  {
    target: '[data-tour="prompt-suggestions"]',
    content: (
      <div className="space-y-2">
        <h4 className="font-semibold">AI-Generated Suggestions</h4>
        <p>We've analyzed your business and generated relevant prompts to track. Review these suggestions here.</p>
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
        <p>You can also add your own prompts. Think about questions your customers might ask AI assistants.</p>
      </div>
    ),
    placement: 'bottom',
    disableBeacon: true,
  },
  {
    target: 'body',
    content: (
      <div className="space-y-3">
        <h3 className="text-lg font-semibold">You're All Set! 🚀</h3>
        <p>Start adding prompts to track your AI visibility. Your dashboard will update as data comes in.</p>
        <p className="text-sm text-muted-foreground">Need help? Check the Settings page anytime.</p>
      </div>
    ),
    placement: 'center',
    disableBeacon: true,
  },
];

export function useDashboardOnboardingTour() {
  const { userData, refreshUserData } = useUser();
  const navigate = useNavigate();
  const location = useLocation();
  const [runTour, setRunTour] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [waitingForNavigation, setWaitingForNavigation] = useState(false);

  // Start tour for new users who haven't completed it
  useEffect(() => {
    if (!userData) return;
    
    const tourCompletedInDb = userData?.tour_completions?.dashboard_onboarding === true;
    const tourCompletedLocally = localStorage.getItem(TOUR_KEY) === 'true';
    
    // Check if user is new (created within last 24 hours)
    const userCreatedAt = new Date(userData.created_at);
    const now = new Date();
    const hoursSinceCreation = (now.getTime() - userCreatedAt.getTime()) / (1000 * 60 * 60);
    const isNewUser = hoursSinceCreation < 24;
    
    if (!tourCompletedInDb && !tourCompletedLocally && isNewUser) {
      setTimeout(() => setRunTour(true), 1000);
    }
  }, [userData]);

  // Resume tour after navigation to prompts page
  useEffect(() => {
    if (waitingForNavigation && location.pathname === '/prompts') {
      setWaitingForNavigation(false);
      // Move to the prompts page steps
      setTimeout(() => {
        setStepIndex(2); // Jump to "AI-Generated Suggestions" step
        setRunTour(true);
      }, 500);
    }
  }, [location.pathname, waitingForNavigation]);

  const completeTour = useCallback(async () => {
    localStorage.setItem(TOUR_KEY, 'true');
    setRunTour(false);
    setStepIndex(0);
    
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
  }, [userData, refreshUserData]);

  const handleJoyrideCallback = async (data: CallBackProps) => {
    const { action, index, status, type } = data;

    // Handle close/skip
    if (action === ACTIONS.CLOSE || action === ACTIONS.SKIP || status === STATUS.SKIPPED) {
      console.log('[Tour] User closed/skipped tour');
      await completeTour();
      return;
    }

    // Handle step progression
    if (type === EVENTS.STEP_AFTER) {
      const nextIndex = index + 1;
      
      // After step 1 (Prompts Nav), navigate to prompts page
      if (index === 1 && location.pathname !== '/prompts') {
        setRunTour(false);
        setWaitingForNavigation(true);
        navigate('/prompts');
        return;
      }
      
      // Move to next step
      if (nextIndex < allSteps.length) {
        setStepIndex(nextIndex);
      }
    }

    // Handle tour completion
    if (status === STATUS.FINISHED) {
      console.log('[Tour] Tour finished');
      await completeTour();
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
    setStepIndex(0);
    setRunTour(true);
  };

  const TourComponent = () => (
    <Joyride
      steps={allSteps}
      run={runTour}
      stepIndex={stepIndex}
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
          padding: '16px 20px',
        },
        buttonNext: {
          backgroundColor: 'hsl(var(--primary))',
          borderRadius: 6,
          padding: '8px 16px',
        },
        buttonBack: {
          color: 'hsl(var(--muted-foreground))',
          marginRight: 8,
        },
        buttonClose: {
          color: 'hsl(var(--muted-foreground))',
        },
        buttonSkip: {
          color: 'hsl(var(--muted-foreground))',
        },
      }}
      locale={{
        back: 'Back',
        close: 'Close',
        last: 'Get Started',
        next: 'Next',
        skip: 'Skip Tour',
      }}
    />
  );

  return { TourComponent, resetTour, runTour };
}
