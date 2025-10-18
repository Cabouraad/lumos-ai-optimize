import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getQuotasForTier, checkPromptQuota, type PlanTier } from '../../../supabase/functions/_shared/quota-enforcement.ts';

// Mock Supabase client with proper typing
const mockSupabase = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: vi.fn(),
        maybeSingle: vi.fn(),
      })),
    })),
  })),
  rpc: vi.fn(),
};

vi.mock('@/integrations/supabase/client', () => ({
  supabase: mockSupabase,
}));

describe('Quota Limits Boundary Testing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Tier Quota Boundaries', () => {
    it('should return correct quotas for starter tier', () => {
      const quotas = getQuotasForTier('starter');
      expect(quotas).toEqual({
        promptsPerDay: 25,
        providersPerPrompt: 2
      });
    });

    it('should return correct quotas for growth tier', () => {
      const quotas = getQuotasForTier('growth');
      expect(quotas).toEqual({
        promptsPerDay: 100,
        providersPerPrompt: 4
      });
    });

    it('should return correct quotas for pro tier', () => {
      const quotas = getQuotasForTier('pro');
      expect(quotas).toEqual({
        promptsPerDay: 300,
        providersPerPrompt: 4
      });
    });

    it('should default to free tier for unknown tiers', () => {
      const quotas = getQuotasForTier('unknown' as PlanTier);
      expect(quotas).toEqual({
        promptsPerDay: 5,
        providersPerPrompt: 1
      });
    });
  });

  describe('Quota Boundary Conditions', () => {
    const testUserId = 'test-user-id';
    const testOrgId = 'test-org-id';

    it('should allow usage at exact limit boundary (starter: 9/10 prompts)', async () => {
      // Mock subscription data - starter tier
      mockSupabase.from().select().eq().maybeSingle.mockResolvedValue({
        data: {
          subscribed: true,
          subscription_tier: 'starter',
          trial_expires_at: null,
          payment_collected: true,
        },
        error: null,
      });

      // Mock usage at 9/10 limit
      mockSupabase.rpc.mockResolvedValue({
        data: [{ prompts_used: 9, providers_used: 18 }],
        error: null,
      });

      const result = await checkPromptQuota(mockSupabase, testUserId, testOrgId, 2);
      
      expect(result.allowed).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should block usage at exact limit boundary (starter: 10/10 prompts)', async () => {
      // Mock subscription data - starter tier
      mockSupabase.from().select().eq().maybeSingle.mockResolvedValue({
        data: {
          subscribed: true,
          subscription_tier: 'starter',
          trial_expires_at: null,
          payment_collected: true,
        },
        error: null,
      });

      // Mock usage at 10/10 limit
      mockSupabase.rpc.mockResolvedValue({
        data: [{ prompts_used: 10, providers_used: 20 }],
        error: null,
      });

      const result = await checkPromptQuota(mockSupabase, testUserId, testOrgId, 2);
      
      expect(result.allowed).toBe(false);
      expect(result.error?.code).toBe('quota_exceeded');
      expect(result.error?.details.used).toBe(10);
      expect(result.error?.details.limit).toBe(10);
    });

    it('should block excessive providers per prompt (starter: 3 providers requested)', async () => {
      // Mock subscription data - starter tier
      mockSupabase.from().select().eq().maybeSingle.mockResolvedValue({
        data: {
          subscribed: true,
          subscription_tier: 'starter',
          trial_expires_at: null,
          payment_collected: true,
        },
        error: null,
      });

      // Mock low usage
      mockSupabase.rpc.mockResolvedValue({
        data: [{ prompts_used: 1, providers_used: 2 }],
        error: null,
      });

      const result = await checkPromptQuota(mockSupabase, testUserId, testOrgId, 3);
      
      expect(result.allowed).toBe(false);
      expect(result.error?.code).toBe('providers_exceeded');
      expect(result.error?.details.used).toBe(3);
      expect(result.error?.details.limit).toBe(2);
    });

    it('should allow exact providers per prompt limit (starter: 2 providers)', async () => {
      // Mock subscription data - starter tier
      mockSupabase.from().select().eq().maybeSingle.mockResolvedValue({
        data: {
          subscribed: true,
          subscription_tier: 'starter',
          trial_expires_at: null,
          payment_collected: true,
        },
        error: null,
      });

      // Mock low usage
      mockSupabase.rpc.mockResolvedValue({
        data: [{ prompts_used: 1, providers_used: 2 }],
        error: null,
      });

      const result = await checkPromptQuota(mockSupabase, testUserId, testOrgId, 2);
      
      expect(result.allowed).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should handle pro tier boundaries correctly (49/50 prompts)', async () => {
      // Mock subscription data - pro tier
      mockSupabase.from().select().eq().maybeSingle.mockResolvedValue({
        data: {
          subscribed: true,
          subscription_tier: 'pro',
          trial_expires_at: null,
          payment_collected: true,
        },
        error: null,
      });

      // Mock usage at 49/50 limit
      mockSupabase.rpc.mockResolvedValue({
        data: [{ prompts_used: 49, providers_used: 147 }],
        error: null,
      });

      const result = await checkPromptQuota(mockSupabase, testUserId, testOrgId, 3);
      
      expect(result.allowed).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should handle scale tier boundaries correctly (199/200 prompts)', async () => {
      // Mock subscription data - scale tier
      mockSupabase.from().select().eq().maybeSingle.mockResolvedValue({
        data: {
          subscribed: true,
          subscription_tier: 'scale',
          trial_expires_at: null,
          payment_collected: true,
        },
        error: null,
      });

      // Mock usage at 199/200 limit
      mockSupabase.rpc.mockResolvedValue({
        data: [{ prompts_used: 199, providers_used: 597 }],
        error: null,
      });

      const result = await checkPromptQuota(mockSupabase, testUserId, testOrgId, 3);
      
      expect(result.allowed).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });

  describe('Trial Expiration Boundaries', () => {
    const testUserId = 'test-user-id';
    const testOrgId = 'test-org-id';

    it('should allow trial that expires in 1 minute', async () => {
      const futureDate = new Date(Date.now() + 60000); // 1 minute from now
      
      mockSupabase.from().select().eq().maybeSingle.mockResolvedValue({
        data: {
          subscribed: false,
          subscription_tier: 'starter',
          trial_expires_at: futureDate.toISOString(),
          payment_collected: false,
        },
        error: null,
      });

      mockSupabase.rpc.mockResolvedValue({
        data: [{ prompts_used: 1, providers_used: 2 }],
        error: null,
      });

      const result = await checkPromptQuota(mockSupabase, testUserId, testOrgId, 2);
      
      expect(result.allowed).toBe(true);
    });

    it('should block trial that expired 1 minute ago', async () => {
      const pastDate = new Date(Date.now() - 60000); // 1 minute ago
      
      mockSupabase.from().select().eq().maybeSingle.mockResolvedValue({
        data: {
          subscribed: false,
          subscription_tier: 'starter',
          trial_expires_at: pastDate.toISOString(),
          payment_collected: false,
        },
        error: null,
      });

      mockSupabase.rpc.mockResolvedValue({
        data: [{ prompts_used: 1, providers_used: 2 }],
        error: null,
      });

      const result = await checkPromptQuota(mockSupabase, testUserId, testOrgId, 2);
      
      expect(result.allowed).toBe(false);
      expect(result.error?.code).toBe('subscription_required');
    });
  });

  describe('Error Handling Boundaries', () => {
    const testUserId = 'test-user-id';
    const testOrgId = 'test-org-id';

    it('should handle missing subscriber data gracefully', async () => {
      mockSupabase.from().select().eq().maybeSingle.mockResolvedValue({
        data: null,
        error: null,
      });

      const result = await checkPromptQuota(mockSupabase, testUserId, testOrgId, 2);
      
      expect(result.allowed).toBe(false);
      expect(result.error?.code).toBe('subscription_required');
      expect(result.error?.message).toBe('No subscription found');
    });

    it('should handle database errors gracefully', async () => {
      mockSupabase.from().select().eq().maybeSingle.mockResolvedValue({
        data: null,
        error: { message: 'Database connection failed' },
      });

      const result = await checkPromptQuota(mockSupabase, testUserId, testOrgId, 2);
      
      expect(result.allowed).toBe(false);
      expect(result.error?.code).toBe('quota_check_failed');
    });

    it('should handle RPC errors gracefully', async () => {
      mockSupabase.from().select().eq().maybeSingle.mockResolvedValue({
        data: {
          subscribed: true,
          subscription_tier: 'starter',
          trial_expires_at: null,
          payment_collected: true,
        },
        error: null,
      });

      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: { message: 'RPC function failed' },
      });

      const result = await checkPromptQuota(mockSupabase, testUserId, testOrgId, 2);
      
      expect(result.allowed).toBe(false);
      expect(result.error?.code).toBe('quota_check_failed');
    });
  });
});