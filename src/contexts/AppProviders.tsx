import React from 'react';
import { AuthProvider } from './AuthProvider';
import { UserProvider } from './UserProvider';
import { SubscriptionProvider } from './SubscriptionProvider';
import { BrandProvider } from './BrandContext';

interface AppProvidersProps {
  children: React.ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <AuthProvider>
      <UserProvider>
        <SubscriptionProvider>
          <BrandProvider>
            {children}
          </BrandProvider>
        </SubscriptionProvider>
      </UserProvider>
    </AuthProvider>
  );
}