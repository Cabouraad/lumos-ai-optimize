import { Step } from 'react-joyride';
import { usePageTour } from './usePageTour';

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
  return usePageTour({ tourKey: 'brands', steps });
}
