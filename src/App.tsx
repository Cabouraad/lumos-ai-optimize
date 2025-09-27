import { TooltipProvider } from "@/components/ui/tooltip";
import { Routes, Route } from "react-router-dom";
import { SubscriptionGate } from "@/components/SubscriptionGate";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { Suspense, lazy, useEffect } from "react";
import Health from "@/components/Health";
import { ChunkErrorBoundary } from "@/components/ChunkErrorBoundary";
import { loadChunkWithRetry } from "@/utils/chunk-loader";

// Lazy load all page components with retry logic to handle chunk loading failures
const Index = lazy(() => loadChunkWithRetry(() => import("./pages/Index")));
const Auth = lazy(() => loadChunkWithRetry(() => import("./pages/Auth")));
const AuthProcessing = lazy(() => loadChunkWithRetry(() => import("./pages/AuthProcessing")));
const Onboarding = lazy(() => loadChunkWithRetry(() => import("./pages/Onboarding")));
const Dashboard = lazy(() => loadChunkWithRetry(() => import("./pages/Dashboard")));
const Prompts = lazy(() => loadChunkWithRetry(() => import("./pages/Prompts")));
const Optimizations = lazy(() => loadChunkWithRetry(() => import("./pages/Optimizations")));
const Competitors = lazy(() => loadChunkWithRetry(() => import("./pages/Competitors")));
const LLMsText = lazy(() => loadChunkWithRetry(() => import("./pages/LLMsText")));
const Settings = lazy(() => loadChunkWithRetry(() => import("./pages/Settings")));
const Pricing = lazy(() => loadChunkWithRetry(() => import("./pages/Pricing")));
const Features = lazy(() => loadChunkWithRetry(() => import("./pages/Features")));
const BrandVisibility = lazy(() => loadChunkWithRetry(() => import("./pages/features/BrandVisibility")));
const CompetitiveAnalysis = lazy(() => loadChunkWithRetry(() => import("./pages/features/CompetitiveAnalysis")));
const ActionableRecommendations = lazy(() => loadChunkWithRetry(() => import("./pages/features/ActionableRecommendations")));
const Resources = lazy(() => loadChunkWithRetry(() => import("./pages/Resources")));
const BlogPost = lazy(() => loadChunkWithRetry(() => import("./pages/BlogPost")));
const TrialSuccess = lazy(() => loadChunkWithRetry(() => import("./pages/TrialSuccess")));
const DomainVerification = lazy(() => loadChunkWithRetry(() => import("./pages/DomainVerification")));
const NotFound = lazy(() => loadChunkWithRetry(() => import("./pages/NotFound")));
const Reports = lazy(() => loadChunkWithRetry(() => import("./pages/Reports")));
const BypassTestPage = lazy(() => loadChunkWithRetry(() => import("./pages/BypassTestPage")));
const Labs = lazy(() => loadChunkWithRetry(() => import("./pages/Labs")));
const AuditRuns = lazy(() => loadChunkWithRetry(() => import("./pages/admin/AuditRuns")));
const FreeChecker = lazy(() => loadChunkWithRetry(() => import("./pages/FreeChecker")));
const Privacy = lazy(() => loadChunkWithRetry(() => import("./pages/Privacy")));
const Terms = lazy(() => loadChunkWithRetry(() => import("./pages/Terms")));

import { isFeatureEnabled } from '@/lib/config/feature-flags';

const App = () => {
  // Prefetch critical chunks to prevent load failures
  useEffect(() => {
    const prefetchCriticalChunks = () => {
      try {
        // Prefetch common pages
        import("./pages/Onboarding");
        import("./pages/Dashboard");
        import("./pages/Pricing");
      } catch (error) {
        // Silently ignore prefetch errors
      }
    };

    // Use requestIdleCallback if available, otherwise use setTimeout
    if (typeof window !== 'undefined') {
      if ('requestIdleCallback' in window) {
        window.requestIdleCallback(prefetchCriticalChunks);
      } else {
        setTimeout(prefetchCriticalChunks, 2000);
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
                <ChunkErrorBoundary chunkName="Dashboard">
                  <Dashboard />
                </ChunkErrorBoundary>
              </SubscriptionGate>
            </AuthGuard>
          } />
          <Route path="/prompts" element={
            <AuthGuard requireAuth={true}>
              <SubscriptionGate>
                <ChunkErrorBoundary chunkName="Prompts">
                  <Prompts />
                </ChunkErrorBoundary>
              </SubscriptionGate>
            </AuthGuard>
          } />
          <Route path="/competitors" element={
            <AuthGuard requireAuth={true}>
              <SubscriptionGate>
                <ChunkErrorBoundary chunkName="Competitors">
                  <Competitors />
                </ChunkErrorBoundary>
              </SubscriptionGate>
            </AuthGuard>
          } />
          <Route path="/llms-txt" element={
            <AuthGuard requireAuth={true}>
              <SubscriptionGate>
                <ChunkErrorBoundary chunkName="LLMsText">
                  <LLMsText />
                </ChunkErrorBoundary>
              </SubscriptionGate>
            </AuthGuard>
          } />
          <Route path="/optimizations" element={
            <AuthGuard requireAuth={true}>
              <SubscriptionGate>
                <ChunkErrorBoundary chunkName="Optimizations">
                  <Optimizations />
                </ChunkErrorBoundary>
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