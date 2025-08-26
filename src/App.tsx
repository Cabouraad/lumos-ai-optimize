import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { SubscriptionGate } from "@/components/SubscriptionGate";
import { Suspense, lazy } from "react";

// Lazy load all page components to reduce initial bundle size
const Index = lazy(() => import("./pages/Index"));
const Auth = lazy(() => import("./pages/Auth"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Prompts = lazy(() => import("./pages/Prompts"));
const Recommendations = lazy(() => import("./pages/Recommendations"));
const Competitors = lazy(() => import("./pages/Competitors"));
const LLMsText = lazy(() => import("./pages/LLMsText"));
const Settings = lazy(() => import("./pages/Settings"));
const Pricing = lazy(() => import("./pages/Pricing"));
const Features = lazy(() => import("./pages/Features"));
const TrialSuccess = lazy(() => import("./pages/TrialSuccess"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>}>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/features" element={<Features />} />
            <Route path="/trial-success" element={<TrialSuccess />} />
            <Route path="/dashboard" element={
              <SubscriptionGate>
                <Dashboard />
              </SubscriptionGate>
            } />
            <Route path="/prompts" element={
              <SubscriptionGate>
                <Prompts />
              </SubscriptionGate>
            } />
            <Route path="/competitors" element={
              <SubscriptionGate>
                <Competitors />
              </SubscriptionGate>
            } />
            <Route path="/llms-txt" element={
              <SubscriptionGate>
                <LLMsText />
              </SubscriptionGate>
            } />
            <Route path="/recommendations" element={
              <SubscriptionGate>
                <Recommendations />
              </SubscriptionGate>
            } />
            <Route path="/settings" element={
              <SubscriptionGate>
                <Settings />
              </SubscriptionGate>
            } />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
