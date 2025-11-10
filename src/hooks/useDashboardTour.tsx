import { Step } from 'react-joyride';
import { usePageTour } from './usePageTour';

const steps: Step[] = [
  {
    target: 'body',
    content: 'Welcome to your Dashboard! This is your command center for tracking AI visibility across all platforms.',
    placement: 'center',
    disableBeacon: true,
  },
  {
    target: '[data-tour="llumos-score"]',
    content: 'Your Llumos Score measures overall AI visibility. Higher scores mean better presence across AI platforms.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="prompts-section"]',
    content: 'Track all your monitored prompts here. See which ones perform best and identify opportunities.',
    placement: 'top',
  },
  {
    target: '[data-tour="visibility-chart"]',
    content: 'Monitor your visibility trends over time to understand how your presence is evolving.',
    placement: 'top',
  },
  {
    target: '[data-tour="recommendations"]',
    content: 'Get AI-powered recommendations to improve your visibility and performance.',
    placement: 'left',
  },
  {
    target: '[data-tour="brand-filter"]',
    content: 'Filter your dashboard by brand to focus on specific tracking targets.',
    placement: 'bottom',
  },
];

export function useDashboardTour() {
  return usePageTour({ tourKey: 'dashboard', steps });
}
