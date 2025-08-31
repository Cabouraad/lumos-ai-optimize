import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CondensedPromptRow } from '../components/CondensedPromptRow';

// Mock feature flags
vi.mock('@/lib/config/feature-flags', () => ({
  isFeatureEnabled: vi.fn((flag: string) => {
    const flags = {
      'FEATURE_CONDENSED_UI': true,
      'FEATURE_SCHEDULING_NOTICES': true
    };
    return flags[flag as keyof typeof flags] || false;
  })
}));

// Mock date-fns
vi.mock('date-fns', () => ({
  format: vi.fn((date: Date, formatStr: string) => {
    if (formatStr === 'MMM d') return 'Jan 15';
    if (formatStr === 'MMM d, yyyy') return 'Jan 15, 2024';
    return '2024-01-15';
  })
}));

describe('Condensed UI Components', () => {
  const mockPrompt = {
    id: 'test-prompt-1',
    text: 'What are the best CRM solutions for small businesses?',
    active: true,
    created_at: '2024-01-15T10:00:00Z',
    runs_7d: 25,
    avg_score_7d: 6.8
  };

  const mockPromptDetails = {
    providers: {
      openai: {
        status: 'success',
        score: 7.2,
        org_brand_present: true,
        competitors_count: 3,
        run_at: '2024-01-14T10:00:00Z'
      },
      gemini: {
        status: 'success',
        score: 6.4,
        org_brand_present: false,
        competitors_count: 5,
        run_at: '2024-01-13T10:00:00Z'
      }
    }
  };

  const mockProps = {
    prompt: mockPrompt,
    promptDetails: mockPromptDetails,
    onEdit: vi.fn(),
    onToggleActive: vi.fn(),
    onDeletePrompt: vi.fn(),
    onDuplicatePrompt: vi.fn(),
    isSelected: false,
    onSelect: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render condensed layout when feature flag is enabled', () => {
    render(<CondensedPromptRow {...mockProps} />);
    
    // Should show prompt text in single line
    expect(screen.getByText(mockPrompt.text)).toBeInTheDocument();
    expect(screen.getByText(mockPrompt.text)).toHaveClass('line-clamp-1');
    
    // Should show condensed metrics in single row
    expect(screen.getByText('25')).toBeInTheDocument(); // runs
    expect(screen.getByText('6.8')).toBeInTheDocument(); // avg score
    expect(screen.getByText('1')).toBeInTheDocument(); // brand visible
    expect(screen.getByText('8')).toBeInTheDocument(); // total competitors
  });

  it('should display scheduling notices when enabled', () => {
    render(<CondensedPromptRow {...mockProps} />);
    
    // Should show scheduling notice for active prompts
    expect(screen.getByText(/Next scheduled run/)).toBeInTheDocument();
    expect(screen.getByText(/3:00 AM ET/)).toBeInTheDocument();
    expect(screen.getByText('Daily')).toBeInTheDocument();
  });

  it('should not show scheduling notices for inactive prompts', () => {
    const inactiveProps = {
      ...mockProps,
      prompt: { ...mockPrompt, active: false }
    };
    
    render(<CondensedPromptRow {...inactiveProps} />);
    
    // Should not show scheduling notice
    expect(screen.queryByText(/Next scheduled run/)).not.toBeInTheDocument();
  });

  it('should handle expand/collapse functionality', () => {
    render(<CondensedPromptRow {...mockProps} />);
    
    // Should start collapsed
    expect(screen.getByText('Details')).toBeInTheDocument();
    expect(screen.queryByText('Provider Results')).not.toBeInTheDocument();
    
    // Click to expand
    fireEvent.click(screen.getByText('Details'));
    
    // Should show expanded content
    expect(screen.getByText('Less')).toBeInTheDocument();
    expect(screen.getByText('Provider Results')).toBeInTheDocument();
  });

  it('should calculate performance metrics correctly', () => {
    render(<CondensedPromptRow {...mockProps} />);
    
    // Should calculate from provider data
    // 1 brand visible (openai), 8 total competitors (3+5)
    expect(screen.getByText('1')).toBeInTheDocument(); // brand visible
    expect(screen.getByText('8')).toBeInTheDocument(); // competitors
    
    // Average score from valid providers: (7.2 + 6.4) / 2 = 6.8
    expect(screen.getByText('6.8')).toBeInTheDocument();
  });

  it('should handle missing prompt details gracefully', () => {
    const propsWithoutDetails = {
      ...mockProps,
      promptDetails: null
    };
    
    render(<CondensedPromptRow {...propsWithoutDetails} />);
    
    // Should show zeros for missing data
    expect(screen.getByText('0')).toBeInTheDocument(); // should appear multiple times
    
    // Should not show expand/collapse
    expect(screen.queryByText('Details')).not.toBeInTheDocument();
  });

  it('should display correct status badges', () => {
    render(<CondensedPromptRow {...mockProps} />);
    
    // Active prompt should show Active badge
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Active')).toHaveClass('bg-success/10', 'text-success');
  });

  it('should handle pause/play toggle', () => {
    render(<CondensedPromptRow {...mockProps} />);
    
    const toggleButton = screen.getByRole('button');
    fireEvent.click(toggleButton);
    
    expect(mockProps.onToggleActive).toHaveBeenCalledWith('test-prompt-1', false);
  });

  it('should handle selection checkbox', () => {
    render(<CondensedPromptRow {...mockProps} />);
    
    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);
    
    expect(mockProps.onSelect).toHaveBeenCalledWith(true);
  });

  it('should format dates correctly', () => {
    render(<CondensedPromptRow {...mockProps} />);
    
    // Should show formatted date
    expect(screen.getByText('Jan 15')).toBeInTheDocument();
  });

  it('should handle zero performance metrics', () => {
    const propsWithZeroMetrics = {
      ...mockProps,
      promptDetails: {
        providers: {
          openai: {
            status: 'failed',
            score: null,
            org_brand_present: false,
            competitors_count: 0,
            run_at: '2024-01-01T10:00:00Z' // old date
          }
        }
      }
    };
    
    render(<CondensedPromptRow {...propsWithZeroMetrics} />);
    
    // Should handle zero metrics gracefully
    expect(screen.getByText('0.0')).toBeInTheDocument(); // avg score
    expect(screen.getByText('0')).toBeInTheDocument(); // brand visible and competitors
  });

  it('should apply correct styling classes', () => {
    render(<CondensedPromptRow {...mockProps} />);
    
    // Should have proper condensed styling
    const card = screen.getByText(mockPrompt.text).closest('[class*="hover:shadow-sm"]');
    expect(card).toBeInTheDocument();
    
    // Should have border accent
    expect(card).toHaveClass('border-l-2');
  });

  it('should show provider results in expanded state', () => {
    render(<CondensedPromptRow {...mockProps} />);
    
    // Expand
    fireEvent.click(screen.getByText('Details'));
    
    // Should show provider results section
    expect(screen.getByText('Provider Results')).toBeInTheDocument();
    
    // Should render provider response cards (mocked)
    expect(screen.getByText('Provider Results')).toBeInTheDocument();
  });

  it('should respect feature flag for scheduling notices', () => {
    // Mock feature flag as disabled
    const { isFeatureEnabled } = vi.mocked(await import('@/lib/config/feature-flags'));
    isFeatureEnabled.mockImplementation((flag: string) => {
      if (flag === 'FEATURE_SCHEDULING_NOTICES') return false;
      if (flag === 'FEATURE_CONDENSED_UI') return true;
      return false;
    });
    
    render(<CondensedPromptRow {...mockProps} />);
    
    // Should not show scheduling notice when flag is off
    expect(screen.queryByText(/Next scheduled run/)).not.toBeInTheDocument();
  });
});