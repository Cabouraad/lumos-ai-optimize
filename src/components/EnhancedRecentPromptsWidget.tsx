/**
 * Enhanced Recent Prompts Widget with condensed UI
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CondensedRecentPromptCard } from '@/components/CondensedPromptRow';
import { RecentPromptsWidget } from '@/components/RecentPromptsWidget';
import { isOptimizationFeatureEnabled } from '@/config/featureFlags';

// Mock recent prompts data
const mockRecentPrompts = [
  {
    id: '1',
    text: 'Compare HubSpot vs Salesforce for lead management',
    provider: 'OpenAI',
    score: 8.2,
    timestamp: '2024-01-15T10:30:00Z',
    status: 'success' as const
  },
  {
    id: '2', 
    text: 'Best marketing automation tools for small business',
    provider: 'Gemini',
    score: 6.8,
    timestamp: '2024-01-15T09:15:00Z',
    status: 'success' as const
  },
  {
    id: '3',
    text: 'Enterprise CRM solutions comparison',
    provider: 'Perplexity',
    score: 7.5,
    timestamp: '2024-01-15T08:45:00Z',
    status: 'processing' as const
  }
];

interface EnhancedRecentPromptsWidgetProps {
  prompts?: any[]; // Accept external prompts data
}

export const EnhancedRecentPromptsWidget: React.FC<EnhancedRecentPromptsWidgetProps> = ({ 
  prompts = mockRecentPrompts 
}) => {
  const isLightUI = isOptimizationFeatureEnabled('FEATURE_LIGHT_UI');
  const isA11y = isOptimizationFeatureEnabled('FEATURE_A11Y');

  if (!isLightUI) {
    // Return existing widget when flag is off
    return <RecentPromptsWidget />;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle 
          className="text-lg"
          id={isA11y ? 'recent-prompts-title' : undefined}
        >
          Recent Prompts
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div 
          className="space-y-2"
          role={isA11y ? 'list' : undefined}
          aria-labelledby={isA11y ? 'recent-prompts-title' : undefined}
          aria-description={isA11y ? `${prompts.length} recent prompts` : undefined}
        >
          {prompts.map((prompt, index) => (
            <div 
              key={prompt.id}
              role={isA11y ? 'listitem' : undefined}
              aria-posinset={isA11y ? index + 1 : undefined}
              aria-setsize={isA11y ? prompts.length : undefined}
            >
              <CondensedRecentPromptCard prompt={prompt} />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};