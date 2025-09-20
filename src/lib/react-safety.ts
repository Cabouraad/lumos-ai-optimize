import * as React from 'react';

// React availability and safety utilities

export interface ReactAvailability {
  isReady: boolean;
  missing: string[];
}

/**
 * Check if React is fully available and safe to use
 */
export function checkReactAvailability(): ReactAvailability {
  const missing: string[] = [];
  
  if (typeof React === 'undefined') {
    missing.push('React namespace');
    return { isReady: false, missing };
  }
  
  if (typeof React.createElement !== 'function') {
    missing.push('React.createElement');
  }
  
  if (typeof React.forwardRef !== 'function') {
    missing.push('React.forwardRef');
  }
  
  if (typeof React.createContext !== 'function') {
    missing.push('React.createContext');
  }
  
  if (typeof React.useContext !== 'function') {
    missing.push('React.useContext');
  }
  
  return {
    isReady: missing.length === 0,
    missing
  };
}

/**
 * Wait for React to be available with timeout
 */
export function waitForReact(timeout = 5000): Promise<void> {
  return new Promise((resolve, reject) => {
    const check = () => {
      const { isReady } = checkReactAvailability();
      if (isReady) {
        resolve();
        return;
      }
      
      // Check again in 100ms
      setTimeout(check, 100);
    };
    
    // Start checking
    check();
    
    // Timeout fallback
    setTimeout(() => {
      const { isReady, missing } = checkReactAvailability();
      if (!isReady) {
        reject(new Error(`React not available after ${timeout}ms. Missing: ${missing.join(', ')}`));
      }
    }, timeout);
  });
}

/**
 * Safe component wrapper that waits for React availability
 */
export function withReactSafety<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: React.ComponentType
): React.ComponentType<P> {
  return (props: P) => {
    const { isReady } = checkReactAvailability();
    
    if (!isReady) {
      if (fallback) {
        return React.createElement(fallback, props);
      }
      
      return React.createElement('div', {
        style: {
          padding: '20px',
          textAlign: 'center',
          color: '#666',
          fontFamily: 'system-ui'
        }
      }, 'Loading component...');
    }
    
    return React.createElement(Component, props);
  };
}