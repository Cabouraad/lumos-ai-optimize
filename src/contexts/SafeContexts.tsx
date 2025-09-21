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

// Retry wrapper for context operations
export function withContextRetry<T extends (...args: any[]) => any>(
  fn: T,
  contextName: string,
  maxRetries = 3
): T {
  return ((...args: Parameters<T>) => {
    let lastError: Error;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return fn(...args);
      } catch (error) {
        lastError = error as Error;
        
        // If it's a context error, wait a bit and retry
        if (error instanceof Error && 
            (error.message.includes('createContext') || 
             error.message.includes('useContext') ||
             error.message.includes(contextName))) {
          
          console.warn(`${contextName} operation failed (attempt ${attempt + 1}/${maxRetries}):`, error.message);
          
          if (attempt < maxRetries - 1) {
            // Simple synchronous delay for context operations
            const start = Date.now();
            while (Date.now() - start < 100 * (attempt + 1)) {
              // Wait
            }
            continue;
          }
        }
        
        // For non-context errors or final attempt, throw immediately
        throw error;
      }
    }
    
    throw lastError!;
  }) as T;
}