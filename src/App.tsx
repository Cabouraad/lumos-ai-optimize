import { TooltipProvider } from "@/components/ui/tooltip";
import { Routes, Route } from "react-router-dom";
import { SubscriptionGate } from "@/components/SubscriptionGate";
import { Suspense, lazy } from "react";

// Lazy load all page components to reduce initial bundle size
const Index = lazy(() => import("./pages/Index"));
const Auth = lazy(() => import("./pages/Auth"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Prompts = lazy(() => import("./pages/Prompts"));
const Optimizations = lazy(() => import("./pages/Optimizations"));
const Competitors = lazy(() => import("./pages/Competitors"));
const LLMsText = lazy(() => import("./pages/LLMsText"));
const Settings = lazy(() => import("./pages/Settings"));
const Pricing = lazy(() => import("./pages/Pricing"));
const Features = lazy(() => import("./pages/Features"));
const TrialSuccess = lazy(() => import("./pages/TrialSuccess"));
const DomainVerification = lazy(() => import("./pages/DomainVerification"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Reports = lazy(() => import("./pages/Reports"));
const BypassTestPage = lazy(() => import("./pages/BypassTestPage"));
const Labs = lazy(() => import("./pages/Labs"));
const AuditRuns = lazy(() => import("./pages/admin/AuditRuns"));

import { isFeatureEnabled } from '@/lib/config/feature-flags';

const App = () => (
  <TooltipProvider>
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
            <Route path="/optimizations" element={
              <SubscriptionGate>
                <Optimizations />
              </SubscriptionGate>
            } />
            <Route path="/reports" element={
              <SubscriptionGate>
                <Reports />
              </SubscriptionGate>
            } />
            <Route path="/settings" element={
              <SubscriptionGate>
                <Settings />
              </SubscriptionGate>
            } />
            <Route path="/domain-verification" element={
              <SubscriptionGate>
                <DomainVerification />
              </SubscriptionGate>
            } />
            <Route path="/bypass-test" element={
              <SubscriptionGate>
                <BypassTestPage />
              </SubscriptionGate>
            } />
            <Route path="/labs" element={
              <SubscriptionGate>
                <Labs />
              </SubscriptionGate>
            } />
            {isFeatureEnabled('AUDIT_UI') && (
              <Route path="/admin/audit-runs" element={
                <SubscriptionGate>
                  <AuditRuns />
                </SubscriptionGate>
              } />
            )}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </TooltipProvider>
);

export default App;
