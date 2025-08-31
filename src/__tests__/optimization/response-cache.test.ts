import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom';
import { responseCache, memoizeCompetitorValidation, memoizeJsonParsing } from '../response-cache';

// Mock feature flags
const mockFeatureFlags = {
  FEATURE_RESPONSE_CACHE: true
};

vi.mock('@/config/featureFlags', () => ({
  isOptimizationFeatureEnabled: vi.fn((flag: string) => mockFeatureFlags[flag as keyof typeof mockFeatureFlags]),
  logFeatureFlagUsage: vi.fn()
}));

describe('Response Cache Optimization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFeatureFlags.FEATURE_RESPONSE_CACHE = true;
    responseCache.clearRequestCache();
  });

  afterEach(() => {
    responseCache.cleanup();
  });

  describe('Entity Data Caching', () => {
    it('should cache and retrieve entity data by hash', () => {
      const orgId = 'test-org';
      const responseHash = 'hash123';
      const entities = {
        competitors: ['comp1', 'comp2'],
        brands: ['brand1'],
        score: 7.5
      };

      responseCache.cacheEntityData(orgId, responseHash, entities);
      const retrieved = responseCache.getCachedEntityData(orgId, responseHash);

      expect(retrieved).toEqual(entities);
    });

    it('should return null for cache miss', () => {
      const result = responseCache.getCachedEntityData('test-org', 'nonexistent-hash');
      expect(result).toBeNull();
    });

    it('should use day-based cache keys', () => {
      const orgId = 'test-org';
      const responseHash = 'hash123';
      const entities = { competitors: [], brands: [], score: 5.0 };

      responseCache.cacheEntityData(orgId, responseHash, entities);
      
      // Same day should hit cache
      const retrieved = responseCache.getCachedEntityData(orgId, responseHash);
      expect(retrieved).toEqual(entities);
    });

    it('should not cache when feature flag disabled', () => {
      mockFeatureFlags.FEATURE_RESPONSE_CACHE = false;
      
      const entities = { competitors: [], brands: [], score: 5.0 };
      responseCache.cacheEntityData('test-org', 'hash123', entities);
      
      const retrieved = responseCache.getCachedEntityData('test-org', 'hash123');
      expect(retrieved).toBeNull();
    });
  });

  describe('General Caching with TTL', () => {
    it('should cache and retrieve data within TTL', () => {
      const key = 'test-key';
      const data = { value: 'test-data' };
      const ttl = 1000; // 1 second

      responseCache.set(key, data, ttl);
      const retrieved = responseCache.get(key);

      expect(retrieved).toEqual(data);
    });

    it('should return null for expired data', async () => {
      const key = 'test-key-expired';
      const data = { value: 'test-data' };
      const ttl = 1; // 1ms

      responseCache.set(key, data, ttl);
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const retrieved = responseCache.get(key);
      expect(retrieved).toBeNull();
    });
  });

  describe('Request-scoped Memoization', () => {
    it('should memoize expensive operations within request', () => {
      const expensiveOperation = vi.fn(() => ({ result: 'computed' }));
      
      const result1 = responseCache.memoize('expensive-key', expensiveOperation);
      const result2 = responseCache.memoize('expensive-key', expensiveOperation);

      expect(expensiveOperation).toHaveBeenCalledTimes(1);
      expect(result1).toBe(result2);
    });

    it('should clear memoization between requests', () => {
      const operation = vi.fn(() => ({ result: 'computed' }));
      
      responseCache.memoize('key', operation);
      responseCache.clearRequestCache();
      responseCache.memoize('key', operation);

      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should bypass memoization when feature flag disabled', () => {
      mockFeatureFlags.FEATURE_RESPONSE_CACHE = false;
      const operation = vi.fn(() => ({ result: 'computed' }));
      
      responseCache.memoize('key', operation);
      responseCache.memoize('key', operation);

      expect(operation).toHaveBeenCalledTimes(2);
    });
  });

  describe('Early Return Guards', () => {
    it('should detect unchanged prompts', () => {
      const promptId = 'prompt-123';
      const hash = 'content-hash-456';

      // First check - should return true (changed)
      const firstCheck = responseCache.hasPromptChanged(promptId, hash);
      expect(firstCheck).toBe(true);

      // Second check with same hash - should return false (unchanged)
      const secondCheck = responseCache.hasPromptChanged(promptId, hash);
      expect(secondCheck).toBe(false);
    });

    it('should detect changed prompts', () => {
      const promptId = 'prompt-123';
      const hash1 = 'content-hash-456';
      const hash2 = 'content-hash-789';

      responseCache.hasPromptChanged(promptId, hash1);
      const changed = responseCache.hasPromptChanged(promptId, hash2);

      expect(changed).toBe(true);
    });
  });

  describe('Memoization Helpers', () => {
    it('should memoize competitor validation', () => {
      const validator = vi.fn((name: string) => name.length > 3);
      const memoizedValidator = memoizeCompetitorValidation(validator);

      const result1 = memoizedValidator('test');
      const result2 = memoizedValidator('test');
      const result3 = memoizedValidator('ab');

      expect(validator).toHaveBeenCalledTimes(2); // 'test' and 'ab'
      expect(result1).toBe(true);
      expect(result2).toBe(true);
      expect(result3).toBe(false);
    });

    it('should memoize JSON parsing', () => {
      const parser = vi.fn((json: string) => JSON.parse(json));
      const memoizedParser = memoizeJsonParsing(parser);

      const json = '{\\\"test\\\": \\\"value\\\"}';
      const result1 = memoizedParser(json);
      const result2 = memoizedParser(json);

      expect(parser).toHaveBeenCalledTimes(1);
      expect(result1).toEqual(result2);
      expect(result1).toEqual({ test: 'value' });
    });

    it('should bypass memoization when feature disabled', () => {
      mockFeatureFlags.FEATURE_RESPONSE_CACHE = false;
      
      const validator = vi.fn(() => true);
      const memoizedValidator = memoizeCompetitorValidation(validator);

      memoizedValidator('test');
      memoizedValidator('test');

      expect(validator).toHaveBeenCalledTimes(2);
    });
  });

  describe('Cache Cleanup', () => {
    it('should remove expired entries during cleanup', async () => {
      const key = 'cleanup-test';
      const data = { value: 'test' };
      const ttl = 1; // 1ms

      responseCache.set(key, data, ttl);
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 10));
      
      responseCache.cleanup();
      
      const retrieved = responseCache.get(key);
      expect(retrieved).toBeNull();
    });
  });

  describe('Performance Impact', () => {
    it('should improve repeated JSON parsing performance', () => {
      const largeJson = JSON.stringify(Array.from({ length: 1000 }, (_, i) => ({ 
        id: i, 
        name: `item-${i}`,
        data: Array.from({ length: 10 }, (_, j) => `data-${j}`)
      })));

      const parser = (json: string) => JSON.parse(json);
      const memoizedParser = memoizeJsonParsing(parser);

      // First parse (should be slow)
      const start1 = performance.now();
      memoizedParser(largeJson);
      const time1 = performance.now() - start1;

      // Second parse (should be fast due to memoization)
      const start2 = performance.now();
      memoizedParser(largeJson);
      const time2 = performance.now() - start2;

      expect(time2).toBeLessThan(time1 * 0.1); // Should be at least 10x faster
    });

    it('should provide O(1) cache lookup performance', () => {
      // Fill cache with many entries
      for (let i = 0; i < 1000; i++) {
        responseCache.set(`key-${i}`, { data: `value-${i}` }, 60000);
      }

      // Measure lookup performance
      const start = performance.now();
      for (let i = 0; i < 100; i++) {
        responseCache.get(`key-${i}`);
      }
      const time = performance.now() - start;

      expect(time).toBeLessThan(10); // Should be very fast
    });
  });
});
