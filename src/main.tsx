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
import './index.css';
import App from './App';
import { QueryAuthBridge } from '@/components/auth/QueryAuthBridge';
import { SupabaseHealth } from '@/components/debug/SupabaseHealth';

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

const Router = HashRouter;

const rootEl = document.getElementById('root');
if (!rootEl) {
  throw new Error('Root element not found');
}

ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <ErrorBoundary>
      <HelmetProvider>
        <Router>
          <QueryClientProvider client={queryClient}>
            <ThemeProvider defaultTheme="dark">
              <EnvGate />
              <SafeAuthProvider>
                <AuthProvider>
                  <QueryAuthBridge />
                  <App />
                  <SupabaseHealth />
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
