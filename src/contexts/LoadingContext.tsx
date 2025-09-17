/**
 * React context for centralized loading state management
 */

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { LoadingState, LoadingCategory, loadingStateManager } from '@/lib/loading/state-manager';

export interface LoadingContextValue {
  loadingStates: LoadingState[];
  startLoading: (id: string, label: string, category?: LoadingCategory, isIndeterminate?: boolean) => void;
  updateProgress: (id: string, progress: number) => void;
  updateLabel: (id: string, label: string) => void;
  finishLoading: (id: string) => void;
  isLoading: (id?: string) => boolean;
  getLoadingCount: (category?: LoadingCategory) => number;
  clearAll: (category?: LoadingCategory) => void;
}

const LoadingContext = createContext<LoadingContextValue | null>(null);

export interface LoadingProviderProps {
  children: ReactNode;
}

export function LoadingProvider({ children }: LoadingProviderProps) {
  const [loadingStates, setLoadingStates] = useState<LoadingState[]>([]);

  useEffect(() => {
    const unsubscribe = loadingStateManager.subscribe(setLoadingStates);
    return unsubscribe;
  }, []);

  const contextValue: LoadingContextValue = {
    loadingStates,
    startLoading: loadingStateManager.startLoading.bind(loadingStateManager),
    updateProgress: loadingStateManager.updateProgress.bind(loadingStateManager),
    updateLabel: loadingStateManager.updateLabel.bind(loadingStateManager),
    finishLoading: loadingStateManager.finishLoading.bind(loadingStateManager),
    isLoading: loadingStateManager.isLoading.bind(loadingStateManager),
    getLoadingCount: loadingStateManager.getLoadingCount.bind(loadingStateManager),
    clearAll: loadingStateManager.clearAll.bind(loadingStateManager)
  };

  return (
    <LoadingContext.Provider value={contextValue}>
      {children}
    </LoadingContext.Provider>
  );
}

export function useLoading(): LoadingContextValue {
  const context = useContext(LoadingContext);
  if (!context) {
    throw new Error('useLoading must be used within a LoadingProvider');
  }
  return context;
}

/**
 * Hook for managing a single loading operation
 */
export function useLoadingOperation(id: string, category: LoadingCategory = 'data') {
  const { startLoading, finishLoading, updateProgress, updateLabel, isLoading } = useLoading();

  const start = (label: string, isIndeterminate: boolean = true) => {
    startLoading(id, label, category, isIndeterminate);
  };

  const finish = () => {
    finishLoading(id);
  };

  const setProgress = (progress: number) => {
    updateProgress(id, progress);
  };

  const setLabel = (label: string) => {
    updateLabel(id, label);
  };

  const loading = isLoading(id);

  return {
    start,
    finish,
    setProgress,
    setLabel,
    loading
  };
}