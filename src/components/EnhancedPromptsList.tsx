/**
 * Enhanced Prompts List with condensed UI support
 */

import React from 'react';
import { isOptimizationFeatureEnabled } from '@/config/featureFlags';

interface EnhancedPromptsListProps {
  prompts: any[];
}

export const EnhancedPromptsList: React.FC<EnhancedPromptsListProps> = ({ prompts }) => {
  const isLightUI = isOptimizationFeatureEnabled('FEATURE_LIGHT_UI');
  const isA11y = isOptimizationFeatureEnabled('FEATURE_A11Y');

  return (
    <div 
      className="space-y-2"
      role={isA11y ? 'list' : undefined}
      aria-label={isA11y ? `${prompts.length} prompts` : undefined}
    >
      {prompts.map((prompt, index) => (
        <div 
          key={prompt.id}
          className="p-4 border border-border rounded"
          role={isA11y ? 'listitem' : undefined}
          aria-posinset={isA11y ? index + 1 : undefined}
          aria-setsize={isA11y ? prompts.length : undefined}
        >
          <p className="text-sm">{prompt.text || 'Prompt content'}</p>
          {isLightUI && (
            <div className="mt-2 text-xs text-muted-foreground">
              Condensed view active
            </div>
          )}
        </div>
      ))}
    </div>
  );
};