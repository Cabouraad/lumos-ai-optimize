import { TooltipProvider } from "@/components/ui/tooltip";
import { Routes, Route, Navigate } from "react-router-dom";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { Suspense, lazy, useEffect } from "react";
import Health from "@/components/Health";
import { ChunkErrorBoundary } from "@/components/ChunkErrorBoundary";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { loadChunkWithRetry } from "@/utils/chunk-loader";
import { OnboardingGate } from "@/components/auth/OnboardingGate";
import { GoogleAdsTracking } from "@/components/tracking/GoogleAdsTracking";
import { useGlobalShortcuts } from "@/hooks/useKeyboardShortcuts";

// Lazy load all page components with retry logic to handle chunk loading failures
const Index = lazy(() => loadChunkWithRetry(() => import("./pages/Index")));
const SignIn = lazy(() => loadChunkWithRetry(() => import("./pages/SignIn")));
const SignUp = lazy(() => loadChunkWithRetry(() => import("./pages/SignUp")));
const AuthProcessing = lazy(() => loadChunkWithRetry(() => import("./pages/AuthProcessing")));
const Onboarding = lazy(() => loadChunkWithRetry(() => import("./pages/Onboarding")));
const BrandOnboarding = lazy(() => loadChunkWithRetry(() => import("./pages/BrandOnboarding")));
const StarterPrompts = lazy(() => loadChunkWithRetry(() => import("./pages/StarterPrompts")));
const Dashboard = lazy(() => loadChunkWithRetry(() => import("./pages/Dashboard")));
const LlumosScore = lazy(() => loadChunkWithRetry(() => import("./pages/LlumosScore")));
const CitationAnalytics = lazy(() => loadChunkWithRetry(() => import("./pages/CitationAnalytics")));
const BrandMentionAnalyzer = lazy(() => loadChunkWithRetry(() => import("./pages/BrandMentionAnalyzer")));
const Prompts = lazy(() => loadChunkWithRetry(() => import("./pages/Prompts")));
const PromptDetail = lazy(() => loadChunkWithRetry(() => import("./pages/PromptDetail")));
const OptimizationsV2 = lazy(() => loadChunkWithRetry(() => import("./pages/OptimizationsV2")));
const NewOptimizations = lazy(() => loadChunkWithRetry(() => import("./pages/NewOptimizations")));
const Competitors = lazy(() => loadChunkWithRetry(() => import("./pages/Competitors")));
const LLMsText = lazy(() => loadChunkWithRetry(() => import("./pages/LLMsText")));
const Settings = lazy(() => loadChunkWithRetry(() => import("./pages/Settings")));
const Pricing = lazy(() => loadChunkWithRetry(() => import("./pages/Pricing")));
const Features = lazy(() => loadChunkWithRetry(() => import("./pages/Features")));
const BrandVisibility = lazy(() => loadChunkWithRetry(() => import("./pages/features/BrandVisibility")));
const CompetitiveAnalysis = lazy(() => loadChunkWithRetry(() => import("./pages/features/CompetitiveAnalysis")));
const ActionableRecommendations = lazy(() => loadChunkWithRetry(() => import("./pages/features/ActionableRecommendations")));
const CitationAnalysisFeature = lazy(() => loadChunkWithRetry(() => import("./pages/features/CitationAnalysisFeature")));
const LLMsTextFeature = lazy(() => loadChunkWithRetry(() => import("./pages/features/LLMsTextFeature")));
const TierComparison = lazy(() => loadChunkWithRetry(() => import("./pages/features/TierComparison")));
const ContentStudioFeature = lazy(() => loadChunkWithRetry(() => import("./pages/features/ContentStudio")));
const Resources = lazy(() => loadChunkWithRetry(() => import("./pages/Resources")));
const BlogPost = lazy(() => loadChunkWithRetry(() => import("./pages/BlogPost")));
const TrialSuccess = lazy(() => loadChunkWithRetry(() => import("./pages/TrialSuccess")));
const PaymentSuccess = lazy(() => loadChunkWithRetry(() => import("./pages/PaymentSuccess")));
const DomainVerification = lazy(() => loadChunkWithRetry(() => import("./pages/DomainVerification")));
const NotFound = lazy(() => loadChunkWithRetry(() => import("./pages/NotFound")));
const Reports = lazy(() => loadChunkWithRetry(() => import("./pages/Reports")));
const Sources = lazy(() => loadChunkWithRetry(() => import("./pages/Sources")));
const BypassTestPage = lazy(() => loadChunkWithRetry(() => import("./pages/BypassTestPage")));
const Labs = lazy(() => loadChunkWithRetry(() => import("./pages/Labs")));
const AuditRuns = lazy(() => loadChunkWithRetry(() => import("./pages/admin/AuditRuns")));
const TestDashboard = lazy(() => loadChunkWithRetry(() => import("./pages/TestDashboard")));
const FreeChecker = lazy(() => loadChunkWithRetry(() => import("./pages/FreeChecker")));
const Privacy = lazy(() => loadChunkWithRetry(() => import("./pages/Privacy")));
const Terms = lazy(() => loadChunkWithRetry(() => import("./pages/Terms")));
const CronSetup = lazy(() => loadChunkWithRetry(() => import("./pages/CronSetup")));
const RunReports = lazy(() => loadChunkWithRetry(() => import("./pages/RunReports")));
const DomainAuthority = lazy(() => loadChunkWithRetry(() => import("./pages/admin/DomainAuthority")));
const UserGuide = lazy(() => loadChunkWithRetry(() => import("./pages/UserGuide")));
const StarterPlan = lazy(() => loadChunkWithRetry(() => import("./pages/plans/StarterPlan")));
const GrowthPlan = lazy(() => loadChunkWithRetry(() => import("./pages/plans/GrowthPlan")));
const ProPlan = lazy(() => loadChunkWithRetry(() => import("./pages/plans/ProPlan")));
const Brands = lazy(() => loadChunkWithRetry(() => import("./pages/Brands")));
const CompetitorManagement = lazy(() => loadChunkWithRetry(() => import("./pages/CompetitorManagement")));
const BlackFriday = lazy(() => loadChunkWithRetry(() => import("./pages/BlackFriday")));
const BlackFridaySuccess = lazy(() => loadChunkWithRetry(() => import("./pages/BlackFridaySuccess")));
const Demo = lazy(() => loadChunkWithRetry(() => import("./pages/Demo")));
const ContentStudio = lazy(() => loadChunkWithRetry(() => import("./pages/ContentStudio")));

