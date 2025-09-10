import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, HashRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HelmetProvider } from 'react-helmet-async';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { Toaster } from '@/components/ui/toaster';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { EnvGate } from '@/components/EnvGate';
import App from './App';
import './index.css';

const queryClient = new QueryClient();

// Use HashRouter for llumos.app to avoid SPA rewrite issues, BrowserRouter elsewhere
const Router = window.location.host.includes('llumos.app') ? HashRouter : BrowserRouter;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <HelmetProvider>
        <Router>
          <QueryClientProvider client={queryClient}>
            <ThemeProvider defaultTheme="dark">
              <EnvGate />
              <AuthProvider>
                <App />
                <Toaster />
              </AuthProvider>
            </ThemeProvider>
          </QueryClientProvider>
        </Router>
      </HelmetProvider>
    </ErrorBoundary>
  </React.StrictMode>
);