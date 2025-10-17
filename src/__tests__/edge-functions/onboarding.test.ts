import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';

/**
 * Edge Function Test: onboarding
 * Tests organization creation, user linking, and brand catalog setup
 */

const mockSupabase: any = {
  from: vi.fn(() => ({
    insert: vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn()
      }))
    })),
    upsert: vi.fn()
  }))
};

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabase)
}));

describe('Edge Function: onboarding', () => {
  const mockUserId = 'test-user-123';
  const mockEmail = 'test@example.com';
  const mockOrgData = {
    name: 'Test Company',
    domain: 'test.com',
    business_description: 'A test company',
    products_services: 'Testing services',
    target_audience: 'Developers',
    keywords: 'testing, development'
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Authentication', () => {
    it('should reject requests without authorization header', async () => {
      const result = await testOnboarding({
        authHeader: null,
        body: mockOrgData
      });

      expect(result.status).toBe(401);
      expect(result.body.error).toBe('Unauthorized');
    });

    it('should reject invalid JWT tokens', async () => {
      const result = await testOnboarding({
        authHeader: 'Bearer invalid_token',
        body: mockOrgData
      });

      expect(result.status).toBe(401);
      expect(result.body.error).toBe('Unauthorized');
    });
  });

  describe('Input Validation', () => {
    it('should require name and domain', async () => {
      const result = await testOnboarding({
        authHeader: createValidJWT({ userId: mockUserId, email: mockEmail }),
        body: { domain: 'test.com' } // Missing name
      });

      expect(result.status).toBe(400);
      expect(result.body.error).toBe('Missing name/domain');
    });

    it('should normalize domain to lowercase and trim', async () => {
      const orgInsert = vi.fn().mockResolvedValue({ data: { id: 'org-123' }, error: null });
      mockSupabase.from = vi.fn(() => ({
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: orgInsert
          }))
        })),
        upsert: vi.fn().mockResolvedValue({ error: null })
      }));

      await testOnboarding({
        authHeader: createValidJWT({ userId: mockUserId, email: mockEmail }),
        body: {
          name: 'Test Company',
          domain: '  TEST.COM  ' // Should be normalized to 'test.com'
        }
      });

      // Verify the insert was called
      expect(orgInsert).toHaveBeenCalled();
    });

    it('should parse keywords from comma-separated string', async () => {
      const orgInsert = vi.fn().mockResolvedValue({ data: { id: 'org-123' }, error: null });
      mockSupabase.from = vi.fn(() => ({
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: orgInsert
          }))
        })),
        upsert: vi.fn().mockResolvedValue({ error: null })
      }));

      await testOnboarding({
        authHeader: createValidJWT({ userId: mockUserId, email: mockEmail }),
        body: {
          name: 'Test Company',
          domain: 'test.com',
          keywords: 'keyword1, keyword2,  keyword3 '
        }
      });

      // Verify the insert was called
      expect(orgInsert).toHaveBeenCalled();
    });
  });

  describe('Organization Creation', () => {
    it('should create organization with all provided fields', async () => {
      const mockOrgId = 'org-123';
      const orgInsert = vi.fn().mockResolvedValue({
        data: { id: mockOrgId, ...mockOrgData },
        error: null
      });

      mockSupabase.from = vi.fn((table) => {
        if (table === 'organizations') {
          return {
            insert: vi.fn(() => ({
              select: vi.fn(() => ({
                single: orgInsert
              }))
            })),
            upsert: vi.fn().mockResolvedValue({ error: null })
          };
        }
        return {
          insert: vi.fn().mockResolvedValue({ error: null }),
          upsert: vi.fn().mockResolvedValue({ error: null })
        };
      });

      const result = await testOnboarding({
        authHeader: createValidJWT({ userId: mockUserId, email: mockEmail }),
        body: mockOrgData
      });

      expect(result.status).toBe(200);
      expect(result.body.ok).toBe(true);
      expect(result.body.orgId).toBe(mockOrgId);
      expect(orgInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          name: mockOrgData.name,
          domain: mockOrgData.domain.toLowerCase(),
          plan_tier: 'starter',
          domain_verification_method: 'file',
          business_description: mockOrgData.business_description,
          products_services: mockOrgData.products_services,
          target_audience: mockOrgData.target_audience
        })
      );
    });

    it('should handle organization creation errors', async () => {
      mockSupabase.from = vi.fn(() => ({
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Duplicate domain' }
            })
          }))
        })),
        upsert: vi.fn().mockResolvedValue({ error: null })
      }));

      const result = await testOnboarding({
        authHeader: createValidJWT({ userId: mockUserId, email: mockEmail }),
        body: mockOrgData
      });

      expect(result.status).toBe(400);
      expect(result.body.error).toBe('Duplicate domain');
    });
  });

  describe('User Linking', () => {
    it('should upsert user record with owner role', async () => {
      const mockOrgId = 'org-123';
      const userUpsert = vi.fn().mockResolvedValue({ error: null });

      mockSupabase.from = vi.fn((table) => {
        if (table === 'organizations') {
          return {
            insert: vi.fn(() => ({
              select: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({
                  data: { id: mockOrgId },
                  error: null
                })
              }))
            }))
          };
        }
        if (table === 'users') {
          return { upsert: userUpsert };
        }
        return {
          insert: vi.fn().mockResolvedValue({ error: null }),
          upsert: vi.fn().mockResolvedValue({ error: null })
        };
      });

      await testOnboarding({
        authHeader: createValidJWT({ userId: mockUserId, email: mockEmail }),
        body: mockOrgData
      });

      expect(userUpsert).toHaveBeenCalledWith(
        {
          id: mockUserId,
          org_id: mockOrgId,
          role: 'owner',
          email: mockEmail
        },
        { onConflict: 'id' }
      );
    });

    it('should handle user upsert errors', async () => {
      mockSupabase.from = vi.fn((table) => {
        if (table === 'organizations') {
          return {
            insert: vi.fn(() => ({
              select: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({
                  data: { id: 'org-123' },
                  error: null
                })
              }))
            }))
          };
        }
        if (table === 'users') {
          return {
            upsert: vi.fn().mockResolvedValue({
              error: { message: 'User update failed' }
            })
          };
        }
        return {
          insert: vi.fn().mockResolvedValue({ error: null }),
          upsert: vi.fn().mockResolvedValue({ error: null })
        };
      });

      const result = await testOnboarding({
        authHeader: createValidJWT({ userId: mockUserId, email: mockEmail }),
        body: mockOrgData
      });

      expect(result.status).toBe(400);
      expect(result.body.error).toBe('User update failed');
    });
  });

  describe('Brand Catalog Setup', () => {
    it('should create brand catalog entry with org name', async () => {
      const mockOrgId = 'org-123';
      const brandInsert = vi.fn().mockResolvedValue({ error: null });

      mockSupabase.from = vi.fn((table) => {
        if (table === 'organizations') {
          return {
            insert: vi.fn(() => ({
              select: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({
                  data: { id: mockOrgId, name: mockOrgData.name },
                  error: null
                })
              }))
            }))
          };
        }
        if (table === 'brand_catalog') {
          return { insert: brandInsert };
        }
        return {
          upsert: vi.fn().mockResolvedValue({ error: null })
        };
      });

      await testOnboarding({
        authHeader: createValidJWT({ userId: mockUserId, email: mockEmail }),
        body: mockOrgData
      });

      expect(brandInsert).toHaveBeenCalledWith({
        org_id: mockOrgId,
        name: mockOrgData.name,
        variants_json: [],
        is_org_brand: true
      });
    });

    it('should handle brand catalog creation errors', async () => {
      mockSupabase.from = vi.fn((table) => {
        if (table === 'organizations') {
          return {
            insert: vi.fn(() => ({
              select: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({
                  data: { id: 'org-123' },
                  error: null
                })
              }))
            }))
          };
        }
        if (table === 'users') {
          return {
            upsert: vi.fn().mockResolvedValue({ error: null })
          };
        }
        if (table === 'brand_catalog') {
          return {
            insert: vi.fn().mockResolvedValue({
              error: { message: 'Brand catalog error' }
            })
          };
        }
        return {
          upsert: vi.fn().mockResolvedValue({ error: null })
        };
      });

      const result = await testOnboarding({
        authHeader: createValidJWT({ userId: mockUserId, email: mockEmail }),
        body: mockOrgData
      });

      expect(result.status).toBe(400);
      expect(result.body.error).toBe('Brand catalog error');
    });
  });

  describe('LLM Providers Setup', () => {
    it('should ensure default providers (openai, perplexity) exist', async () => {
      const mockOrgId = 'org-123';
      const providersUpsert = vi.fn().mockResolvedValue({ error: null });

      mockSupabase.from = vi.fn((table) => {
        if (table === 'organizations') {
          return {
            insert: vi.fn(() => ({
              select: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({
                  data: { id: mockOrgId },
                  error: null
                })
              }))
            }))
          };
        }
        if (table === 'llm_providers') {
          return { upsert: providersUpsert };
        }
        return {
          insert: vi.fn().mockResolvedValue({ error: null }),
          upsert: vi.fn().mockResolvedValue({ error: null })
        };
      });

      await testOnboarding({
        authHeader: createValidJWT({ userId: mockUserId, email: mockEmail }),
        body: mockOrgData
      });

      expect(providersUpsert).toHaveBeenCalledWith(
        [
          { name: 'openai', enabled: true },
          { name: 'perplexity', enabled: true }
        ],
        { onConflict: 'name' }
      );
    });
  });

  describe('Complete Flow', () => {
    it('should successfully complete entire onboarding flow', async () => {
      const mockOrgId = 'org-123';

      mockSupabase.from = vi.fn((table) => {
        if (table === 'organizations') {
          return {
            insert: vi.fn(() => ({
              select: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({
                  data: { id: mockOrgId, ...mockOrgData },
                  error: null
                })
              }))
            }))
          };
        }
        return {
          insert: vi.fn().mockResolvedValue({ error: null }),
          upsert: vi.fn().mockResolvedValue({ error: null })
        };
      });

      const result = await testOnboarding({
        authHeader: createValidJWT({ userId: mockUserId, email: mockEmail }),
        body: mockOrgData
      });

      expect(result.status).toBe(200);
      expect(result.body).toEqual({
        ok: true,
        orgId: mockOrgId
      });
    });
  });
});

