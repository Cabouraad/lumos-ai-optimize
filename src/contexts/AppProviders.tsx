import React from 'react';
import { UnifiedAuthProvider } from './UnifiedAuthProvider';
import { BrandProvider } from './BrandContext';

interface AppProvidersProps {
  children: React.ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <UnifiedAuthProvider>
      <BrandProvider>
        {children}
      </BrandProvider>
    </UnifiedAuthProvider>
  );
}