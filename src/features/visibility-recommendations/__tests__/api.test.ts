import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateVisibilityRecommendations, listVisibilityRecommendations, listAllOrgRecommendations } from '../api';
import * as invokeModule from '@/lib/supabase/invoke';

// Mock the Supabase client and invokeEdge
const mockInvoke = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockOrder = vi.fn();
const mockGetSession = vi.fn();
const mockGetUser = vi.fn();
const mockSingle = vi.fn();
const mockLimit = vi.fn();

vi.mock('@/lib/supabase/invoke', () => ({
  invokeEdge: vi.fn()
}));

vi.mock('@/lib/supabase/browser', () => ({
  getSupabaseBrowserClient: () => ({
    auth: {
      getSession: mockGetSession,
      getUser: mockGetUser
    },
    functions: {
      invoke: mockInvoke
    },
    from: () => ({
      select: mockSelect
    })
  })
}));

describe('Visibility Recommendations API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ order: mockOrder, single: mockSingle });
    mockOrder.mockReturnValue({ eq: mockEq, limit: mockLimit });
    mockLimit.mockResolvedValue({ data: [], error: null });
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null });
    mockSingle.mockResolvedValue({ data: { org_id: 'org-123' }, error: null });
  });

  describe('generateVisibilityRecommendations', () => {
    it('should try multiple edge functions in sequence', async () => {
      const mockResult = { data: { inserted: 3, items: [] }, error: null };
      vi.mocked(invokeModule.invokeEdge).mockResolvedValue(mockResult);

      const result = await generateVisibilityRecommendations('prompt-123');

      expect(result.data).toBeDefined();
      expect(invokeModule.invokeEdge).toHaveBeenCalled();
    });

    it('should return error if all edge functions fail', async () => {
      vi.mocked(invokeModule.invokeEdge).mockResolvedValue({ data: null, error: new Error('Network error') });

      const result = await generateVisibilityRecommendations('prompt-123');
      
      expect(result.error).toBeTruthy();
    });
  });

  describe('listVisibilityRecommendations', () => {
    it('should fetch recommendations for a prompt', async () => {
      const mockRecs = [
        { id: '1', channel: 'content', title: 'Blog Post' },
        { id: '2', channel: 'social', title: 'LinkedIn Post' }
      ];
      mockOrder.mockResolvedValue({ data: mockRecs, error: null });

      const result = await listVisibilityRecommendations('prompt-123');

      expect(mockSelect).toHaveBeenCalledWith('*');
      expect(result).toEqual(mockRecs);
    });

    it('should throw if error occurs', async () => {
      mockOrder.mockResolvedValue({ data: null, error: new Error('Not found') });

      await expect(listVisibilityRecommendations('prompt-123')).rejects.toThrow('Not found');
    });

    it('should handle null data gracefully', async () => {
      mockOrder.mockResolvedValue({ data: null, error: null });

      const result = await listVisibilityRecommendations('prompt-123');

      expect(result).toEqual([]);
    });
  });

  describe('listAllOrgRecommendations', () => {
    it('should fetch all org recommendations', async () => {
      const mockRecs = [
        { id: '1', org_id: 'org-1', title: 'Rec 1' },
        { id: '2', org_id: 'org-1', title: 'Rec 2' }
      ];
      mockLimit.mockResolvedValue({ data: mockRecs, error: null });

      const result = await listAllOrgRecommendations();

      expect(result).toEqual(mockRecs);
    });

    it('should throw on error', async () => {
      mockLimit.mockResolvedValue({ data: null, error: new Error('DB error') });

      await expect(listAllOrgRecommendations()).rejects.toThrow('DB error');
    });
  });
});
