import React from 'react';
import { AuthProvider } from './AuthProvider';
import { UserProvider } from './UserProvider';
import { SubscriptionProvider } from './SubscriptionProvider';

interface AppProvidersProps {
  children: React.ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <AuthProvider>
      <UserProvider>
        <SubscriptionProvider>
          {children}
        </SubscriptionProvider>
      </UserProvider>
    </AuthProvider>
  );
}