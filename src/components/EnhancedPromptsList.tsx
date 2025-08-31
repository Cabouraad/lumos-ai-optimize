/**
 * Enhanced Prompts page with condensed UI behind FEATURE_LIGHT_UI
 * Maintains existing functionality while providing compact presentation
 */

import React, { useState, useEffect } from 'react';
import { PromptRow } from '@/components/PromptRow';
import { CondensedPromptRow } from '@/components/CondensedPromptRow';
import { isOptimizationFeatureEnabled } from '@/config/featureFlags';

// Mock data for testing - replace with actual data fetching
const mockPromptSummary = {
  totalRuns: 24,
  avgScore: 7.2,
  lastRun: '2024-01-15T10:30:00Z',
  competitorCount: 3,
  trend: 'up' as const,
  status: 'active' as const
};

export const EnhancedPromptsList: React.FC<{ prompts: any[] }> = ({ prompts }) => {
  const [expandedPrompts, setExpandedPrompts] = useState<Set<string>>(new Set());
  const isLightUI = isOptimizationFeatureEnabled('FEATURE_LIGHT_UI');
  const isA11y = isOptimizationFeatureEnabled('FEATURE_A11Y');

  const togglePrompt = (promptId: string) => {
    const newExpanded = new Set(expandedPrompts);
    if (newExpanded.has(promptId)) {
      newExpanded.delete(promptId);
    } else {
      newExpanded.add(promptId);
    }
    setExpandedPrompts(newExpanded);
  };

  // A11Y: Announce expansion state changes
  useEffect(() => {
    if (isA11y && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      // Optional: Announce significant state changes
      // Implementation would go here
    }
  }, [expandedPrompts.size, isA11y]);

  if (!isLightUI) {
    // Return existing implementation when flag is off
    return (
      <div className="space-y-4">
        {prompts.map((prompt) => (
          <PromptRow key={prompt.id} prompt={prompt} />
        ))}
      </div>
    );
  }

  return (
    <div 
      className="border border-border rounded-lg overflow-hidden"
      role={isA11y ? 'region' : undefined}
      aria-label={isA11y ? 'Prompts list with expandable details' : undefined}
    >
      {/* Header row for condensed view */}
      <div className="bg-muted/50 px-3 py-2 border-b border-border">
        <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
          <div className="flex-1">Prompt</div>
          <div className="flex items-center space-x-4">
            <span className="min-w-[3rem] text-center">Score</span>
            <span className="min-w-[4rem] text-center">Runs</span>
            <span className="min-w-[2rem] text-center">Trend</span>
            <span className="min-w-[3rem] text-center">Comp</span>
            <span className="min-w-[4rem] text-center">Status</span>
          </div>
        </div>
      </div>

      {prompts.map((prompt) => (
        <CondensedPromptRow
          key={prompt.id}
          prompt={{
            id: prompt.id,
            text: prompt.text,
            ...mockPromptSummary
          }}
          isExpanded={expandedPrompts.has(prompt.id)}
          onToggle={() => togglePrompt(prompt.id)}
        >
          {/* Existing PromptRow content when expanded */}
          <PromptRow prompt={prompt} />
        </CondensedPromptRow>
      ))}
    </div>
  );
};
