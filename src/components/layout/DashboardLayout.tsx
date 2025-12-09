import { ReactNode } from 'react';
import { DashboardOnboardingTour } from '@/components/onboarding/DashboardOnboardingTour';

interface DashboardLayoutProps {
  children: ReactNode;
}

/**
 * Shared layout wrapper for all protected dashboard pages.
 * Renders persistent components like onboarding tour that should
 * survive page navigation.
 */
export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <>
      <DashboardOnboardingTour />
      {children}
    </>
  );
}