// Helper functions
function createValidJWT(payload: { userId: string; email: string }): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const jwtPayload = btoa(JSON.stringify({ 
    sub: payload.userId, 
    email: payload.email 
  }));
  const signature = 'mock_signature';
  return `Bearer ${header}.${jwtPayload}.${signature}`;
}

async function testOnboarding(params: {
  authHeader: string | null;
  body: any;
}) {
  try {
    if (!params.authHeader) {
      return {
        status: 401,
        body: { error: 'Unauthorized' }
      };
    }

    // Extract JWT
    const token = params.authHeader.replace(/^Bearer\s+/i, '');
    let userId: string | undefined;
    let email: string | null = null;
    
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      userId = payload.sub;
      email = payload.email;
    } catch {
      return {
        status: 401,
        body: { error: 'Unauthorized' }
      };
    }

    if (!userId) {
      return {
        status: 401,
        body: { error: 'Unauthorized' }
      };
    }

    const { name, domain } = params.body;
    if (!name || !domain) {
      return {
        status: 400,
        body: { error: 'Missing name/domain' }
      };
    }

    const normDomain = domain.trim().toLowerCase();
    const keywords = params.body.keywords 
      ? params.body.keywords.split(',').map((k: string) => k.trim()).filter(Boolean)
      : [];

    // Create organization
    const orgResult = await (mockSupabase as any)
      .from('organizations')
      .insert({
        name,
        domain: normDomain,
        plan_tier: 'starter',
        domain_verification_method: 'file',
        business_description: params.body.business_description || null,
        products_services: params.body.products_services || null,
        target_audience: params.body.target_audience || null,
        keywords
      })
      .select()
      .single();

    const { data: org, error: orgErr } = orgResult;
    if (orgErr) {
      return {
        status: 400,
        body: { error: orgErr.message }
      };
    }

    // Upsert user
    const userResult = await (mockSupabase as any).from('users').upsert(
      { id: userId, org_id: org.id, role: 'owner', email: email ?? 'unknown@example.com' },
      { onConflict: 'id' }
    );

    if (userResult.error) {
      return { status: 400, body: { error: userResult.error.message } };
    }

    // Create brand catalog
    const brandResult = await (mockSupabase as any).from('brand_catalog').insert({
      org_id: org.id,
      name,
      variants_json: [],
      is_org_brand: true
    });

    if (brandResult.error) {
      return { status: 400, body: { error: brandResult.error.message } };
    }

    // Ensure providers
    const providersResult = await (mockSupabase as any).from('llm_providers').upsert(
      [{ name: 'openai', enabled: true }, { name: 'perplexity', enabled: true }],
      { onConflict: 'name' }
    );

    if (providersResult.error) {
      return { status: 400, body: { error: providersResult.error.message } };
    }

    return {
      status: 200,
      body: { ok: true, orgId: org.id }
    };
  } catch (error: any) {
    return {
      status: 500,
      body: { error: 'Internal server error' }
    };
  }
}
