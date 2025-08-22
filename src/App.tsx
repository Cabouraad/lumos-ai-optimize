import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { SubscriptionGate } from "@/components/SubscriptionGate";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import Prompts from "./pages/Prompts";
import Recommendations from "./pages/Recommendations";
import Competitors from "./pages/Competitors";
import LLMsText from "./pages/LLMsText";
import Settings from "./pages/Settings";
import Pricing from "./pages/Pricing";
import Features from "./pages/Features";
import TrialSuccess from "./pages/TrialSuccess";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
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
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
