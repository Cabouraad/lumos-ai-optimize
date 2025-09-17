/**
 * Centralized loading state management system
 */

export interface LoadingState {
  id: string;
  label: string;
  progress?: number;
  isIndeterminate: boolean;
  startTime: number;
  category: LoadingCategory;
}

export type LoadingCategory = 'data' | 'form' | 'navigation' | 'auth' | 'api' | 'file';

export interface LoadingManagerOptions {
  autoCleanupMs: number;
  maxConcurrentStates: number;
  debugMode: boolean;
}

type LoadingStateListener = (states: LoadingState[]) => void;

export class LoadingStateManager {
  private states = new Map<string, LoadingState>();
  private listeners: LoadingStateListener[] = [];
  private cleanupInterval: NodeJS.Timeout | null = null;
  private options: LoadingManagerOptions;

  constructor(options: Partial<LoadingManagerOptions> = {}) {
    this.options = {
      autoCleanupMs: 30000, // 30 seconds
      maxConcurrentStates: 50,
      debugMode: false,
      ...options
    };

    this.setupAutoCleanup();
  }

  private setupAutoCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      let cleaned = 0;

      for (const [id, state] of this.states.entries()) {
        if (now - state.startTime > this.options.autoCleanupMs) {
          this.states.delete(id);
          cleaned++;
        }
      }

      if (cleaned > 0) {
        this.log(`Auto-cleaned ${cleaned} stale loading states`);
        this.notifyListeners();
      }
    }, this.options.autoCleanupMs);
  }

  private log(message: string, ...args: any[]): void {
    if (this.options.debugMode) {
      console.log(`[LoadingStateManager] ${message}`, ...args);
    }
  }

  private notifyListeners(): void {
    const currentStates = Array.from(this.states.values());
    this.listeners.forEach(listener => {
      try {
        listener(currentStates);
      } catch (error) {
        console.error('[LoadingStateManager] Listener error:', error);
      }
    });
  }

  public startLoading(
    id: string,
    label: string,
    category: LoadingCategory = 'data',
    isIndeterminate: boolean = true
  ): void {
    // Enforce max concurrent states
    if (this.states.size >= this.options.maxConcurrentStates) {
      console.warn(`[LoadingStateManager] Max concurrent states (${this.options.maxConcurrentStates}) reached`);
      return;
    }

    const state: LoadingState = {
      id,
      label,
      isIndeterminate,
      startTime: Date.now(),
      category,
      progress: isIndeterminate ? undefined : 0
    };

    this.states.set(id, state);
    this.log(`Started loading: ${id} - ${label}`, state);
    this.notifyListeners();
  }

  public updateProgress(id: string, progress: number): void {
    const state = this.states.get(id);
    if (state) {
      state.progress = Math.max(0, Math.min(100, progress));
      state.isIndeterminate = false;
      this.log(`Updated progress: ${id} - ${progress}%`);
      this.notifyListeners();
    }
  }

  public updateLabel(id: string, label: string): void {
    const state = this.states.get(id);
    if (state) {
      state.label = label;
      this.log(`Updated label: ${id} - ${label}`);
      this.notifyListeners();
    }
  }

  public finishLoading(id: string): void {
    if (this.states.has(id)) {
      this.states.delete(id);
      this.log(`Finished loading: ${id}`);
      this.notifyListeners();
    }
  }

  public getLoadingState(id: string): LoadingState | undefined {
    return this.states.get(id);
  }

  public getLoadingStates(category?: LoadingCategory): LoadingState[] {
    const states = Array.from(this.states.values());
    return category ? states.filter(state => state.category === category) : states;
  }

  public isLoading(id?: string): boolean {
    if (id) {
      return this.states.has(id);
    }
    return this.states.size > 0;
  }

  public getLoadingCount(category?: LoadingCategory): number {
    return this.getLoadingStates(category).length;
  }

  public subscribe(listener: LoadingStateListener): () => void {
    this.listeners.push(listener);
    
    // Immediately call with current state
    listener(this.getLoadingStates());

    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  public clearAll(category?: LoadingCategory): void {
    if (category) {
      for (const [id, state] of this.states.entries()) {
        if (state.category === category) {
          this.states.delete(id);
        }
      }
    } else {
      this.states.clear();
    }
    
    this.log(`Cleared loading states${category ? ` for category: ${category}` : ''}`);
    this.notifyListeners();
  }

  public destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.states.clear();
    this.listeners = [];
  }
}

// Global instance
export const loadingStateManager = new LoadingStateManager();