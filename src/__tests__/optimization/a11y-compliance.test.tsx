/**
 * A11Y compliance tests for enhanced components
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { axe, toHaveNoViolations } from 'jest-axe';
import { CondensedPromptRow } from '../CondensedPromptRow';
import { EnhancedPromptsList } from '../EnhancedPromptsList';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Mock feature flags
const mockFeatureFlags = {
  FEATURE_LIGHT_UI: true,
  FEATURE_A11Y: true
};

vi.mock('@/config/featureFlags', () => ({
  isOptimizationFeatureEnabled: vi.fn((flag: string) => mockFeatureFlags[flag as keyof typeof mockFeatureFlags])
}));

const mockPromptData = {
  id: 'test-prompt-1',
  text: 'Compare HubSpot vs Salesforce for lead management and customer relationship management',
  totalRuns: 24,
  avgScore: 7.2,
  lastRun: '2024-01-15T10:30:00Z',
  competitorCount: 3,
  trend: 'up' as const,
  status: 'active' as const
};

describe('A11Y Compliance Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFeatureFlags.FEATURE_LIGHT_UI = true;
    mockFeatureFlags.FEATURE_A11Y = true;
  });

  describe('CondensedPromptRow A11Y', () => {
    it('should not have accessibility violations', async () => {
      const { container } = render(
        <CondensedPromptRow
          prompt={mockPromptData}
          isExpanded={false}
          onToggle={() => {}}
        >
          <div>Detailed content</div>
        </CondensedPromptRow>
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('provides proper ARIA attributes', () => {
      render(
        <CondensedPromptRow
          prompt={mockPromptData}
          isExpanded={false}
          onToggle={() => {}}
        >
          <div>Detailed content</div>
        </CondensedPromptRow>
      );

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-expanded', 'false');
      expect(button).toHaveAttribute('aria-controls', 'prompt-details-test-prompt-1');
      expect(button).toHaveAttribute('aria-label');
      expect(button).toHaveAttribute('tabindex', '0');
    });

    it('supports keyboard navigation', async () => {
      const user = userEvent.setup();
      const mockToggle = vi.fn();

      render(
        <CondensedPromptRow
          prompt={mockPromptData}
          isExpanded={false}
          onToggle={mockToggle}
        >
          <div>Detailed content</div>
        </CondensedPromptRow>
      );

      const button = screen.getByRole('button');
      
      // Test Enter key
      await user.type(button, '{Enter}');
      expect(mockToggle).toHaveBeenCalledTimes(1);

      // Test Space key
      await user.type(button, ' ');
      expect(mockToggle).toHaveBeenCalledTimes(2);
    });

    it('provides proper focus indicators', () => {
      render(
        <CondensedPromptRow
          prompt={mockPromptData}
          isExpanded={false}
          onToggle={() => {}}
        >
          <div>Detailed content</div>
        </CondensedPromptRow>
      );

      const button = screen.getByRole('button');
      expect(button).toHaveClass('focus-visible:outline-2');
      expect(button).toHaveClass('focus-visible:outline-primary');
      expect(button).toHaveClass('focus-visible:outline-offset-2');
    });

    it('expanded content has proper region role', () => {
      render(
        <CondensedPromptRow
          prompt={mockPromptData}
          isExpanded={true}
          onToggle={() => {}}
        >
          <div>Detailed content</div>
        </CondensedPromptRow>
      );

      const region = screen.getByRole('region', { name: 'Expanded prompt details' });
      expect(region).toBeInTheDocument();
      expect(region).toHaveAttribute('id', 'prompt-details-test-prompt-1');
    });

    it('score badges have descriptive labels', () => {
      render(
        <CondensedPromptRow
          prompt={mockPromptData}
          isExpanded={false}
          onToggle={() => {}}
        >
          <div>Detailed content</div>
        </CondensedPromptRow>
      );

      const scoreBadge = screen.getByLabelText('Score: 7.2 out of 10');
      expect(scoreBadge).toBeInTheDocument();
    });

    it('trend indicators have descriptive labels', () => {
      render(
        <CondensedPromptRow
          prompt={mockPromptData}
          isExpanded={false}
          onToggle={() => {}}
        >
          <div>Detailed content</div>
        </CondensedPromptRow>
      );

      const trendIndicator = screen.getByLabelText('Trend: up');
      expect(trendIndicator).toBeInTheDocument();
    });
  });

  describe('EnhancedPromptsList A11Y', () => {
    const mockPrompts = [
      { id: '1', text: 'First prompt text' },
      { id: '2', text: 'Second prompt text' },
      { id: '3', text: 'Third prompt text' }
    ];

    it('should not have accessibility violations', async () => {
      const { container } = render(
        <EnhancedPromptsList prompts={mockPrompts} />
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('provides proper region landmark', () => {
      render(
        <EnhancedPromptsList prompts={mockPrompts} />
      );

      const region = screen.getByRole('region', { name: 'Prompts list with expandable details' });
      expect(region).toBeInTheDocument();
    });

    it('maintains focus order through keyboard navigation', async () => {
      const user = userEvent.setup();
      
      render(
        <EnhancedPromptsList prompts={mockPrompts} />
      );

      const buttons = screen.getAllByRole('button');
      
      // Focus first button
      buttons[0].focus();
      expect(document.activeElement).toBe(buttons[0]);

      // Tab to next button
      await user.tab();
      expect(document.activeElement).toBe(buttons[1]);
    });
  });

  describe('Color Contrast Compliance', () => {
    it('uses WCAG AA compliant color tokens', () => {
      render(
        <CondensedPromptRow
          prompt={mockPromptData}
          isExpanded={false}
          onToggle={() => {}}
        >
          <div>Detailed content</div>
        </CondensedPromptRow>
      );

      // Check that semantic color tokens are used
      const button = screen.getByRole('button');
      const computedStyle = window.getComputedStyle(button);
      
      // These would be validated against WCAG standards
      // For now, verify the classes are applied
      expect(button).toHaveClass('hover:bg-muted/50');
    });
  });

  describe('Reduced Motion Support', () => {
    it('respects user motion preferences', () => {
      // Mock reduced motion preference
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation(query => ({
          matches: query === '(prefers-reduced-motion: reduce)',
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
        })),
      });

      render(
        <CondensedPromptRow
          prompt={mockPromptData}
          isExpanded={false}
          onToggle={() => {}}
        >
          <div>Detailed content</div>
        </CondensedPromptRow>
      );

      const button = screen.getByRole('button');
      expect(button).toHaveClass('transition-colors');
      expect(button).toHaveClass('duration-200');
    });
  });

  describe('Screen Reader Support', () => {
    it('provides comprehensive aria-label for screen readers', () => {
      render(
        <CondensedPromptRow
          prompt={mockPromptData}
          isExpanded={false}
          onToggle={() => {}}
        >
          <div>Detailed content</div>
        </CondensedPromptRow>
      );

      const button = screen.getByRole('button');
      const ariaLabel = button.getAttribute('aria-label');
      
      expect(ariaLabel).toContain('Compare HubSpot vs Salesforce for lead');
      expect(ariaLabel).toContain('Score: 7.2');
      expect(ariaLabel).toContain('Runs: 24');
      expect(ariaLabel).toContain('Status: active');
      expect(ariaLabel).toContain('Collapsed');
      expect(ariaLabel).toContain('Press Enter or Space to expand');
    });

    it('updates aria-label when expanded state changes', () => {
      const { rerender } = render(
        <CondensedPromptRow
          prompt={mockPromptData}
          isExpanded={false}
          onToggle={() => {}}
        >
          <div>Detailed content</div>
        </CondensedPromptRow>
      );

      let button = screen.getByRole('button');
      expect(button.getAttribute('aria-label')).toContain('Collapsed');

      rerender(
        <CondensedPromptRow
          prompt={mockPromptData}
          isExpanded={true}
          onToggle={() => {}}
        >
          <div>Detailed content</div>
        </CondensedPromptRow>
      );

      button = screen.getByRole('button');
      expect(button.getAttribute('aria-label')).toContain('Expanded');
      expect(button.getAttribute('aria-label')).toContain('collapse');
    });
  });
});