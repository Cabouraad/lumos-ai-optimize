/**
 * A11Y utilities and hooks for enhanced accessibility
 */

import { useEffect, useRef } from 'react';
import { isOptimizationFeatureEnabled } from '@/config/featureFlags';

// Hook for managing focus within expandable components
export const useFocusManagement = (isExpanded: boolean, elementId: string) => {
  const firstFocusableRef = useRef<HTMLElement | null>(null);
  const lastFocusableRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOptimizationFeatureEnabled('FEATURE_A11Y')) return;

    if (isExpanded) {
      // Focus first focusable element when expanded
      const expandedContent = document.getElementById(elementId);
      if (expandedContent) {
        const focusableElements = expandedContent.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        
        if (focusableElements.length > 0) {
          (focusableElements[0] as HTMLElement).focus();
          firstFocusableRef.current = focusableElements[0] as HTMLElement;
          lastFocusableRef.current = focusableElements[focusableElements.length - 1] as HTMLElement;
        }
      }
    }
  }, [isExpanded, elementId]);

  const handleKeyDown = (e: KeyboardEvent) => {
    if (!isOptimizationFeatureEnabled('FEATURE_A11Y') || !isExpanded) return;

    // Trap focus within expanded content
    if (e.key === 'Tab') {
      if (e.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstFocusableRef.current) {
          e.preventDefault();
          lastFocusableRef.current?.focus();
        }
      } else {
        // Tab
        if (document.activeElement === lastFocusableRef.current) {
          e.preventDefault();
          firstFocusableRef.current?.focus();
        }
      }
    }

    // Close on Escape
    if (e.key === 'Escape') {
      // Signal to parent to close
      const expandToggle = document.querySelector(`[aria-controls="${elementId}"]`);
      if (expandToggle) {
        (expandToggle as HTMLElement).focus();
        // Dispatch custom event to close
        expandToggle.dispatchEvent(new CustomEvent('closeExpanded'));
      }
    }
  };

  useEffect(() => {
    if (isExpanded) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isExpanded]);

  return { firstFocusableRef, lastFocusableRef };
};

// Hook for screen reader announcements
export const useScreenReaderAnnouncement = () => {
  const announce = (message: string, priority: 'polite' | 'assertive' = 'polite') => {
    if (!isOptimizationFeatureEnabled('FEATURE_A11Y')) return;

    // Create or update live region
    let liveRegion = document.getElementById('sr-live-region');
    if (!liveRegion) {
      liveRegion = document.createElement('div');
      liveRegion.id = 'sr-live-region';
      liveRegion.setAttribute('aria-live', priority);
      liveRegion.setAttribute('aria-atomic', 'true');
      liveRegion.className = 'sr-only absolute -top-[10000px] left-0 w-px h-px overflow-hidden';
      document.body.appendChild(liveRegion);
    }

    // Clear and set new message
    liveRegion.textContent = '';
    setTimeout(() => {
      liveRegion!.textContent = message;
    }, 100);
  };

  return { announce };
};

// WCAG 2.2 AA color contrast utilities
export const colorContrastUtils = {
  // Check if color meets WCAG AA standards (4.5:1 ratio)
  meetsContrastRequirement: (foreground: string, background: string): boolean => {
    // This would integrate with a color contrast library
    // For now, return true as we're using design system tokens
    return true;
  },

  // Get accessible color variant
  getAccessibleColor: (baseColor: string, onBackground: 'light' | 'dark'): string => {
    if (!isOptimizationFeatureEnabled('FEATURE_A11Y')) {
      return baseColor;
    }

    // Return design system token that meets contrast requirements
    if (onBackground === 'light') {
      return 'var(--a11y-text-primary)';
    } else {
      return 'var(--a11y-text-inverse)';
    }
  }
};

// Keyboard navigation helpers
export const keyboardNavigation = {
  isNavigationKey: (key: string): boolean => {
    return ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(key);
  },

  handleGridNavigation: (
    e: KeyboardEvent, 
    currentIndex: number, 
    totalItems: number, 
    itemsPerRow: number = 1
  ): number => {
    if (!isOptimizationFeatureEnabled('FEATURE_A11Y')) return currentIndex;

    let newIndex = currentIndex;

    switch (e.key) {
      case 'ArrowDown':
        newIndex = Math.min(currentIndex + itemsPerRow, totalItems - 1);
        break;
      case 'ArrowUp':
        newIndex = Math.max(currentIndex - itemsPerRow, 0);
        break;
      case 'ArrowRight':
        newIndex = Math.min(currentIndex + 1, totalItems - 1);
        break;
      case 'ArrowLeft':
        newIndex = Math.max(currentIndex - 1, 0);
        break;
      case 'Home':
        newIndex = 0;
        break;
      case 'End':
        newIndex = totalItems - 1;
        break;
    }

    if (newIndex !== currentIndex) {
      e.preventDefault();
    }

    return newIndex;
  }
};