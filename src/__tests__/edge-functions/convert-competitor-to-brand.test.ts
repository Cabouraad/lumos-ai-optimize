import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createClient } from '@supabase/supabase-js';

// Mock Supabase client
const mockSupabase = {
  auth: {
    getUser: vi.fn()
  },
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: vi.fn()
      }))
    })),
    update: vi.fn(() => ({
      eq: vi.fn(() => ({
        select: vi.fn()
      }))
    })),
    insert: vi.fn(() => ({
      select: vi.fn()
    })),
    upsert: vi.fn()
  })),
  functions: {
    invoke: vi.fn()
  }
};

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabase)
}));

describe('convert-competitor-to-brand Edge Function', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Authentication and Authorization', () => {
    it('should reject unauthorized requests (no auth header)', async () => {
      // Mock fetch to simulate calling the edge function without auth
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: () => Promise.resolve({
          error: 'Authentication required',
          code: 'UNAUTHORIZED'
        })
      });

      const response = await fetch('http://localhost:54321/functions/v1/convert-competitor-to-brand', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          competitorName: 'TestCompetitor'
        })
      });

      expect(response.status).toBe(401);
      
      const data = await response.json();
      expect(data.code).toBe('UNAUTHORIZED');
    });

    it('should reject requests with invalid JWT token', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: () => Promise.resolve({
          error: 'Invalid token',
          code: 'INVALID_TOKEN'
        })
      });

      const response = await fetch('http://localhost:54321/functions/v1/convert-competitor-to-brand', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer invalid-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          competitorName: 'TestCompetitor'
        })
      });

      expect(response.status).toBe(401);
    });

    it('should reject requests from users in wrong organization', async () => {
      // Mock successful auth but wrong org
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user1', email: 'test@example.com' } },
        error: null
      });

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { org_id: 'org2', role: 'owner' }, // Different org
              error: null
            })
          })
        }),
        update: vi.fn(),
        insert: vi.fn(),
        upsert: vi.fn()
      });

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: () => Promise.resolve({
          error: 'Access denied: Organization mismatch',
          code: 'ORG_MISMATCH'
        })
      });

      const response = await fetch('http://localhost:54321/functions/v1/convert-competitor-to-brand', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer valid-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          competitorName: 'TestCompetitor',
          orgId: 'org1' // User is in org2, requesting for org1
        })
      });

      expect(response.status).toBe(403);
    });

    it('should reject requests from non-owner users', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user1', email: 'test@example.com' } },
        error: null
      });

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { org_id: 'org1', role: 'member' }, // Not owner
              error: null
            })
          })
        }),
        update: vi.fn(),
        insert: vi.fn(),
        upsert: vi.fn()
      });

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: () => Promise.resolve({
          error: 'Access denied: requires role in [owner, admin], got: member',
          code: 'INSUFFICIENT_ROLE'
        })
      });

      const response = await fetch('http://localhost:54321/functions/v1/convert-competitor-to-brand', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer valid-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          competitorName: 'TestCompetitor',
          orgId: 'org1'
        })
      });

      expect(response.status).toBe(403);
      
      const data = await response.json();
      expect(data.code).toBe('INSUFFICIENT_ROLE');
    });
  });

  describe('Successful Operations', () => {
    beforeEach(() => {
      // Mock successful auth and proper role
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user1', email: 'test@example.com' } },
        error: null
      });

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { org_id: 'org1', role: 'owner' },
              error: null
            })
          })
        }),
        update: vi.fn(),
        insert: vi.fn(),
        upsert: vi.fn()
      });
    });

    it('should successfully convert competitor to brand', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          success: true,
          competitor_removed: true,
          brand_added: true,
          similarity_score: 0.85,
          details: {
            competitor_id: 'comp1',
            brand_id: 'brand1',
            organization_name: 'Test Org',
            competitor_name: 'TestCompetitor'
          }
        })
      });

      const response = await fetch('http://localhost:54321/functions/v1/convert-competitor-to-brand', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer valid-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          competitorName: 'TestCompetitor',
          orgId: 'org1'
        })
      });

      expect(response.ok).toBe(true);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.competitor_removed).toBe(true);
      expect(data.brand_added).toBe(true);
      expect(data.similarity_score).toBeGreaterThan(0.8);
    });

    it('should handle idempotent operations (same request twice)', async () => {
      // First call - successful conversion
      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({
            success: true,
            competitor_removed: true,
            brand_added: true,
            similarity_score: 0.85
          })
        })
        // Second call - should be idempotent
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({
            success: true,
            competitor_removed: false,
            brand_added: false,
            similarity_score: 0.85,
            message: 'Brand already exists as organization brand'
          })
        });

      const requestBody = {
        competitorName: 'TestCompetitor',
        orgId: 'org1'
      };

      // First request
      const response1 = await fetch('http://localhost:54321/functions/v1/convert-competitor-to-brand', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer valid-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      const data1 = await response1.json();
      expect(data1.success).toBe(true);
      expect(data1.competitor_removed).toBe(true);

      // Second request - should be idempotent
      const response2 = await fetch('http://localhost:54321/functions/v1/convert-competitor-to-brand', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer valid-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      const data2 = await response2.json();
      expect(data2.success).toBe(true);
      expect(data2.competitor_removed).toBe(false); // No change needed
      expect(data2.brand_added).toBe(false); // Already exists
    });

    it('should handle side effects correctly (update prompt responses)', async () => {
      // Mock that conversion also updates related prompt responses
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          success: true,
          competitor_removed: true,
          brand_added: true,
          responses_updated: 15, // Number of prompt responses updated
          similarity_score: 0.85,
          details: {
            updated_response_ids: ['resp1', 'resp2', 'resp3'],
            score_improvements: [2.5, 3.0, 1.8]
          }
        })
      });

      const response = await fetch('http://localhost:54321/functions/v1/convert-competitor-to-brand', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer valid-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          competitorName: 'HubSpot',
          orgId: 'org1'
        })
      });

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.responses_updated).toBeGreaterThan(0);
      expect(data.details.updated_response_ids).toHaveLength(3);
      expect(data.details.score_improvements).toEqual(
        expect.arrayContaining([expect.any(Number)])
      );
    });
  });

  describe('Input Validation', () => {
    beforeEach(() => {
      // Mock successful auth
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user1', email: 'test@example.com' } },
        error: null
      });

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { org_id: 'org1', role: 'owner' },
              error: null
            })
          })
        }),
        update: vi.fn(),
        insert: vi.fn(),
        upsert: vi.fn()
      });
    });

    it('should reject empty competitor name', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({
          error: 'Missing or invalid competitorName',
          code: 'VALIDATION_ERROR'
        })
      });

      const response = await fetch('http://localhost:54321/functions/v1/convert-competitor-to-brand', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer valid-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          competitorName: '',
          orgId: 'org1'
        })
      });

      expect(response.status).toBe(400);
    });

    it('should sanitize competitor name input', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          success: true,
          sanitized_name: 'TestCompetitor', // Should be cleaned
          original_name: '<script>alert("xss")</script>TestCompetitor'
        })
      });

      const response = await fetch('http://localhost:54321/functions/v1/convert-competitor-to-brand', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer valid-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          competitorName: '<script>alert("xss")</script>TestCompetitor',
          orgId: 'org1'
        })
      });

      const data = await response.json();
      expect(data.sanitized_name).toBe('TestCompetitor');
      expect(data.sanitized_name).not.toContain('<script>');
    });
  });

  describe('Error Handling', () => {
    it('should handle database connection errors gracefully', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({
          error: 'An unexpected error occurred',
          code: 'INTERNAL_ERROR'
        })
      });

      const response = await fetch('http://localhost:54321/functions/v1/convert-competitor-to-brand', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer valid-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          competitorName: 'TestCompetitor',
          orgId: 'org1'
        })
      });

      expect(response.status).toBe(500);
      
      const data = await response.json();
      expect(data.code).toBe('INTERNAL_ERROR');
      expect(data.error).not.toContain('database'); // Should not expose internal details
    });
  });
});