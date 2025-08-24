/**
 * Phase 2: Advanced Caching System with Redis-like in-memory cache
 * Implements event-driven cache invalidation and background data pre-loading
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  lastAccess: number;
  hitCount: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  entries: number;
  hitRate: number;
  avgResponseTime: number;
}

class AdvancedCache {
  private cache = new Map<string, CacheEntry<any>>();
  private stats = { hits: 0, misses: 0, totalResponseTime: 0 };
  private maxSize = 1000; // Maximum cache entries
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Cleanup expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  async get<T>(key: string): Promise<T | null> {
    const startTime = performance.now();
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      return null;
    }

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }

    // Update access statistics
    entry.lastAccess = now;
    entry.hitCount++;
    this.stats.hits++;
    
    const responseTime = performance.now() - startTime;
    this.stats.totalResponseTime += responseTime;
    
    return entry.data;
  }

  set<T>(key: string, data: T, ttl: number = 300000): void { // Default 5 minutes
    // Implement LRU eviction if cache is full
    if (this.cache.size >= this.maxSize) {
      this.evictLRU();
    }

    const now = Date.now();
    this.cache.set(key, {
      data,
      timestamp: now,
      ttl,
      lastAccess: now,
      hitCount: 0
    });
  }

  invalidate(pattern: string): void {
    const regex = new RegExp(pattern.replace('*', '.*'));
    const keysToDelete: string[] = [];
    
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => this.cache.delete(key));
  }

  invalidateByTags(tags: string[]): void {
    for (const tag of tags) {
      this.invalidate(`*${tag}*`);
    }
  }

  getStats(): CacheStats {
    const totalRequests = this.stats.hits + this.stats.misses;
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      entries: this.cache.size,
      hitRate: totalRequests > 0 ? this.stats.hits / totalRequests : 0,
      avgResponseTime: this.stats.hits > 0 ? this.stats.totalResponseTime / this.stats.hits : 0
    };
  }

  private evictLRU(): void {
    let oldestKey = '';
    let oldestTime = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccess < oldestTime) {
        oldestTime = entry.lastAccess;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  private cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.cache.delete(key));
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.cache.clear();
  }
}

// Singleton instance
export const advancedCache = new AdvancedCache();

// Event-driven cache invalidation
export class CacheEventManager {
  private static instance: CacheEventManager;
  private listeners: Map<string, Set<(data: any) => void>> = new Map();

  static getInstance(): CacheEventManager {
    if (!CacheEventManager.instance) {
      CacheEventManager.instance = new CacheEventManager();
    }
    return CacheEventManager.instance;
  }

  on(event: string, callback: (data: any) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  off(event: string, callback: (data: any) => void): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.delete(callback);
    }
  }

  emit(event: string, data: any): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.forEach(callback => callback(data));
    }
  }

  invalidateOnPromptRun(): void {
    this.on('prompt-executed', () => {
      advancedCache.invalidateByTags(['dashboard-data', 'prompt-data', 'provider-data']);
    });
  }

  invalidateOnBrandUpdate(): void {
    this.on('brand-updated', () => {
      advancedCache.invalidateByTags(['brand-data', 'competitor-data']);
    });
  }
}

// Initialize event listeners
const cacheEventManager = CacheEventManager.getInstance();
cacheEventManager.invalidateOnPromptRun();
cacheEventManager.invalidateOnBrandUpdate();