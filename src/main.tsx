import * as React from 'react';
import * as ReactDOM from 'react-dom/client';
import { BrowserRouter, HashRouter } from 'react-router-dom';
import { QueryProvider } from './app/providers/QueryProvider';
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


// Query client is provided by QueryProvider with sane defaults

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
          <QueryProvider>
            <ThemeProvider defaultTheme="dark">
              <EnvGate />
              <SafeAuthProvider>
                <AuthProvider>
                   <QueryAuthBridge />
                    <App />
                    <Toaster />
                </AuthProvider>
              </SafeAuthProvider>
            </ThemeProvider>
          </QueryProvider>
        </Router>
      </HelmetProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
