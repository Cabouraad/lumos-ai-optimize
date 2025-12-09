import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import Joyride, { Step, CallBackProps, STATUS, ACTIONS, EVENTS } from 'react-joyride';
import { useUser } from '@/contexts/UnifiedAuthProvider';
import { supabase } from '@/integrations/supabase/client';

const TOUR_KEY = 'llumos_dashboard_onboarding_completed';

// Dashboard-only tour steps highlighting navigation items
const tourSteps: Step[] = [
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
    target: '[data-tour="dashboard-nav"]',
    content: (
      <div className="space-y-2">
        <h4 className="font-semibold">Dashboard</h4>
        <p>Your command center. See your visibility score, brand presence, and competitor comparisons at a glance.</p>
      </div>
    ),
    placement: 'right',
    disableBeacon: true,
  },
  {
    target: '[data-tour="prompts-nav"]',
    content: (
      <div className="space-y-2">
        <h4 className="font-semibold">Prompts</h4>
        <p>Manage the AI prompts you're tracking. Add custom prompts or use our AI-generated suggestions.</p>
      </div>
    ),
    placement: 'right',
    disableBeacon: true,
  },
  {
    target: '[data-tour="optimizations-nav"]',
    content: (
      <div className="space-y-2">
        <h4 className="font-semibold">Optimizations</h4>
        <p>Get actionable recommendations to improve your visibility in AI responses.</p>
      </div>
    ),
    placement: 'right',
    disableBeacon: true,
  },
  {
    target: '[data-tour="competitors-nav"]',
    content: (
      <div className="space-y-2">
        <h4 className="font-semibold">Competitors</h4>
        <p>Track how often competitors appear in AI responses compared to your brand.</p>
      </div>
    ),
    placement: 'right',
    disableBeacon: true,
  },
  {
    target: '[data-tour="citations-nav"]',
    content: (
      <div className="space-y-2">
        <h4 className="font-semibold">Citations</h4>
        <p>See which sources AI models are citing when mentioning your brand.</p>
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
        <p>Start by adding prompts to track your AI visibility. Your dashboard will update as data comes in.</p>
        <p className="text-sm text-muted-foreground">Need help? Check the Settings page anytime.</p>
      </div>
    ),
    placement: 'center',
    disableBeacon: true,
  },
];

export function DashboardOnboardingTour() {
  const { userData, refreshUserData } = useUser();
  const location = useLocation();
  const [runTour, setRunTour] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const tourInitializedRef = useRef(false);

  // Check if user should see tour (new user within 24 hours, hasn't completed)
  useEffect(() => {
    if (!userData || tourInitializedRef.current) return;
    
    const tourCompletedInDb = userData?.tour_completions?.dashboard_onboarding === true;
    const tourCompletedLocally = localStorage.getItem(TOUR_KEY) === 'true';
    
    // Check if user is new (created within last 24 hours)
    const userCreatedAt = new Date(userData.created_at);
    const now = new Date();
    const hoursSinceCreation = (now.getTime() - userCreatedAt.getTime()) / (1000 * 60 * 60);
    const isNewUser = hoursSinceCreation < 24;
    
    // Only start tour on dashboard for new users
    if (!tourCompletedInDb && !tourCompletedLocally && isNewUser && location.pathname === '/dashboard') {
      tourInitializedRef.current = true;
      setTimeout(() => {
        setStepIndex(0);
        setRunTour(true);
      }, 1000);
    }
  }, [userData, location.pathname]);

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
      await completeTour();
      return;
    }

    // Handle step progression
    if (type === EVENTS.STEP_AFTER) {
      const nextIndex = index + 1;
      
      if (nextIndex >= tourSteps.length) {
        // Tour completed
        await completeTour();
        return;
      }
      
      setStepIndex(nextIndex);
    }

    // Handle tour finished status
    if (status === STATUS.FINISHED) {
      await completeTour();
    }
  };

  // Don't render if tour shouldn't run
  if (!runTour) return null;

  return (
    <Joyride
      steps={tourSteps}
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
}
