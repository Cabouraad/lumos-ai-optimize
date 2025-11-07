import { useState, useEffect } from 'react';
import Joyride, { Step, CallBackProps, STATUS } from 'react-joyride';

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
  const [runTour, setRunTour] = useState(false);

  useEffect(() => {
    const tourCompleted = localStorage.getItem(TOUR_KEY);
    if (!tourCompleted) {
      // Delay to ensure DOM is ready
      setTimeout(() => setRunTour(true), 500);
    }
  }, []);

  const handleJoyrideCallback = (data: CallBackProps) => {
    const { status } = data;
    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      localStorage.setItem(TOUR_KEY, 'true');
      setRunTour(false);
    }
  };

  const resetTour = () => {
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
