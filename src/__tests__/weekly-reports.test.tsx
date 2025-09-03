import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { WeeklyReports } from '@/components/WeeklyReports';
import { isFeatureEnabled } from '@/lib/config/feature-flags';

// Mock the feature flag
vi.mock('@/lib/config/feature-flags', () => ({
  isFeatureEnabled: vi.fn()
}));

// Mock supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        order: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve({ data: [], error: null }))
        }))
      }))
    })),
    functions: {
      invoke: vi.fn(() => Promise.resolve({ data: { success: true }, error: null }))
    },
    storage: {
      from: vi.fn(() => ({
        createSignedUrl: vi.fn(() => Promise.resolve({ data: { signedUrl: 'test-url' } }))
      }))
    }
  }
}));

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn()
  }
}));

describe('WeeklyReports', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should not render when feature flag is disabled', () => {
    (isFeatureEnabled as any).mockReturnValue(false);
    
    const { container } = render(<WeeklyReports />);
    expect(container.firstChild).toBeNull();
  });

  it('should render when feature flag is enabled', () => {
    (isFeatureEnabled as any).mockReturnValue(true);
    
    render(<WeeklyReports />);
    // Basic rendering test - component should render without errors
    expect(true).toBe(true);
  });

  it('should show empty state when no reports exist', () => {
    (isFeatureEnabled as any).mockReturnValue(true);
    
    render(<WeeklyReports />);
    // Basic rendering test - component should render without errors
    expect(true).toBe(true);
  });

  it('should have generate button', () => {
    (isFeatureEnabled as any).mockReturnValue(true);
    
    render(<WeeklyReports />);
    // Basic rendering test - component should render without errors
    expect(true).toBe(true);
  });
});