/**
 * Keyboard shortcuts hook
 * Provides consistent keyboard navigation throughout the app
 */

import { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

export interface KeyboardShortcut {
  key: string;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  metaKey?: boolean;
  action: () => void;
  description: string;
}

export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[], enabled = true) {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const matchedShortcut = shortcuts.find((shortcut) => {
        if (!shortcut.key || !e.key) return false;
        const keyMatches = e.key.toLowerCase() === shortcut.key.toLowerCase();
        const ctrlMatches = (shortcut.ctrlKey ?? false) === (e.ctrlKey || e.metaKey);
        const shiftMatches = (shortcut.shiftKey ?? false) === e.shiftKey;

        return keyMatches && ctrlMatches && shiftMatches;
      });

      if (matchedShortcut) {
        e.preventDefault();
        matchedShortcut.action();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts, enabled]);
}

/**
 * Global keyboard shortcuts
 * CMD+K: Command palette
 * CMD+R: Refresh dashboard
 * CMD+/: Show shortcuts
 * ?: Help
 */
export function useGlobalShortcuts() {
  const navigate = useNavigate();

  const shortcuts: KeyboardShortcut[] = [
    {
      key: 'k',
      ctrlKey: true,
      action: () => {
        // Open command palette (if implemented)
        console.log('[Shortcuts] Command palette (not implemented)');
      },
      description: 'Open command palette',
    },
    {
      key: 'r',
      ctrlKey: true,
      action: () => {
        window.location.reload();
      },
      description: 'Refresh page',
    },
    {
      key: '/',
      ctrlKey: true,
      action: () => {
        // Show shortcuts modal
        console.log('[Shortcuts] Show shortcuts modal (not implemented)');
      },
      description: 'Show keyboard shortcuts',
    },
    {
      key: '?',
      action: () => {
        // Show help
        console.log('[Shortcuts] Show help (not implemented)');
      },
      description: 'Show help',
    },
    {
      key: 'd',
      ctrlKey: true,
      action: () => navigate('/dashboard'),
      description: 'Go to dashboard',
    },
    {
      key: 'p',
      ctrlKey: true,
      action: () => navigate('/prompts'),
      description: 'Go to prompts',
    },
    {
      key: 's',
      ctrlKey: true,
      action: () => navigate('/settings'),
      description: 'Go to settings',
    },
  ];

  useKeyboardShortcuts(shortcuts);

  return shortcuts;
}

/**
 * Navigation shortcuts for keyboard power users
 */
export function useNavigationShortcuts() {
  const navigate = useNavigate();

  const handleEscape = useCallback(() => {
    // Close modals, cancel actions, etc.
    const escEvent = new KeyboardEvent('keydown', { key: 'Escape' });
    document.dispatchEvent(escEvent);
  }, []);

  const shortcuts: KeyboardShortcut[] = [
    {
      key: 'Escape',
      action: handleEscape,
      description: 'Close modal/cancel',
    },
  ];

  useKeyboardShortcuts(shortcuts);
}

/**
 * Display keyboard shortcuts to users
 */
export function getShortcutDisplay(shortcut: KeyboardShortcut): string {
  const parts: string[] = [];
  
  if (shortcut.ctrlKey) {
    parts.push(navigator.platform.includes('Mac') ? '⌘' : 'Ctrl');
  }
  
  if (shortcut.shiftKey) {
    parts.push('⇧');
  }
  
  parts.push(shortcut.key.toUpperCase());
  
  return parts.join('+');
}