import { isFeatureEnabled } from '@/lib/config/feature-flags';

const App = () => {
  // Enable global keyboard shortcuts
  useGlobalShortcuts();

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
      <GoogleAdsTracking />
      <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>}>
        <Routes>
          {/* Public routes - no auth required */}
          <Route path="/" element={<Index />} />
          <Route path="/health" element={<Health />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/plans/starter" element={<StarterPlan />} />
          <Route path="/plans/growth" element={<GrowthPlan />} />
          <Route path="/plans/pro" element={<ProPlan />} />
          <Route path="/features" element={<Features />} />
          <Route path="/features/brand-visibility" element={<BrandVisibility />} />
          <Route path="/features/competitive-analysis" element={<CompetitiveAnalysis />} />
          <Route path="/features/actionable-recommendations" element={<ActionableRecommendations />} />
          <Route path="/features/citation-analysis" element={<CitationAnalysisFeature />} />
          <Route path="/features/llms-txt" element={<LLMsTextFeature />} />
          <Route path="/features/tier-comparison" element={<TierComparison />} />
          <Route path="/features/content-studio" element={<ContentStudioFeature />} />
          <Route path="/resources" element={<Resources />} />
          <Route path="/resources/:slug" element={<BlogPost />} />
          <Route path="/trial-success" element={<TrialSuccess />} />
          <Route path="/payment-success" element={<PaymentSuccess />} />
          <Route path="/free-checker" element={<FreeChecker />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/black-friday" element={<BlackFriday />} />
          <Route path="/black-friday-success" element={<BlackFridaySuccess />} />
          
          {/* Auth routes - redirect if already authenticated */}
          <Route path="/signin" element={
            <ProtectedRoute requireAuth={false}>
              <SignIn />
            </ProtectedRoute>
          } />
          <Route path="/signup" element={
            <ProtectedRoute requireAuth={false}>
              <SignUp />
            </ProtectedRoute>
          } />
          <Route path="/auth" element={<Navigate to="/signin" replace />} />
          <Route path="/auth/processing" element={<AuthProcessing />} />
          
          {/* Protected routes - require authentication and subscription */}
          <Route path="/onboarding" element={
            <ProtectedRoute requireSubscription={false}>
              <PageErrorBoundary pageName="Onboarding">
                <Onboarding />
              </PageErrorBoundary>
            </ProtectedRoute>
          } />
          <Route path="/onboarding/brand" element={
            <ProtectedRoute>
              <BrandOnboarding />
            </ProtectedRoute>
          } />
          <Route path="/onboarding/prompts" element={
            <ProtectedRoute>
              <StarterPrompts />
            </ProtectedRoute>
          } />
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <OnboardingGate>
                <ChunkErrorBoundary chunkName="Dashboard">
                  <Dashboard />
                </ChunkErrorBoundary>
              </OnboardingGate>
            </ProtectedRoute>
          } />
          <Route path="/llumos-score" element={
            <ProtectedRoute>
              <OnboardingGate>
                <ChunkErrorBoundary chunkName="LlumosScore">
                  <LlumosScore />
                </ChunkErrorBoundary>
              </OnboardingGate>
            </ProtectedRoute>
          } />
          <Route path="/citation-analytics" element={
            <ProtectedRoute>
              <OnboardingGate>
                <ChunkErrorBoundary chunkName="CitationAnalytics">
                  <CitationAnalytics />
                </ChunkErrorBoundary>
              </OnboardingGate>
            </ProtectedRoute>
          } />
          <Route path="/brand-mention-analyzer" element={
            <ProtectedRoute>
              <OnboardingGate>
                <ChunkErrorBoundary chunkName="BrandMentionAnalyzer">
                  <BrandMentionAnalyzer />
                </ChunkErrorBoundary>
              </OnboardingGate>
            </ProtectedRoute>
          } />
          <Route path="/prompts" element={
            <ProtectedRoute>
              <PageErrorBoundary pageName="Prompts">
                <ChunkErrorBoundary chunkName="Prompts">
                  <Prompts />
                </ChunkErrorBoundary>
              </PageErrorBoundary>
            </ProtectedRoute>
          } />
          <Route path="/prompts/:promptId" element={
            <ProtectedRoute>
              <ChunkErrorBoundary chunkName="PromptDetail">
                <PromptDetail />
              </ChunkErrorBoundary>
            </ProtectedRoute>
          } />
          <Route path="/competitors" element={
            <ProtectedRoute>
              <ChunkErrorBoundary chunkName="Competitors">
                <Competitors />
              </ChunkErrorBoundary>
            </ProtectedRoute>
          } />
          <Route path="/competitors/manage" element={
            <ProtectedRoute>
              <ChunkErrorBoundary chunkName="CompetitorManagement">
                <CompetitorManagement />
              </ChunkErrorBoundary>
            </ProtectedRoute>
          } />
          <Route path="/llms-txt" element={
            <ProtectedRoute>
              <ChunkErrorBoundary chunkName="LLMsText">
                <LLMsText />
              </ChunkErrorBoundary>
            </ProtectedRoute>
          } />
          <Route path="/optimizations" element={
            <ProtectedRoute>
              <PageErrorBoundary pageName="Optimizations">
                <ChunkErrorBoundary chunkName="OptimizationsV2">
                  <OptimizationsV2 />
                </ChunkErrorBoundary>
              </PageErrorBoundary>
            </ProtectedRoute>
          } />
          <Route path="/content-studio" element={
            <ProtectedRoute>
              <PageErrorBoundary pageName="ContentStudio">
                <ChunkErrorBoundary chunkName="ContentStudio">
                  <ContentStudio />
                </ChunkErrorBoundary>
              </PageErrorBoundary>
            </ProtectedRoute>
          } />
          <Route path="/optimizations-legacy" element={
            <ProtectedRoute>
              <ChunkErrorBoundary chunkName="NewOptimizations">
                <NewOptimizations />
              </ChunkErrorBoundary>
            </ProtectedRoute>
          } />
          <Route path="/reports" element={
            <ProtectedRoute>
              <Reports />
            </ProtectedRoute>
          } />
          <Route path="/sources" element={
            <ProtectedRoute>
              <ChunkErrorBoundary chunkName="Sources">
                <Sources />
              </ChunkErrorBoundary>
            </ProtectedRoute>
          } />
          <Route path="/settings" element={
            <ProtectedRoute>
              <PageErrorBoundary pageName="Settings">
                <Settings />
              </PageErrorBoundary>
            </ProtectedRoute>
          } />
          <Route path="/user-guide" element={
            <ProtectedRoute>
              <UserGuide />
            </ProtectedRoute>
          } />
          <Route path="/domain-verification" element={
            <ProtectedRoute>
              <DomainVerification />
            </ProtectedRoute>
          } />
          <Route path="/bypass-test" element={
            <ProtectedRoute>
              <BypassTestPage />
            </ProtectedRoute>
          } />
          <Route path="/labs" element={
            <ProtectedRoute>
              <Labs />
            </ProtectedRoute>
          } />
          <Route path="/tests" element={
            <ProtectedRoute>
              <TestDashboard />
            </ProtectedRoute>
          } />
          {isFeatureEnabled('AUDIT_UI') && (
            <Route path="/admin/audit-runs" element={
              <ProtectedRoute>
                <AuditRuns />
              </ProtectedRoute>
            } />
          )}
          <Route path="/admin/cron-setup" element={
            <ProtectedRoute>
              <CronSetup />
            </ProtectedRoute>
          } />
          <Route path="/admin/run-reports" element={
            <ProtectedRoute>
              <RunReports />
            </ProtectedRoute>
          } />
          <Route path="/admin/domain-authority" element={
            <ProtectedRoute>
              <DomainAuthority />
            </ProtectedRoute>
          } />
          <Route path="/brands" element={
            <ProtectedRoute>
              <Brands />
            </ProtectedRoute>
          } />
          <Route path="/demo" element={<Demo />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </TooltipProvider>
  );
};

export default App;