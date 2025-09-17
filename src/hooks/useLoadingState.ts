/**
 * Custom hook for managing individual loading operations
 */

import { useEffect, useCallback } from 'react';
import { useLoading } from '@/contexts/LoadingContext';
import { LoadingCategory } from '@/lib/loading/state-manager';

export interface UseLoadingStateOptions {
  id?: string;
  category?: LoadingCategory;
  autoCleanup?: boolean;
}

export function useLoadingState(options: UseLoadingStateOptions = {}) {
  const { 
    id = `loading-${Math.random().toString(36).substr(2, 9)}`,
    category = 'data',
    autoCleanup = true
  } = options;

  const { startLoading, finishLoading, updateProgress, updateLabel, isLoading } = useLoading();

  const start = useCallback((label: string, isIndeterminate: boolean = true) => {
    startLoading(id, label, category, isIndeterminate);
  }, [id, category, startLoading]);

  const finish = useCallback(() => {
    finishLoading(id);
  }, [id, finishLoading]);

  const setProgress = useCallback((progress: number) => {
    updateProgress(id, progress);
  }, [id, updateProgress]);

  const setLabel = useCallback((label: string) => {
    updateLabel(id, label);
  }, [id, updateLabel]);

  const loading = isLoading(id);

  // Auto cleanup on unmount
  useEffect(() => {
    if (autoCleanup) {
      return () => {
        finishLoading(id);
      };
    }
  }, [id, finishLoading, autoCleanup]);

  return {
    start,
    finish,
    setProgress,
    setLabel,
    loading,
    id
  };
}

/**
 * Hook for wrapping async operations with automatic loading states
 */
export function useAsyncOperation<T extends (...args: any[]) => Promise<any>>(
  operation: T,
  options: UseLoadingStateOptions & { 
    label?: string;
    onSuccess?: (result: any) => void;
    onError?: (error: any) => void;
  } = {}
) {
  const { label = 'Loading...', onSuccess, onError, ...loadingOptions } = options;
  const { start, finish, setProgress, setLabel, loading } = useLoadingState(loadingOptions);

  const execute = useCallback(async (...args: Parameters<T>): Promise<Awaited<ReturnType<T>>> => {
    try {
      start(label);
      const result = await operation(...args);
      onSuccess?.(result);
      return result;
    } catch (error) {
      onError?.(error);
      throw error;
    } finally {
      finish();
    }
  }, [operation, start, finish, label, onSuccess, onError]);

  return {
    execute: execute as T,
    loading,
    setProgress,
    setLabel
  };
}