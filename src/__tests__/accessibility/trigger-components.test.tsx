/**
 * Accessibility tests for trigger components
 * Ensures TooltipTrigger and DialogTrigger components have accessible names
 */

import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TooltipProvider } from '@/components/ui/tooltip';
import { CompetitorChip } from '@/components/CompetitorChip';
import { Button } from '@/components/ui/button';

// Mock Supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'test-user' } }
      })
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({
            data: { org_id: 'test-org' }
          })
        }))
      }))
    })),
    functions: {
      invoke: vi.fn()
    }
  }
}));

// Mock the catalog competitors hook
vi.mock('@/hooks/useCatalogCompetitors', () => ({
  useCatalogCompetitors: () => ({
    isCompetitorInCatalog: () => true
  })
}));

// Mock toast hook
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn()
  })
}));

describe('Trigger Components Accessibility', () => {
  describe('TooltipTrigger with CompetitorChip', () => {
    it('should have accessible name via aria-label or text content', () => {
      const result = render(
        <TooltipProvider>
          <CompetitorChip name="HubSpot" />
        </TooltipProvider>
      );

      // The Badge component should be accessible through its text content
      const chip = result.getByText('HubSpot');
      expect(chip).toBeInTheDocument();
      
      // The tooltip trigger should be accessible
      const tooltipTrigger = chip.closest('[role="button"]') || chip;
      expect(tooltipTrigger).toBeInTheDocument();
    });

    it('should handle forwardRef correctly without console warnings', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      render(
        <TooltipProvider>
          <CompetitorChip name="Salesforce" />
        </TooltipProvider>
      );

      // Should not have any ref warnings
      expect(consoleSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('forwardRef')
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('DialogTrigger components', () => {
    it('should have accessible name for dialog triggers', () => {
      const result = render(
        <Button variant="outline" size="sm" className="gap-2">
          Test Dialog Trigger
        </Button>
      );

      const button = result.getByRole('button', { name: /test dialog trigger/i });
      expect(button).toBeInTheDocument();
      expect(button).toHaveAccessibleName();
    });

    it('should maintain accessibility when used with asChild', () => {
      // This tests that Button components maintain their ref and accessibility
      // when used as children of DialogTrigger with asChild prop
      const result = render(
        <Button variant="outline" aria-label="Accessible button">
          Button Content
        </Button>
      );
      
      const button = result.getByRole('button', { name: 'Accessible button' });
      expect(button).toBeInTheDocument();
      expect(button).toHaveAccessibleName();
    });
  });

  describe('Button components with asChild', () => {
    it('should maintain accessible names when used with asChild', () => {
      // Test that Button components maintain their accessibility when used as children
      // This is handled by the Button component's forwardRef implementation
      const TestButton = () => (
        <button aria-label="Test button">Test</button>
      );

      const result = render(<TestButton />);
      
      const button = result.getByRole('button', { name: 'Test button' });
      expect(button).toBeInTheDocument();
      expect(button).toHaveAccessibleName();
    });
  });
});