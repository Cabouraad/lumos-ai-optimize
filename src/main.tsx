import * as React from 'react';
import * as ReactDOM from 'react-dom/client';
import { BrowserRouter, HashRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HelmetProvider } from 'react-helmet-async';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { SafeAuthProvider } from './components/SafeAuthProvider';
import { Toaster } from '@/components/ui/toaster';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { EnvGate } from '@/components/EnvGate';
import { checkReactAvailability, waitForReact } from '@/lib/react-safety';
import App from './App';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
      retry: (failureCount, error) => {
        // Don't retry on 4xx errors (client errors)
        if (error && typeof error === 'object' && 'status' in error) {
          const status = (error as any).status;
          if (status >= 400 && status < 500) return false;
        }
        // Retry up to 2 times for other errors
        return failureCount < 2;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      refetchOnWindowFocus: false, // Reduce unnecessary refetches
      refetchOnReconnect: true, // Refetch when connection is restored
    },
    mutations: {
      retry: 1, // Retry mutations once on failure
      retryDelay: 1000,
    },
  },
});

// Use HashRouter everywhere to avoid SPA rewrite issues on static hosts
const Router = HashRouter;

// Safe app initialization with React availability check
async function initializeApp() {
  try {
    // Check React availability first
    const { isReady, missing } = checkReactAvailability();
    
    if (!isReady) {
      console.warn('React not fully ready, waiting...', missing);
      await waitForReact(10000); // Wait up to 10 seconds
    }
    
    console.log('React is ready, initializing app');
    
    const root = document.getElementById('root');
    if (!root) {
      throw new Error('Root element not found');
    }
    
    ReactDOM.createRoot(root).render(
      <React.StrictMode>
        <ErrorBoundary>
          <HelmetProvider>
            <Router>
              <QueryClientProvider client={queryClient}>
                <ThemeProvider defaultTheme="dark">
                  <EnvGate />
                  <SafeAuthProvider>
                    <AuthProvider>
                      <App />
                      <Toaster />
                    </AuthProvider>
                  </SafeAuthProvider>
                </ThemeProvider>
              </QueryClientProvider>
            </Router>
          </HelmetProvider>
        </ErrorBoundary>
      </React.StrictMode>
    );
  } catch (error) {
    console.error('Failed to initialize app:', error);
    
    // Show fallback UI
    const root = document.getElementById("root");
    if (root) {
      root.innerHTML = `
        <div style="padding: 20px; text-align: center; font-family: system-ui; background: #fee; min-height: 100vh; display: flex; align-items: center; justify-content: center;">
          <div style="max-width: 600px;">
            <h2 style="color: #ef4444; margin-bottom: 16px;">Application Loading Error</h2>
            <p style="color: #666; margin-bottom: 24px;">There was an issue loading the React application. This usually happens when React components aren't properly loaded.</p>
            <button onclick="window.location.reload()" 
                    style="padding: 12px 24px; background: #3b82f6; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 16px; margin-bottom: 20px;">
              Reload Page
            </button>
            <details style="text-align: left;">
              <summary style="cursor: pointer; color: #666; margin-bottom: 10px;">Technical Details</summary>
              <pre style="background: #f3f4f6; padding: 10px; border-radius: 4px; font-size: 12px; overflow: auto; white-space: pre-wrap;">${String(error)}</pre>
            </details>
          </div>
        </div>
      `;
    }
  }
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  // DOM is already ready, init immediately
  initializeApp();
}