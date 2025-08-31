/**
 * Response caching system for expensive computations
 * Only active when FEATURE_RESPONSE_CACHE is enabled
 */

import { isOptimizationFeatureEnabled, logFeatureFlagUsage } from "@/config/featureFlags";

interface CacheEntry<T> {
  data: T;
  hash: string;
  timestamp: number;
  expiresAt: number;
}

interface EntityCacheEntry {
  competitors: string[];
  brands: string[];
  score: number;
  hash: string;
  processedAt: number;
}

class ResponseCache {
  private cache = new Map<string, CacheEntry<any>>();
  private entityCache = new Map<string, EntityCacheEntry>();
  private requestMemoCache = new Map<string, any>();
  
  // Per-account/day cache for parsed entities and scores
  cacheEntityData(
    orgId: string, 
    responseHash: string, 
    entities: { competitors: string[]; brands: string[]; score: number }
  ): void {
    if (!isOptimizationFeatureEnabled('FEATURE_RESPONSE_CACHE')) return;
    
    const day = new Date().toISOString().split('T')[0];
    const key = `entities:${orgId}:${day}:${responseHash}`;
    
    this.entityCache.set(key, {
      ...entities,
      hash: responseHash,
      processedAt: Date.now()
    });
    
    logFeatureFlagUsage('FEATURE_RESPONSE_CACHE', 'cacheEntityData');
  }
  
  getCachedEntityData(
    orgId: string, 
    responseHash: string
  ): { competitors: string[]; brands: string[]; score: number } | null {
    if (!isOptimizationFeatureEnabled('FEATURE_RESPONSE_CACHE')) return null;
    
    const day = new Date().toISOString().split('T')[0];
    const key = `entities:${orgId}:${day}:${responseHash}`;
    
    const cached = this.entityCache.get(key);
    if (!cached) return null;
    
    logFeatureFlagUsage('FEATURE_RESPONSE_CACHE', 'getCachedEntityData-hit');
    return {
      competitors: cached.competitors,
      brands: cached.brands,
      score: cached.score
    };
  }
  
  // General cache with TTL
  set<T>(key: string, data: T, ttlMs: number): void {
    if (!isOptimizationFeatureEnabled('FEATURE_RESPONSE_CACHE')) return;
    
    const hash = this.generateHash(data);
    this.cache.set(key, {
      data,
      hash,
      timestamp: Date.now(),
      expiresAt: Date.now() + ttlMs
    });
  }
  
  get<T>(key: string): T | null {
    if (!isOptimizationFeatureEnabled('FEATURE_RESPONSE_CACHE')) return null;
    
    const entry = this.cache.get(key);
    if (!entry || entry.expiresAt < Date.now()) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }
  
  // Request-scoped memoization (cleared after each request)
  memoize<T>(key: string, factory: () => T): T {
    if (!isOptimizationFeatureEnabled('FEATURE_RESPONSE_CACHE')) {
      return factory();
    }
    
    if (this.requestMemoCache.has(key)) {
      return this.requestMemoCache.get(key);
    }
    
    const result = factory();
    this.requestMemoCache.set(key, result);
    return result;
  }
  
  // Clear request-scoped cache (call at end of request)
  clearRequestCache(): void {
    this.requestMemoCache.clear();
  }
  
  // Early return guard: check if prompt response hash changed
  hasPromptChanged(promptId: string, currentHash: string): boolean {
    const cacheKey = `prompt-hash:${promptId}`;
    const lastHash = this.get<string>(cacheKey);
    
    if (lastHash === currentHash) {
      logFeatureFlagUsage('FEATURE_RESPONSE_CACHE', 'prompt-unchanged-early-return');
      return false; // No change, can skip processing
    }
    
    // Update hash for next comparison
    this.set(cacheKey, currentHash, 24 * 60 * 60 * 1000); // 24h TTL
    return true; // Changed, needs processing
  }
  
  private generateHash(data: any): string {
    // Simple hash for cache keys (not cryptographic)
    const str = JSON.stringify(data);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }
  
  // Cleanup expired entries
  cleanup(): void {
    const now = Date.now();
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt < now) {
        this.cache.delete(key);
      }
    }
    
    // Cleanup entity cache (older than 7 days)
    const weekAgo = now - (7 * 24 * 60 * 60 * 1000);
    for (const [key, entry] of this.entityCache.entries()) {
      if (entry.processedAt < weekAgo) {
        this.entityCache.delete(key);
      }
    }
  }
}

// Global cache instance
export const responseCache = new ResponseCache();

// Cleanup on app start and periodically
if (typeof window !== 'undefined') {
  // Cleanup every hour
  setInterval(() => responseCache.cleanup(), 60 * 60 * 1000);
}

// Memoization helpers for heavy pure functions
export function memoizeCompetitorValidation(validator: (name: string) => boolean) {
  const cache = new Map<string, boolean>();
  
  return (name: string): boolean => {
    if (!isOptimizationFeatureEnabled('FEATURE_RESPONSE_CACHE')) {
      return validator(name);
    }
    
    if (cache.has(name)) {
      return cache.get(name)!;
    }
    
    const result = validator(name);
    cache.set(name, result);
    return result;
  };
}

export function memoizeJsonParsing<T>(parser: (json: string) => T) {
  const cache = new Map<string, T>();
  
  return (json: string): T => {
    if (!isOptimizationFeatureEnabled('FEATURE_RESPONSE_CACHE')) {
      return parser(json);
    }
    
    if (cache.has(json)) {
      return cache.get(json)!;
    }
    
    const result = parser(json);
    cache.set(json, result);
    return result;
  };
}