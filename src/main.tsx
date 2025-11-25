import * as React from 'react';
import * as ReactDOM from 'react-dom/client';
import { BrowserRouter, HashRouter } from 'react-router-dom';
import { QueryProvider } from './app/providers/QueryProvider';
import { HelmetProvider } from 'react-helmet-async';
import { AppProviders } from './contexts/AppProviders';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthErrorBoundary } from './components/auth/ErrorBoundary';
import { Toaster } from '@/components/ui/toaster';
import { GlobalErrorBoundary } from '@/components/GlobalErrorBoundary';
import { EnvGate } from '@/components/EnvGate';
import { observeWebVitals } from '@/lib/performance/monitor';
import './index.css';
import App from './App';
import { QueryAuthBridge } from '@/components/auth/QueryAuthBridge';


// Query client is provided by QueryProvider with sane defaults

// Initialize performance monitoring in all environments
// Now enabled in production for performance tracking
observeWebVitals();

const Router = HashRouter;

const rootEl = document.getElementById('root');
if (!rootEl) {
  throw new Error('Root element not found');
}

ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <GlobalErrorBoundary>
      <HelmetProvider>
        <Router>
          <QueryProvider>
            <ThemeProvider defaultTheme="dark">
              <EnvGate />
              <AuthErrorBoundary>
                <AppProviders>
                  <QueryAuthBridge />
                  <App />
                  <Toaster />
                </AppProviders>
              </AuthErrorBoundary>
            </ThemeProvider>
          </QueryProvider>
        </Router>
      </HelmetProvider>
    </GlobalErrorBoundary>
  </React.StrictMode>
);
