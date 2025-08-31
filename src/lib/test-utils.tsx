import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Re-export testing utilities
export { render, userEvent };

// Mock data helpers for tests
export const createMockPromptData = (overrides = {}) => ({
  id: 'test-prompt-1',
  text: 'Compare HubSpot vs Salesforce for lead management',
  active: true,
  created_at: '2024-01-15T10:30:00Z',
  totalRuns: 24,
  avgScore: 7.2,
  lastRun: '2024-01-15T10:30:00Z',
  competitorCount: 3,
  trend: 'up' as const,
  status: 'active' as const,
  ...overrides
});

export const createMockProviderData = (overrides = {}) => ({
  id: 'test-1',
  prompt_id: 'prompt-1',
  provider: 'openai',
  model: 'gpt-4',
  run_at: '2024-01-15T10:30:00Z',
  score: 7.5,
  status: 'completed',
  org_brand_present: true,
  org_brand_prominence: 'high',
  competitors_count: 2,
  competitors_json: ['HubSpot', 'Salesforce'],
  brands_json: ['TechCorp'],
  raw_ai_response: 'Sample AI response',
  error: null,
  token_in: 150,
  token_out: 200,
  ...overrides
});

// Feature flag helpers
export const mockFeatureFlags = (flags: Record<string, boolean>) => {
  const vi = (globalThis as any).vi;
  if (vi) {
    vi.mock('@/config/featureFlags', () => ({
      isOptimizationFeatureEnabled: vi.fn((flag: string) => flags[flag] || false)
    }));
  }
};