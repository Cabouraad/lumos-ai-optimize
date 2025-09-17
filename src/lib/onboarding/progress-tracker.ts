/**
 * Onboarding Progress Tracker
 * 
 * SAFETY: Pure UI enhancement, no logic modification.
 * Tracks progress in sessionStorage for recovery.
 * Enhanced error messaging and user guidance.
 */

import { optimizationFlags, withFeatureFlag } from '@/config/featureFlags';

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  required: boolean;
  completed: boolean;
  skippable: boolean;
}

export interface OnboardingProgress {
  currentStepId: string;
  steps: OnboardingStep[];
  completedSteps: string[];
  startedAt: number;
  lastUpdatedAt: number;
  totalSteps: number;
  completedCount: number;
  progressPercentage: number;
}

class OnboardingProgressTracker {
  private readonly STORAGE_KEY = 'llumos-onboarding-progress';
  private readonly DEFAULT_STEPS: OnboardingStep[] = [
    {
      id: 'basic-info',
      title: 'Basic Information',
      description: 'Organization name and domain',
      required: true,
      completed: false,
      skippable: false
    },
    {
      id: 'business-context',
      title: 'Business Context',
      description: 'Keywords, description, and target audience',
      required: true,
      completed: false,
      skippable: false
    },
    {
      id: 'pricing-selection',
      title: 'Plan Selection',
      description: 'Choose your subscription plan',
      required: true,
      completed: false,
      skippable: false
    },
    {
      id: 'subscription-setup',
      title: 'Subscription Setup',
      description: 'Complete payment and subscription',
      required: true,
      completed: false,
      skippable: false
    },
    {
      id: 'ai-suggestions',
      title: 'AI Suggestions',
      description: 'Generate initial prompt suggestions',
      required: false,
      completed: false,
      skippable: true
    }
  ];

  /**
   * Initialize or restore progress from storage
   */
  initializeProgress(): OnboardingProgress {
    return withFeatureFlag(
      'FEATURE_ONBOARDING_PROGRESS_TRACKER',
      () => {
        const saved = this.loadProgress();
        if (saved) {
          console.log('[OnboardingTracker] Restored progress from storage');
          return this.calculateProgress(saved);
        }

        const initial: OnboardingProgress = {
          currentStepId: this.DEFAULT_STEPS[0].id,
          steps: [...this.DEFAULT_STEPS],
          completedSteps: [],
          startedAt: Date.now(),
          lastUpdatedAt: Date.now(),
          totalSteps: this.DEFAULT_STEPS.length,
          completedCount: 0,
          progressPercentage: 0
        };

        this.saveProgress(initial);
        console.log('[OnboardingTracker] Initialized new progress');
        return initial;
      },
      () => {
        // Fallback: Return minimal progress object
        return {
          currentStepId: 'basic-info',
          steps: this.DEFAULT_STEPS,
          completedSteps: [],
          startedAt: Date.now(),
          lastUpdatedAt: Date.now(),
          totalSteps: this.DEFAULT_STEPS.length,
          completedCount: 0,
          progressPercentage: 0
        };
      },
      'onboarding-progress-init'
    );
  }

  /**
   * Mark a step as completed and advance progress
   */
  completeStep(stepId: string, formData?: any): OnboardingProgress {
    return withFeatureFlag(
      'FEATURE_ONBOARDING_PROGRESS_TRACKER',
      () => {
        const current = this.loadProgress() || this.initializeProgress();
        
        // Mark step as completed
        current.steps = current.steps.map(step => 
          step.id === stepId ? { ...step, completed: true } : step
        );

        // Add to completed list if not already there
        if (!current.completedSteps.includes(stepId)) {
          current.completedSteps.push(stepId);
        }

        // Update timestamp
        current.lastUpdatedAt = Date.now();

        // Calculate next step
        const currentIndex = current.steps.findIndex(s => s.id === stepId);
        const nextStep = current.steps[currentIndex + 1];
        if (nextStep) {
          current.currentStepId = nextStep.id;
        }

        // Save form data if provided
        if (formData) {
          this.saveFormData(formData);
        }

        const updated = this.calculateProgress(current);
        this.saveProgress(updated);
        
        console.log(`[OnboardingTracker] Step '${stepId}' completed. Progress: ${updated.progressPercentage}%`);
        return updated;
      },
      () => this.initializeProgress(), // Fallback
      'onboarding-step-complete'
    );
  }

  /**
   * Get current progress without modifying state
   */
  getCurrentProgress(): OnboardingProgress {
    return withFeatureFlag(
      'FEATURE_ONBOARDING_PROGRESS_TRACKER',
      () => {
        const saved = this.loadProgress();
        return saved ? this.calculateProgress(saved) : this.initializeProgress();
      },
      () => this.initializeProgress(), // Fallback
      'onboarding-get-progress'
    );
  }

  /**
   * Get saved form data for recovery
   */
  getFormData(): any {
    if (!optimizationFlags.FEATURE_ONBOARDING_PROGRESS_TRACKER) return null;
    
    try {
      const saved = sessionStorage.getItem('llumos-onboarding-form-data');
      return saved ? JSON.parse(saved) : null;
    } catch (error) {
      console.warn('[OnboardingTracker] Failed to load form data:', error);
      return null;
    }
  }

  /**
   * Clear all progress and form data
   */
  clearProgress(): void {
    if (!optimizationFlags.FEATURE_ONBOARDING_PROGRESS_TRACKER) return;
    
    try {
      sessionStorage.removeItem(this.STORAGE_KEY);
      sessionStorage.removeItem('llumos-onboarding-form-data');
      console.log('[OnboardingTracker] Progress cleared');
    } catch (error) {
      console.warn('[OnboardingTracker] Failed to clear progress:', error);
    }
  }

  /**
   * Get completion estimate based on current progress
   */
  getCompletionEstimate(progress: OnboardingProgress): string {
    const avgTimePerStep = 2; // 2 minutes per step
    const remainingSteps = progress.totalSteps - progress.completedCount;
    const estimatedMinutes = remainingSteps * avgTimePerStep;
    
    if (estimatedMinutes <= 2) return 'Less than 2 minutes';
    if (estimatedMinutes <= 5) return 'About 5 minutes';
    if (estimatedMinutes <= 10) return 'About 10 minutes';
    return `About ${estimatedMinutes} minutes`;
  }

  private calculateProgress(progress: OnboardingProgress): OnboardingProgress {
    const completedCount = progress.completedSteps.length;
    const progressPercentage = Math.round((completedCount / progress.totalSteps) * 100);
    
    return {
      ...progress,
      completedCount,
      progressPercentage
    };
  }

  private loadProgress(): OnboardingProgress | null {
    try {
      const saved = sessionStorage.getItem(this.STORAGE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch (error) {
      console.warn('[OnboardingTracker] Failed to load progress:', error);
      return null;
    }
  }

  private saveProgress(progress: OnboardingProgress): void {
    try {
      sessionStorage.setItem(this.STORAGE_KEY, JSON.stringify(progress));
    } catch (error) {
      console.warn('[OnboardingTracker] Failed to save progress:', error);
    }
  }

  private saveFormData(formData: any): void {
    try {
      sessionStorage.setItem('llumos-onboarding-form-data', JSON.stringify(formData));
    } catch (error) {
      console.warn('[OnboardingTracker] Failed to save form data:', error);
    }
  }
}

// Global instance
export const onboardingTracker = new OnboardingProgressTracker();