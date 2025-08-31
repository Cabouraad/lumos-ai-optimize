import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ProviderResponseCard } from '../../components/ProviderResponseCard';

// Mock feature flags
const mockFeatureFlags = {
  FEATURE_RESPONSE_CACHE: true
};

vi.mock('@/config/featureFlags', () => ({
  isOptimizationFeatureEnabled: vi.fn((flag: string) => mockFeatureFlags[flag as keyof typeof mockFeatureFlags])
}));

// Mock the cache module
const mockMemoizeJsonParsing = vi.fn((parser) => parser);
vi.mock('@/lib/cache/response-cache', () => ({
  memoizeJsonParsing: mockMemoizeJsonParsing
}));

// Mock other UI components
vi.mock('@/components/ui/card', () => ({
  Card: ({ children, className }: any) => <div className={className}>{children}</div>,
  CardContent: ({ children }: any) => <div>{children}</div>,
  CardHeader: ({ children }: any) => <div>{children}</div>,
  CardTitle: ({ children }: any) => <div>{children}</div>
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: any) => <span>{children}</span>
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick }: any) => <button onClick={onClick}>{children}</button>
}));

vi.mock('@/components/ProviderLogo', () => ({
  ProviderLogo: ({ provider }: any) => <div data-testid={`provider-logo-${provider}`}>{provider}</div>
}));

vi.mock('@/components/CompetitorChip', () => ({
  CompetitorChipList: ({ competitors }: any) => (
    <div data-testid="competitor-list">
      {competitors.map((comp: string, i: number) => (
        <span key={i}>{comp}</span>
      ))}
    </div>
  )
}));

describe('ProviderResponseCard Optimization', () => {
  const mockResponse = {
    id: 'response-1',
    provider: 'openai',
    score: 7.5,
    status: 'success',
    run_at: '2024-01-01T10:00:00Z',
    org_brand_present: true,
    competitors_count: 3,
    competitors_json: ['Competitor A', 'Competitor B', 'Competitor C'],
    brands_json: ['Brand A', 'Brand B'],
    raw_ai_response: 'AI response text'
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockFeatureFlags.FEATURE_RESPONSE_CACHE = true;
  });

  describe('JSON Parsing Optimization', () => {
    it('should use memoized JSON parsing when feature enabled', () => {
      render(
        <ProviderResponseCard 
          provider="openai" 
          response={mockResponse} 
          promptText="test prompt" 
        />
      );

      expect(mockMemoizeJsonParsing).toHaveBeenCalled();
    });

    it('should memoize competitors and brands separately', () => {
      const { rerender } = render(
        <ProviderResponseCard 
          provider="openai" 
          response={mockResponse} 
          promptText="test prompt" 
        />
      );

      // Clear the mock to count subsequent calls
      mockMemoizeJsonParsing.mockClear();

      // Re-render with same data - should use memoized values
      rerender(
        <ProviderResponseCard 
          provider="openai" 
          response={mockResponse} 
          promptText="test prompt" 
        />
      );

      // The memoized parser should have been created but not called again for same data
      expect(mockMemoizeJsonParsing).toHaveBeenCalledTimes(2); // Once for competitors, once for brands
    });

    it('should handle missing JSON data gracefully', () => {
      const responseWithoutJson = {
        ...mockResponse,
        competitors_json: undefined,
        brands_json: undefined
      };

      const { getByTestId } = render(
        <ProviderResponseCard 
          provider="openai" 
          response={responseWithoutJson} 
          promptText="test prompt" 
        />
      );

      // Should still render without errors
      expect(getByTestId('provider-logo-openai')).toBeInTheDocument();
    });
  });

  describe('Performance Characteristics', () => {
    it('should avoid repeated JSON parsing on re-renders', () => {
      const parseCounter = vi.fn((json: string) => JSON.parse(json));
      mockMemoizeJsonParsing.mockImplementation((parser) => {
        return vi.fn((json) => {
          parseCounter(json);
          return parser(json);
        });
      });

      const { rerender } = render(
        <ProviderResponseCard 
          provider="openai" 
          response={mockResponse} 
          promptText="test prompt" 
        />
      );

      const initialParseCount = parseCounter.mock.calls.length;

      // Re-render multiple times with same data
      rerender(<ProviderResponseCard provider="openai" response={mockResponse} promptText="test prompt" />);
      rerender(<ProviderResponseCard provider="openai" response={mockResponse} promptText="test prompt" />);
      rerender(<ProviderResponseCard provider="openai" response={mockResponse} promptText="test prompt" />);

      // Parse count should not increase significantly (memoization working)
      const finalParseCount = parseCounter.mock.calls.length;
      expect(finalParseCount).toBeLessThanOrEqual(initialParseCount + 2); // Only minimal additional parsing
    });

    it('should handle large competitor lists efficiently', () => {
      const largeCompetitorList = Array.from({ length: 100 }, (_, i) => `Competitor ${i}`);
      const responseWithLargeList = {
        ...mockResponse,
        competitors_json: largeCompetitorList
      };

      const startTime = performance.now();
      
      render(
        <ProviderResponseCard 
          provider="openai" 
          response={responseWithLargeList} 
          promptText="test prompt" 
        />
      );

      const renderTime = performance.now() - startTime;
      
      // Should render large lists quickly (under 100ms)
      expect(renderTime).toBeLessThan(100);
    });
  });

  describe('Feature Flag Integration', () => {
    it('should work normally when caching disabled', () => {
      mockFeatureFlags.FEATURE_RESPONSE_CACHE = false;
      
      const { getByTestId } = render(
        <ProviderResponseCard 
          provider="openai" 
          response={mockResponse} 
          promptText="test prompt" 
        />
      );

      expect(getByTestId('provider-logo-openai')).toBeInTheDocument();
      expect(getByTestId('competitor-list')).toBeInTheDocument();
    });

    it('should maintain functionality regardless of feature flag state', () => {
      // Test with feature enabled
      mockFeatureFlags.FEATURE_RESPONSE_CACHE = true;
      const { getByTestId: getByTestIdEnabled } = render(
        <ProviderResponseCard 
          provider="openai" 
          response={mockResponse} 
          promptText="test prompt" 
        />
      );

      // Test with feature disabled
      mockFeatureFlags.FEATURE_RESPONSE_CACHE = false;
      const { getByTestId: getByTestIdDisabled } = render(
        <ProviderResponseCard 
          provider="gemini" 
          response={mockResponse} 
          promptText="test prompt" 
        />
      );

      // Both should render correctly
      expect(getByTestIdEnabled('provider-logo-openai')).toBeInTheDocument();
      expect(getByTestIdDisabled('provider-logo-gemini')).toBeInTheDocument();
    });
  });
});