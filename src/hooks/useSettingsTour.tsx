import { Step } from 'react-joyride';
import { usePageTour } from './usePageTour';

const steps: Step[] = [
  {
    target: 'body',
    content: 'Welcome to Settings! Here you can configure your organization, manage API keys, and customize your experience.',
    placement: 'center',
    disableBeacon: true,
  },
  {
    target: '[data-tour="org-info"]',
    content: 'View and update your organization information, including domain and business details.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="api-keys"]',
    content: 'Manage your LLM provider API keys. Add keys to unlock tracking across different AI platforms.',
    placement: 'top',
  },
  {
    target: '[data-tour="subscription"]',
    content: 'View your current subscription tier and usage limits. Upgrade to unlock more features.',
    placement: 'left',
  },
  {
    target: '[data-tour="advanced-settings"]',
    content: 'Configure advanced options like localized prompts and domain verification.',
    placement: 'top',
  },
];

export function useSettingsTour() {
  return usePageTour({ tourKey: 'settings', steps });
}
