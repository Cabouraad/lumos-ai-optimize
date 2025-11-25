/**
 * Accessibility utility functions for ARIA attributes
 * Helps ensure components are properly labeled and accessible
 */

export interface AriaLabelOptions {
  label?: string;
  labelledBy?: string;
  describedBy?: string;
}

/**
 * Generate proper ARIA attributes for a component
 */
export function getAriaProps(options: AriaLabelOptions) {
  const props: Record<string, string> = {};
  
  if (options.label) {
    props['aria-label'] = options.label;
  }
  
  if (options.labelledBy) {
    props['aria-labelledby'] = options.labelledBy;
  }
  
  if (options.describedBy) {
    props['aria-describedby'] = options.describedBy;
  }
  
  return props;
}

/**
 * Generate unique IDs for ARIA relationships
 */
export function generateAriaId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Announce message to screen readers
 */
export function announceToScreenReader(message: string, politeness: 'polite' | 'assertive' = 'polite') {
  const announcement = document.createElement('div');
  announcement.setAttribute('role', 'status');
  announcement.setAttribute('aria-live', politeness);
  announcement.setAttribute('aria-atomic', 'true');
  announcement.className = 'sr-only';
  announcement.textContent = message;
  
  document.body.appendChild(announcement);
  
  // Remove after announcement
  setTimeout(() => {
    document.body.removeChild(announcement);
  }, 1000);
}

/**
 * Common ARIA patterns for components
 */
export const ariaPatterns = {
  /**
   * Loading state ARIA attributes
   */
  loading: (isLoading: boolean, label = 'Loading') => ({
    'aria-busy': isLoading,
    'aria-live': 'polite' as const,
    ...(isLoading && { 'aria-label': label })
  }),
  
  /**
   * Error state ARIA attributes
   */
  error: (hasError: boolean, errorId?: string) => ({
    'aria-invalid': hasError,
    ...(hasError && errorId && { 'aria-describedby': errorId })
  }),
  
  /**
   * Expandable/collapsible section
   */
  expandable: (isExpanded: boolean, controlsId: string) => ({
    'aria-expanded': isExpanded,
    'aria-controls': controlsId
  }),
  
  /**
   * Modal/dialog
   */
  dialog: (isOpen: boolean, labelId?: string, descId?: string) => ({
    role: 'dialog' as const,
    'aria-modal': isOpen,
    ...(labelId && { 'aria-labelledby': labelId }),
    ...(descId && { 'aria-describedby': descId })
  }),
  
  /**
   * Button that controls another element
   */
  controlButton: (controlsId: string, expanded?: boolean) => ({
    'aria-controls': controlsId,
    ...(expanded !== undefined && { 'aria-expanded': expanded })
  })
};

/**
 * Keyboard navigation helpers
 */
export const keyboardNav = {
  /**
   * Check if key is an action key (Enter or Space)
   */
  isActionKey: (e: React.KeyboardEvent | KeyboardEvent): boolean => {
    return e.key === 'Enter' || e.key === ' ';
  },
  
  /**
   * Check if key is an escape key
   */
  isEscapeKey: (e: React.KeyboardEvent | KeyboardEvent): boolean => {
    return e.key === 'Escape' || e.key === 'Esc';
  },
  
  /**
   * Handle keyboard interaction for custom buttons
   */
  handleButtonKeyDown: (
    e: React.KeyboardEvent,
    onClick: () => void
  ): void => {
    if (keyboardNav.isActionKey(e)) {
      e.preventDefault();
      onClick();
    }
  },
  
  /**
   * Arrow key navigation in lists
   */
  handleArrowNavigation: (
    e: React.KeyboardEvent,
    currentIndex: number,
    totalItems: number,
    onNavigate: (newIndex: number) => void
  ): void => {
    let newIndex = currentIndex;
    
    switch (e.key) {
      case 'ArrowDown':
      case 'ArrowRight':
        e.preventDefault();
        newIndex = (currentIndex + 1) % totalItems;
        break;
      case 'ArrowUp':
      case 'ArrowLeft':
        e.preventDefault();
        newIndex = currentIndex === 0 ? totalItems - 1 : currentIndex - 1;
        break;
      case 'Home':
        e.preventDefault();
        newIndex = 0;
        break;
      case 'End':
        e.preventDefault();
        newIndex = totalItems - 1;
        break;
      default:
        return;
    }
    
    onNavigate(newIndex);
  }
};

/**
 * Focus management utilities
 */
export const focusManagement = {
  /**
   * Trap focus within an element (for modals, dialogs)
   */
  trapFocus: (containerEl: HTMLElement): (() => void) => {
    const focusableElements = containerEl.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    
    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      
      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };
    
    containerEl.addEventListener('keydown', handleTabKey);
    
    // Return cleanup function
    return () => {
      containerEl.removeEventListener('keydown', handleTabKey);
    };
  },
  
  /**
   * Save and restore focus
   */
  saveFocus: (): (() => void) => {
    const activeElement = document.activeElement as HTMLElement;
    
    return () => {
      if (activeElement && activeElement.focus) {
        activeElement.focus();
      }
    };
  }
};
