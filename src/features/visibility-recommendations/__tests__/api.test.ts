import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateVisibilityRecommendations, listVisibilityRecommendations, listAllOrgRecommendations } from '../api';

// Mock the Supabase client
const mockInvoke = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockOrder = vi.fn();

vi.mock('@/lib/supabase/browser', () => ({
  getSupabaseBrowserClient: () => ({
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
    mockEq.mockReturnValue({ order: mockOrder });
    mockOrder.mockReturnValue({ eq: mockEq });
  });

  describe('generateVisibilityRecommendations', () => {
    it('should call the edge function with promptId', async () => {
      mockInvoke.mockResolvedValue({ data: { inserted: 3, recommendations: [] }, error: null });

      const result = await generateVisibilityRecommendations('prompt-123');

      expect(mockInvoke).toHaveBeenCalledWith('generate-visibility-recommendations', {
        body: { promptId: 'prompt-123' }
      });
      expect(result.inserted).toBe(3);
    });

    it('should throw error if edge function returns error', async () => {
      mockInvoke.mockResolvedValue({ data: null, error: new Error('Network error') });

      await expect(generateVisibilityRecommendations('prompt-123')).rejects.toThrow('Network error');
    });

    it('should throw custom error if data contains error field', async () => {
      mockInvoke.mockResolvedValue({ 
        data: { error: 'auth:getUser', detail: 'Invalid token' }, 
        error: null 
      });

      await expect(generateVisibilityRecommendations('prompt-123')).rejects.toThrow('auth:getUser: Invalid token');
    });

    it('should handle error without detail field', async () => {
      mockInvoke.mockResolvedValue({ 
        data: { error: 'missing:promptId' }, 
        error: null 
      });

      await expect(generateVisibilityRecommendations('prompt-123')).rejects.toThrow('missing:promptId');
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
      expect(mockEq).toHaveBeenCalledWith('prompt_id', 'prompt-123');
      expect(result).toEqual(mockRecs);
    });

    it('should return empty array if error occurs', async () => {
      mockOrder.mockResolvedValue({ data: null, error: new Error('Not found') });

      const result = await listVisibilityRecommendations('prompt-123');

      expect(result).toEqual([]);
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
      mockOrder.mockResolvedValue({ data: mockRecs, error: null });

      const result = await listAllOrgRecommendations();

      expect(mockSelect).toHaveBeenCalledWith('*');
      expect(result).toEqual(mockRecs);
    });

    it('should return empty array on error', async () => {
      mockOrder.mockResolvedValue({ data: null, error: new Error('DB error') });

      const result = await listAllOrgRecommendations();

      expect(result).toEqual([]);
    });
  });
});
