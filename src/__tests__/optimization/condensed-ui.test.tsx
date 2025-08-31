/**
 * Snapshot tests for condensed UI components
 */

import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CondensedPromptRow, CondensedRecentPromptCard } from '../CondensedPromptRow';
import { EnhancedPromptsList } from '../EnhancedPromptsList';
import { EnhancedRecentPromptsWidget } from '../EnhancedRecentPromptsWidget';

// Mock feature flags
const mockFeatureFlags = {
  FEATURE_LIGHT_UI: false,
  FEATURE_A11Y: false
};

vi.mock('@/config/featureFlags', () => ({
  isOptimizationFeatureEnabled: vi.fn((flag: string) => mockFeatureFlags[flag as keyof typeof mockFeatureFlags])
}));

const mockPromptData = {
  id: 'test-prompt-1',
  text: 'Compare HubSpot vs Salesforce for lead management',
  totalRuns: 24,
  avgScore: 7.2,
  lastRun: '2024-01-15T10:30:00Z',
  competitorCount: 3,
  trend: 'up' as const,
  status: 'active' as const
};

const mockRecentPrompt = {
  id: 'recent-1',
  text: 'Best marketing automation tools for small business',
  provider: 'OpenAI',
  score: 8.2,
  timestamp: '2024-01-15T10:30:00Z',
  status: 'success' as const
};

describe('CondensedPromptRow Snapshots', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFeatureFlags.FEATURE_LIGHT_UI = true;
    mockFeatureFlags.FEATURE_A11Y = false;
  });

  it('renders condensed row in collapsed state', () => {
    const { container } = render(
      <CondensedPromptRow
        prompt={mockPromptData}
        isExpanded={false}
        onToggle={() => {}}
      >
        <div>Detailed content</div>
      </CondensedPromptRow>
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  it('renders condensed row in expanded state', () => {
    const { container } = render(
      <CondensedPromptRow
        prompt={mockPromptData}
        isExpanded={true}
        onToggle={() => {}}
      >
        <div>Detailed content</div>
      </CondensedPromptRow>
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  it('renders with A11Y enhancements enabled', () => {
    mockFeatureFlags.FEATURE_A11Y = true;
    
    const { container } = render(
      <CondensedPromptRow
        prompt={mockPromptData}
        isExpanded={false}
        onToggle={() => {}}
      >
        <div>Detailed content</div>
      </CondensedPromptRow>
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  it('falls back to children when LIGHT_UI is disabled', () => {
    mockFeatureFlags.FEATURE_LIGHT_UI = false;
    
    const { container } = render(
      <CondensedPromptRow
        prompt={mockPromptData}
        isExpanded={false}
        onToggle={() => {}}
      >
        <div data-testid="original-content">Original content</div>
      </CondensedPromptRow>
    );
    expect(container.firstChild).toMatchSnapshot();
  });
});

describe('CondensedRecentPromptCard Snapshots', () => {
  beforeEach(() => {
    mockFeatureFlags.FEATURE_LIGHT_UI = true;
    mockFeatureFlags.FEATURE_A11Y = false;
  });

  it('renders recent prompt card', () => {
    const { container } = render(
      <CondensedRecentPromptCard prompt={mockRecentPrompt} />
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  it('renders with A11Y attributes', () => {
    mockFeatureFlags.FEATURE_A11Y = true;
    
    const { container } = render(
      <CondensedRecentPromptCard prompt={mockRecentPrompt} />
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  it('renders different status variants', () => {
    const errorPrompt = { ...mockRecentPrompt, status: 'error' as const };
    const { container } = render(
      <CondensedRecentPromptCard prompt={errorPrompt} />
    );
    expect(container.firstChild).toMatchSnapshot();
  });
});

describe('EnhancedPromptsList Snapshots', () => {
  const mockPrompts = [
    { id: '1', text: 'First prompt text' },
    { id: '2', text: 'Second prompt text' },
    { id: '3', text: 'Third prompt text' }
  ];

  beforeEach(() => {
    mockFeatureFlags.FEATURE_LIGHT_UI = true;
    mockFeatureFlags.FEATURE_A11Y = false;
  });

  it('renders enhanced prompts list', () => {
    const { container } = render(
      <EnhancedPromptsList prompts={mockPrompts} />
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  it('renders with A11Y region attributes', () => {
    mockFeatureFlags.FEATURE_A11Y = true;
    
    const { container } = render(
      <EnhancedPromptsList prompts={mockPrompts} />
    );
    expect(container.firstChild).toMatchSnapshot();
  });
});

describe('EnhancedRecentPromptsWidget Snapshots', () => {
  const mockPrompts = [mockRecentPrompt];

  beforeEach(() => {
    mockFeatureFlags.FEATURE_LIGHT_UI = true;
    mockFeatureFlags.FEATURE_A11Y = false;
  });

  it('renders enhanced recent prompts widget', () => {
    const { container } = render(
      <EnhancedRecentPromptsWidget prompts={mockPrompts} />
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  it('renders with A11Y list attributes', () => {
    mockFeatureFlags.FEATURE_A11Y = true;
    
    const { container } = render(
      <EnhancedRecentPromptsWidget prompts={mockPrompts} />
    );
    expect(container.firstChild).toMatchSnapshot();
  });
});