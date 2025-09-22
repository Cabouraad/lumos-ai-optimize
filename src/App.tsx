import { TooltipProvider } from "@/components/ui/tooltip";
import { Routes, Route } from "react-router-dom";
import { SubscriptionGate } from "@/components/SubscriptionGate";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { Suspense, lazy, useEffect } from "react";
import Health from "@/components/Health";

// Lazy load all page components to reduce initial bundle size
const Index = lazy(() => import("./pages/Index"));
const Auth = lazy(() => import("./pages/Auth"));
const AuthProcessing = lazy(() => import("./pages/AuthProcessing"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Prompts = lazy(() => import("./pages/Prompts"));
const Optimizations = lazy(() => import("./pages/Optimizations"));
const Competitors = lazy(() => import("./pages/Competitors"));
const LLMsText = lazy(() => import("./pages/LLMsText"));
const Settings = lazy(() => import("./pages/Settings"));
const Pricing = lazy(() => import("./pages/Pricing"));
const Features = lazy(() => import("./pages/Features"));
const BrandVisibility = lazy(() => import("./pages/features/BrandVisibility"));
const CompetitiveAnalysis = lazy(() => import("./pages/features/CompetitiveAnalysis"));
const ActionableRecommendations = lazy(() => import("./pages/features/ActionableRecommendations"));
const Resources = lazy(() => import("./pages/Resources"));
const BlogPost = lazy(() => import("./pages/BlogPost"));
const TrialSuccess = lazy(() => import("./pages/TrialSuccess"));
const DomainVerification = lazy(() => import("./pages/DomainVerification"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Reports = lazy(() => import("./pages/Reports"));
const BypassTestPage = lazy(() => import("./pages/BypassTestPage"));
const Labs = lazy(() => import("./pages/Labs"));
const AuditRuns = lazy(() => import("./pages/admin/AuditRuns"));
const FreeChecker = lazy(() => import("./pages/FreeChecker"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Terms = lazy(() => import("./pages/Terms"));

import { isFeatureEnabled } from '@/lib/config/feature-flags';

const App = () => {
  // Prefetch Onboarding chunk when idle to prevent chunk load failures
  useEffect(() => {
    const prefetchOnboarding = () => {
      try {
        import("./pages/Onboarding");
      } catch (error) {
        // Silently ignore prefetch errors
      }
    };

    // Use requestIdleCallback if available, otherwise use setTimeout
    if (typeof window !== 'undefined') {
      if ('requestIdleCallback' in window) {
        window.requestIdleCallback(prefetchOnboarding);
      } else {
        setTimeout(prefetchOnboarding, 2000);
      }
    }
  }, []);

  return (
    <TooltipProvider>
      <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>}>
        <Routes>
          {/* Public routes - no auth required */}
          <Route path="/" element={<Index />} />
          <Route path="/health" element={<Health />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/features" element={<Features />} />
          <Route path="/features/brand-visibility" element={<BrandVisibility />} />
          <Route path="/features/competitive-analysis" element={<CompetitiveAnalysis />} />
          <Route path="/features/actionable-recommendations" element={<ActionableRecommendations />} />
          <Route path="/resources" element={<Resources />} />
          <Route path="/resources/:slug" element={<BlogPost />} />
          <Route path="/trial-success" element={<TrialSuccess />} />
          <Route path="/free-checker" element={<FreeChecker />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          
          {/* Auth routes - redirect if already authenticated */}
          <Route path="/auth" element={
            <AuthGuard requireAuth={false}>
              <Auth />
            </AuthGuard>
          } />
          <Route path="/auth/processing" element={<AuthProcessing />} />
          
          {/* Protected routes - require authentication */}
          <Route path="/onboarding" element={
            <AuthGuard requireAuth={true}>
              <Onboarding />
            </AuthGuard>
          } />
          <Route path="/dashboard" element={
            <AuthGuard requireAuth={true}>
              <SubscriptionGate>
                <Dashboard />
              </SubscriptionGate>
            </AuthGuard>
          } />
          <Route path="/prompts" element={
            <AuthGuard requireAuth={true}>
              <SubscriptionGate>
                <Prompts />
              </SubscriptionGate>
            </AuthGuard>
          } />
          <Route path="/competitors" element={
            <AuthGuard requireAuth={true}>
              <SubscriptionGate>
                <Competitors />
              </SubscriptionGate>
            </AuthGuard>
          } />
          <Route path="/llms-txt" element={
            <AuthGuard requireAuth={true}>
              <SubscriptionGate>
                <LLMsText />
              </SubscriptionGate>
            </AuthGuard>
          } />
          <Route path="/optimizations" element={
            <AuthGuard requireAuth={true}>
              <SubscriptionGate>
                <Optimizations />
              </SubscriptionGate>
            </AuthGuard>
          } />
          <Route path="/reports" element={
            <AuthGuard requireAuth={true}>
              <SubscriptionGate>
                <Reports />
              </SubscriptionGate>
            </AuthGuard>
          } />
          <Route path="/settings" element={
            <AuthGuard requireAuth={true}>
              <SubscriptionGate>
                <Settings />
              </SubscriptionGate>
            </AuthGuard>
          } />
          <Route path="/domain-verification" element={
            <AuthGuard requireAuth={true}>
              <SubscriptionGate>
                <DomainVerification />
              </SubscriptionGate>
            </AuthGuard>
          } />
          <Route path="/bypass-test" element={
            <AuthGuard requireAuth={true}>
              <SubscriptionGate>
                <BypassTestPage />
              </SubscriptionGate>
            </AuthGuard>
          } />
          <Route path="/labs" element={
            <AuthGuard requireAuth={true}>
              <SubscriptionGate>
                <Labs />
              </SubscriptionGate>
            </AuthGuard>
          } />
          {isFeatureEnabled('AUDIT_UI') && (
            <Route path="/admin/audit-runs" element={
              <AuthGuard requireAuth={true}>
                <SubscriptionGate>
                  <AuditRuns />
                </SubscriptionGate>
              </AuthGuard>
            } />
          )}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </TooltipProvider>
  );
};

export default App;