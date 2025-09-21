/**
 * Regression test for cache invalidation functionality
 * Ensures cache patterns work correctly after org-scoped keys
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { invalidateCache } from '@/lib/data/unified-fetcher';
import { advancedCache } from '@/lib/advanced-cache/redis-cache';

// Mock the advanced cache
vi.mock('@/lib/advanced-cache/redis-cache', () => ({
  advancedCache: {
    invalidate: vi.fn(),
    get: vi.fn(),
    set: vi.fn(),
  },
  CacheEventManager: {
    getInstance: () => ({
      emit: vi.fn(),
    }),
  },
}));

describe('Cache Invalidation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should auto-wildcard cache keys that do not contain asterisks', () => {
    const keys = ['dashboard-data', 'prompt-data'];
    
    invalidateCache(keys);
    
    expect(advancedCache.invalidate).toHaveBeenCalledWith('dashboard-data*');
    expect(advancedCache.invalidate).toHaveBeenCalledWith('prompt-data*');
    expect(advancedCache.invalidate).toHaveBeenCalledTimes(2);
  });

  it('should not modify keys that already contain wildcards', () => {
    const keys = ['dashboard-data*', 'prompt-data-specific-org-123'];
    
    invalidateCache(keys);
    
    expect(advancedCache.invalidate).toHaveBeenCalledWith('dashboard-data*');
    expect(advancedCache.invalidate).toHaveBeenCalledWith('prompt-data-specific-org-123*');
  });

  it('should clear all cache when no keys provided', () => {
    invalidateCache();
    
    expect(advancedCache.invalidate).toHaveBeenCalledWith('*');
    expect(advancedCache.invalidate).toHaveBeenCalledTimes(1);
  });
});