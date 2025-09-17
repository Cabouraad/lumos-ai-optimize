/**
 * Adaptive polling system with connection quality detection
 */

interface ConnectionInfo {
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
}

export interface AdaptivePollerOptions {
  minInterval: number;
  maxInterval: number;
  backoffMultiplier: number;
  activityThreshold: number;
  changeDetection: boolean;
}

export interface PollingState {
  interval: number;
  lastActivity: number;
  consecutiveNoChanges: number;
  isOnline: boolean;
  connectionQuality: 'fast' | 'slow' | 'offline';
}

export class AdaptivePoller {
  private options: AdaptivePollerOptions;
  private state: PollingState;
  private timeoutId: NodeJS.Timeout | null = null;
  private callbacks: (() => Promise<any>)[] = [];
  private lastDataHash: string | null = null;

  constructor(options: Partial<AdaptivePollerOptions> = {}) {
    this.options = {
      minInterval: 30000, // 30 seconds
      maxInterval: 300000, // 5 minutes
      backoffMultiplier: 1.5,
      activityThreshold: 300000, // 5 minutes
      changeDetection: true,
      ...options
    };

    this.state = {
      interval: this.options.minInterval,
      lastActivity: Date.now(),
      consecutiveNoChanges: 0,
      isOnline: navigator.onLine,
      connectionQuality: this.detectConnectionQuality()
    };

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Online/offline detection
    window.addEventListener('online', () => {
      console.log('[AdaptivePoller] Connection restored');
      this.state.isOnline = true;
      this.state.connectionQuality = this.detectConnectionQuality();
      this.adjustInterval();
      this.resume();
    });

    window.addEventListener('offline', () => {
      console.log('[AdaptivePoller] Connection lost');
      this.state.isOnline = false;
      this.state.connectionQuality = 'offline';
      this.pause();
    });

    // Visibility change detection
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.onActivity();
        // Immediate poll when becoming visible
        this.executePoll();
      }
    });

    // User activity detection
    ['click', 'keypress', 'scroll', 'mousemove'].forEach(event => {
      document.addEventListener(event, this.onActivity.bind(this), { 
        passive: true, 
        capture: true 
      });
    });
  }

  private detectConnectionQuality(): 'fast' | 'slow' | 'offline' {
    if (!navigator.onLine) return 'offline';

    const connection = (navigator as any).connection as ConnectionInfo;
    if (!connection) return 'fast';

    const { effectiveType, downlink, rtt } = connection;
    
    // Fast connection indicators
    if (effectiveType === '4g' || (downlink && downlink > 2) || (rtt && rtt < 200)) {
      return 'fast';
    }
    
    // Slow connection indicators
    if (effectiveType === '3g' || effectiveType === '2g' || (downlink && downlink < 1)) {
      return 'slow';
    }
    
    return 'fast'; // Default to fast if uncertain
  }

  private onActivity(): void {
    this.state.lastActivity = Date.now();
    this.adjustInterval();
  }

  private adjustInterval(): void {
    if (!this.state.isOnline) return;

    const timeSinceActivity = Date.now() - this.state.lastActivity;
    const isActive = timeSinceActivity < this.options.activityThreshold;
    
    let newInterval = this.options.minInterval;

    // Increase interval based on inactivity
    if (!isActive) {
      newInterval = Math.min(
        this.options.minInterval * Math.pow(this.options.backoffMultiplier, 
          Math.floor(timeSinceActivity / this.options.activityThreshold)),
        this.options.maxInterval
      );
    }

    // Adjust for connection quality
    if (this.state.connectionQuality === 'slow') {
      newInterval *= 2; // Double interval for slow connections
    }

    // Increase interval based on consecutive no-change polls
    if (this.state.consecutiveNoChanges > 3) {
      newInterval = Math.min(
        newInterval * Math.pow(1.2, this.state.consecutiveNoChanges - 3),
        this.options.maxInterval
      );
    }

    if (newInterval !== this.state.interval) {
      console.log(`[AdaptivePoller] Interval adjusted: ${this.state.interval}ms -> ${newInterval}ms`, {
        isActive,
        connectionQuality: this.state.connectionQuality,
        consecutiveNoChanges: this.state.consecutiveNoChanges
      });
      this.state.interval = newInterval;
    }
  }

  private async executePoll(): Promise<void> {
    if (!this.state.isOnline || this.callbacks.length === 0) return;

    try {
      console.log(`[AdaptivePoller] Executing poll (interval: ${this.state.interval}ms)`);
      
      const results = await Promise.all(
        this.callbacks.map(callback => callback().catch(error => {
          console.error('[AdaptivePoller] Callback error:', error);
          return null;
        }))
      );

      // Data change detection
      if (this.options.changeDetection) {
        const dataHash = this.hashResults(results);
        const hasChanges = this.lastDataHash !== dataHash;
        
        if (hasChanges) {
          this.state.consecutiveNoChanges = 0;
          console.log('[AdaptivePoller] Data changes detected');
        } else {
          this.state.consecutiveNoChanges++;
          console.log(`[AdaptivePoller] No changes detected (${this.state.consecutiveNoChanges} consecutive)`);
        }
        
        this.lastDataHash = dataHash;
        this.adjustInterval();
      }

    } catch (error) {
      console.error('[AdaptivePoller] Poll execution error:', error);
    } finally {
      this.scheduleNext();
    }
  }

  private hashResults(results: any[]): string {
    try {
      return btoa(JSON.stringify(results)).slice(0, 16);
    } catch {
      return Date.now().toString();
    }
  }

  private scheduleNext(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }

    if (this.state.isOnline) {
      this.timeoutId = setTimeout(() => {
        this.executePoll();
      }, this.state.interval);
    }
  }

  public subscribe(callback: () => Promise<any>): () => void {
    this.callbacks.push(callback);
    
    // Start polling if this is the first callback
    if (this.callbacks.length === 1 && this.state.isOnline) {
      this.executePoll();
    }

    // Return unsubscribe function
    return () => {
      const index = this.callbacks.indexOf(callback);
      if (index > -1) {
        this.callbacks.splice(index, 1);
      }
      
      // Stop polling if no callbacks left
      if (this.callbacks.length === 0) {
        this.pause();
      }
    };
  }

  public pause(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    console.log('[AdaptivePoller] Paused');
  }

  public resume(): void {
    if (this.state.isOnline && this.callbacks.length > 0) {
      this.executePoll();
      console.log('[AdaptivePoller] Resumed');
    }
  }

  public getState(): PollingState {
    return { ...this.state };
  }
}