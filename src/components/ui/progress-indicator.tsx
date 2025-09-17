/**
 * Progress Indicator Components for Onboarding
 * 
 * Safe UI enhancements for better user experience
 */

import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Check, Clock, ArrowRight } from "lucide-react";
import type { OnboardingProgress, OnboardingStep } from "@/lib/onboarding/progress-tracker";
import { optimizationFlags } from "@/config/featureFlags";

interface ProgressIndicatorProps {
  progress: OnboardingProgress;
  className?: string;
}

export function OnboardingProgressIndicator({ progress, className = "" }: ProgressIndicatorProps) {
  if (!optimizationFlags.FEATURE_ONBOARDING_PROGRESS_TRACKER) {
    return null; // Gracefully hide if feature is disabled
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Progress bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Setup Progress</span>
          <span className="font-medium">{progress.progressPercentage}%</span>
        </div>
        <Progress value={progress.progressPercentage} className="h-2" />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{progress.completedCount} of {progress.totalSteps} completed</span>
          <span>Almost there!</span>
        </div>
      </div>

      {/* Step list */}
      <div className="space-y-2">
        {progress.steps.map((step, index) => (
          <StepItem 
            key={step.id} 
            step={step} 
            isActive={step.id === progress.currentStepId}
            isPending={index > progress.steps.findIndex(s => s.id === progress.currentStepId)}
          />
        ))}
      </div>
    </div>
  );
}

interface StepItemProps {
  step: OnboardingStep;
  isActive: boolean;
  isPending: boolean;
}

function StepItem({ step, isActive, isPending }: StepItemProps) {
  const getIcon = () => {
    if (step.completed) return <Check className="h-3 w-3" />;
    if (isActive) return <ArrowRight className="h-3 w-3" />;
    return <Clock className="h-3 w-3" />;
  };

  const getVariant = () => {
    if (step.completed) return "default";
    if (isActive) return "secondary";
    return "outline";
  };

  return (
    <div className={`flex items-center space-x-3 p-2 rounded-md transition-colors ${
      isActive ? "bg-muted/50" : ""
    }`}>
      <Badge variant={getVariant()} className="flex items-center space-x-1">
        {getIcon()}
        <span className="text-xs">{step.title}</span>
      </Badge>
      
      {!step.required && (
        <Badge variant="outline" className="text-xs">
          Optional
        </Badge>
      )}
      
      <div className="flex-1 text-xs text-muted-foreground">
        {step.description}
      </div>
    </div>
  );
}

interface CompletionEstimateProps {
  estimate: string;
  className?: string;
}

export function CompletionEstimate({ estimate, className = "" }: CompletionEstimateProps) {
  if (!optimizationFlags.FEATURE_ONBOARDING_PROGRESS_TRACKER) {
    return null;
  }

  return (
    <div className={`flex items-center space-x-2 text-sm text-muted-foreground ${className}`}>
      <Clock className="h-4 w-4" />
      <span>Estimated time remaining: {estimate}</span>
    </div>
  );
}