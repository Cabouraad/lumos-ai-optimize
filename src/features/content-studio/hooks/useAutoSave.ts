import { useEffect, useRef, useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { EditorState } from './useContentEditor';

interface AutoSaveOptions {
  itemId: string;
  debounceMs?: number;
  onSaveStart?: () => void;
  onSaveComplete?: () => void;
  onSaveError?: (error: Error) => void;
}

interface SavedDraft {
  title: string;
  sections: Array<{
    heading: string;
    content: string;
    children?: Array<{ heading: string; content: string }>;
  }>;
  faqs: Array<{ question: string; answer: string }>;
  savedAt: string;
}

const STORAGE_KEY_PREFIX = 'content-studio-draft-';

export function useAutoSave(
  editorState: EditorState | null,
  options: AutoSaveOptions
) {
  const { itemId, debounceMs = 2000, onSaveStart, onSaveComplete, onSaveError } = options;
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedContentRef = useRef<string>('');

  // Save to localStorage (instant backup)
  const saveToLocalStorage = useCallback((state: EditorState) => {
    const draft: SavedDraft = {
      title: state.title,
      sections: state.sections.map(s => ({
        heading: s.heading,
        content: s.content,
        children: s.children?.map(c => ({
          heading: c.heading,
          content: c.content,
        })),
      })),
      faqs: state.faqs.map(f => ({
        question: f.question,
        answer: f.answer,
      })),
      savedAt: new Date().toISOString(),
    };
    
    try {
      localStorage.setItem(`${STORAGE_KEY_PREFIX}${itemId}`, JSON.stringify(draft));
    } catch (e) {
      console.error('Failed to save draft to localStorage:', e);
    }
  }, [itemId]);

  // Load from localStorage
  const loadFromLocalStorage = useCallback((): SavedDraft | null => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}${itemId}`);
      if (saved) {
        return JSON.parse(saved) as SavedDraft;
      }
    } catch (e) {
      console.error('Failed to load draft from localStorage:', e);
    }
    return null;
  }, [itemId]);

  // Clear localStorage draft
  const clearLocalDraft = useCallback(() => {
    try {
      localStorage.removeItem(`${STORAGE_KEY_PREFIX}${itemId}`);
    } catch (e) {
      console.error('Failed to clear draft from localStorage:', e);
    }
  }, [itemId]);

  // Save to database (periodic backup)
  const saveToDatabase = useCallback(async (state: EditorState) => {
    setIsSaving(true);
    onSaveStart?.();

    try {
      // Store draft content in a JSON field on the content_studio_items table
      // For now, we'll update the outline with the current content
      const updatedOutline = {
        title: state.title,
        sections: state.sections.map(s => ({
          heading: s.heading,
          points: s.suggestions,
          content: s.content, // Add content to outline for persistence
          children: s.children?.map(c => ({
            heading: c.heading,
            points: c.suggestions,
            content: c.content,
          })),
        })),
      };

      const { error } = await supabase
        .from('content_studio_items')
        .update({
          outline: updatedOutline as any,
          updated_at: new Date().toISOString(),
        })
        .eq('id', itemId);

      if (error) throw error;

      setLastSaved(new Date());
      setHasUnsavedChanges(false);
      lastSavedContentRef.current = JSON.stringify(state);
      onSaveComplete?.();
      
      // Clear localStorage draft since we've saved to DB
      clearLocalDraft();
    } catch (error) {
      console.error('Auto-save error:', error);
      onSaveError?.(error as Error);
    } finally {
      setIsSaving(false);
    }
  }, [itemId, onSaveStart, onSaveComplete, onSaveError, clearLocalDraft]);

  // Debounced save effect
  useEffect(() => {
    if (!editorState) return;

    const currentContent = JSON.stringify(editorState);
    
    // Check if content has actually changed
    if (currentContent === lastSavedContentRef.current) {
      return;
    }

    setHasUnsavedChanges(true);
    
    // Save to localStorage immediately
    saveToLocalStorage(editorState);

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Set new debounced save
    saveTimeoutRef.current = setTimeout(() => {
      saveToDatabase(editorState);
    }, debounceMs);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [editorState, debounceMs, saveToLocalStorage, saveToDatabase]);

  // Warn before leaving with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Force save now
  const saveNow = useCallback(() => {
    if (editorState) {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      saveToDatabase(editorState);
    }
  }, [editorState, saveToDatabase]);

  return {
    lastSaved,
    isSaving,
    hasUnsavedChanges,
    saveNow,
    loadFromLocalStorage,
    clearLocalDraft,
  };
}
