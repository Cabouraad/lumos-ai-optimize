import * as React from 'react';
import { createContext, useContext, ReactNode } from 'react';

// Safe context creation with validation
export function createSafeContext<T>(displayName: string, defaultValue?: T) {
  // Standard context creation
  const Context = createContext<T | undefined>(defaultValue);
  Context.displayName = displayName;

  // Safe provider wrapper
  function SafeProvider({ children, value }: { children: ReactNode; value: T }) {
    return (
      <Context.Provider value={value}>
        {children}
      </Context.Provider>
    );
  }

  // Safe hook with better error messages
  function useSafeContext(): T {
    const context = useContext(Context);
    
    if (context === undefined) {
      throw new Error(`use${displayName.replace('Context', '')} must be used within a ${displayName}Provider`);
    }
    
    return context;
  }

  return {
    Context,
    Provider: SafeProvider,
    useContext: useSafeContext,
  };
}
