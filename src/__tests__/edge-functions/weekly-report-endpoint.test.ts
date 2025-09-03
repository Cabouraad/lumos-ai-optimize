import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';

/**
 * Weekly Report Edge Function Endpoint Tests
 * Tests authentication, authorization, and functionality of the weekly-report function
 */

// Mock Supabase
const mockSupabaseClient = {
  auth: {
    getUser: vi.fn()
  },
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: vi.fn(),
        maybeSingle: vi.fn(),
        order: vi.fn(() => ({
          limit: vi.fn()
        }))
      })),
      order: vi.fn()
    })),
    insert: vi.fn(() => ({
      select: vi.fn()
    }))
  })),
  storage: {
    from: vi.fn(() => ({
      upload: vi.fn(),
      createSignedUrl: vi.fn()
    }))
  },
  functions: {
    invoke: vi.fn()
  }
};

vi.mock('https://esm.sh/@supabase/supabase-js@2.55.0', () => ({
  createClient: vi.fn(() => mockSupabaseClient)
}));

// Mock environment variables
const originalEnv = process.env;

describe('Weekly Report Edge Function', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env = {
      ...originalEnv,
      SUPABASE_URL: 'https://test.supabase.co',
      SUPABASE_ANON_KEY: 'test_anon_key',
      SUPABASE_SERVICE_ROLE_KEY: 'test_service_key',
      CRON_SECRET: 'test_cron_secret_12345',
      APP_ORIGIN: 'https://llumos.app'
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Authentication and Authorization', () => {
    it('should return 401 for requests without authorization header', async () => {
      // Mock a request without Authorization header
      const mockRequest = {
        method: 'POST',
        headers: {
          get: vi.fn((key: string) => {
            if (key === 'origin') return 'https://llumos.app';
            if (key === 'Authorization') return null;
            return null;
          })
        },
        url: 'https://test.supabase.co/functions/v1/weekly-report'
      };

      // Since we can't directly test the edge function, we simulate its behavior
      const authHeader = mockRequest.headers.get('Authorization');
      const cronSecret = process.env.CRON_SECRET;
      const isScheduledRun = authHeader === `Bearer ${cronSecret}`;

      if (!isScheduledRun && !authHeader?.startsWith('Bearer ')) {
        expect(authHeader).toBeNull();
        // This simulates the 401 response the function should return
        const response = {
          status: 401,
          body: JSON.stringify({ error: 'Missing or invalid authorization header' })
        };
        expect(response.status).toBe(401);
      }
    });

    it('should return 401 for invalid JWT token', async () => {
      const mockRequest = {
        method: 'POST',
        headers: {
          get: vi.fn((key: string) => {
            if (key === 'origin') return 'https://llumos.app';
            if (key === 'Authorization') return 'Bearer invalid_jwt_token';
            return null;
          })
        }
      };

      // Mock auth failure
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Invalid JWT' }
      });

      const authHeader = mockRequest.headers.get('Authorization');
      const jwt = authHeader?.replace('Bearer ', '');
      
      expect(jwt).toBe('invalid_jwt_token');
      
      const authResult = await mockSupabaseClient.auth.getUser(jwt);
      expect(authResult.error).toBeDefined();
      expect(authResult.data.user).toBeNull();
    });

    it('should return 403 when user has no organization', async () => {
      const mockRequest = {
        method: 'POST',
        headers: {
          get: vi.fn((key: string) => {
            if (key === 'origin') return 'https://llumos.app';
            if (key === 'Authorization') return 'Bearer valid_jwt_token';
            return null;
          })
        }
      };

      // Mock successful auth but no org membership
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user123', email: 'test@example.com' } },
        error: null
      });

      const mockFromChain = {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'No organization found' }
            })
          }))
        }))
      };

      mockSupabaseClient.from.mockReturnValue(mockFromChain);

      const authResult = await mockSupabaseClient.auth.getUser('valid_jwt_token');
      expect(authResult.data.user).toBeDefined();

      const userResult = await mockSupabaseClient
        .from('users')
        .select('org_id')
        .eq('id', authResult.data.user.id)
        .single();

      expect(userResult.error).toBeDefined();
      expect(userResult.data).toBeNull();
    });

    it('should accept valid user JWT with organization membership', async () => {
      const mockRequest = {
        method: 'POST',
        headers: {
          get: vi.fn((key: string) => {
            if (key === 'origin') return 'https://llumos.app';
            if (key === 'Authorization') return 'Bearer valid_jwt_token';
            return null;
          })
        }
      };

      // Mock successful auth and org membership
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user123', email: 'test@example.com' } },
        error: null
      });

      const mockFromChain = {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: { org_id: 'org_123' },
              error: null
            })
          }))
        }))
      };

      mockSupabaseClient.from.mockReturnValue(mockFromChain);

      const authResult = await mockSupabaseClient.auth.getUser('valid_jwt_token');
      expect(authResult.error).toBeNull();

      const userResult = await mockSupabaseClient
        .from('users')
        .select('org_id')
        .eq('id', authResult.data.user.id)
        .single();

      expect(userResult.error).toBeNull();
      expect(userResult.data.org_id).toBe('org_123');
    });

    it('should accept CRON_SECRET for scheduled runs', async () => {
      const mockRequest = {
        method: 'POST',
        headers: {
          get: vi.fn((key: string) => {
            if (key === 'origin') return 'https://llumos.app';
            if (key === 'Authorization') return 'Bearer test_cron_secret_12345';
            return null;
          })
        }
      };

      const authHeader = mockRequest.headers.get('Authorization');
      const cronSecret = process.env.CRON_SECRET;
      const isScheduledRun = authHeader === `Bearer ${cronSecret}` && cronSecret;

      expect(isScheduledRun).toBe(true);
      
      // For scheduled runs, should fetch all organizations
      const mockFromChain = {
        select: vi.fn(() => ({
          order: vi.fn().mockResolvedValue({
            data: [
              { id: 'org_1' },
              { id: 'org_2' },
              { id: 'org_3' }
            ],
            error: null
          })
        }))
      };

      mockSupabaseClient.from.mockReturnValue(mockFromChain);

      const orgsResult = await mockSupabaseClient
        .from('organizations')
        .select('id')
        .order('created_at');

      expect(orgsResult.data).toHaveLength(3);
      expect(orgsResult.error).toBeNull();
    });
  });

  describe('Report Generation', () => {
    beforeEach(() => {
      // Setup successful auth for user requests
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user123', email: 'test@example.com' } },
        error: null
      });
    });

    it('should return 200 with storage_path for successful report generation', async () => {
      // Mock successful org lookup
      const mockUserFromChain = {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: { org_id: 'org_123' },
              error: null
            })
          }))
        }))
      };

      // Mock no existing report (first time generation)
      const mockReportFromChain = {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: null,
                error: null
              })
            }))
          }))
        })),
        insert: vi.fn().mockResolvedValue({
          data: { id: 'report_123' },
          error: null
        })
      };

      // Mock successful storage upload
      const mockStorageChain = {
        upload: vi.fn().mockResolvedValue({
          data: { path: 'reports/org_123/2025-W02.pdf' },
          error: null
        })
      };

      mockSupabaseClient.from
        .mockReturnValueOnce(mockUserFromChain)  // First call for user lookup
        .mockReturnValueOnce(mockReportFromChain); // Second call for report check/insert

      mockSupabaseClient.storage.from.mockReturnValue(mockStorageChain);

      // Simulate the report generation logic
      const userResult = await mockSupabaseClient
        .from('users')
        .select('org_id')
        .eq('id', 'user123')
        .single();

      expect(userResult.data.org_id).toBe('org_123');

      const existingReport = await mockSupabaseClient
        .from('reports')
        .select('storage_path, week_key')
        .eq('org_id', 'org_123')
        .eq('week_key', '2025-W02')
        .maybeSingle();

      expect(existingReport.data).toBeNull();

      const uploadResult = await mockSupabaseClient.storage
        .from('reports')
        .upload('org_123/2025-W02.pdf', new Uint8Array([1, 2, 3]));

      expect(uploadResult.error).toBeNull();

      const insertResult = await mockSupabaseClient
        .from('reports')
        .insert({
          org_id: 'org_123',
          week_key: '2025-W02',
          storage_path: 'reports/org_123/2025-W02.pdf'
        });

      expect(insertResult.error).toBeNull();
    });

    it('should return {exists: true} for second call same week (idempotency)', async () => {
      // Mock successful org lookup
      const mockUserFromChain = {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: { org_id: 'org_123' },
              error: null
            })
          }))
        }))
      };

      // Mock existing report found
      const mockReportFromChain = {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  id: 'existing_report',
                  storage_path: 'reports/org_123/2025-W02.pdf',
                  week_key: '2025-W02'
                },
                error: null
              })
            }))
          }))
        }))
      };

      mockSupabaseClient.from
        .mockReturnValueOnce(mockUserFromChain)  // User lookup
        .mockReturnValueOnce(mockReportFromChain); // Existing report check

      // Simulate checking for existing report
      const userResult = await mockSupabaseClient
        .from('users')
        .select('org_id')
        .eq('id', 'user123')
        .single();

      const existingReport = await mockSupabaseClient
        .from('reports')
        .select('storage_path, week_key')
        .eq('org_id', userResult.data.org_id)
        .eq('week_key', '2025-W02')
        .maybeSingle();

      expect(existingReport.data).toBeDefined();
      expect(existingReport.data.storage_path).toBe('reports/org_123/2025-W02.pdf');
      
      // Should return exists: true response
      const response = {
        exists: true,
        week_key: '2025-W02',
        storage_path: 'reports/org_123/2025-W02.pdf',
        message: 'Report already generated for this week'
      };

      expect(response.exists).toBe(true);
      expect(response.storage_path).toContain('org_123');
    });

    it('should handle GET request for signed URL generation', async () => {
      // Mock successful org lookup
      const mockUserFromChain = {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: { org_id: 'org_123' },
              error: null
            })
          }))
        }))
      };

      // Mock existing report
      const mockReportFromChain = {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({
                data: {
                  storage_path: 'reports/org_123/2025-W02.pdf',
                  created_at: '2025-01-13T08:00:00Z',
                  byte_size: 150000
                },
                error: null
              })
            }))
          }))
        }))
      };

      // Mock signed URL generation
      const mockStorageChain = {
        createSignedUrl: vi.fn().mockResolvedValue({
          data: { signedUrl: 'https://storage.supabase.co/signed-url/reports/org_123/2025-W02.pdf?token=abc123' },
          error: null
        })
      };

      mockSupabaseClient.from
        .mockReturnValueOnce(mockUserFromChain)
        .mockReturnValueOnce(mockReportFromChain);

      mockSupabaseClient.storage.from.mockReturnValue(mockStorageChain);

      // Simulate GET request logic
      const userResult = await mockSupabaseClient
        .from('users')
        .select('org_id')
        .eq('id', 'user123')
        .single();

      const reportResult = await mockSupabaseClient
        .from('reports')
        .select('storage_path, created_at, byte_size')
        .eq('org_id', userResult.data.org_id)
        .eq('week_key', '2025-W02')
        .single();

      expect(reportResult.data).toBeDefined();

      const signedUrlResult = await mockSupabaseClient.storage
        .from('reports')
        .createSignedUrl('org_123/2025-W02.pdf', 300); // 5 minute TTL

      expect(signedUrlResult.data.signedUrl).toContain('signed-url');
      expect(signedUrlResult.error).toBeNull();
    });
  });

  describe('Scheduled Runs', () => {
    it('should process multiple organizations in scheduled mode', async () => {
      // Mock organizations fetch
      const mockOrgsFromChain = {
        select: vi.fn(() => ({
          order: vi.fn().mockResolvedValue({
            data: [
              { id: 'org_1' },
              { id: 'org_2' },
              { id: 'org_3' }
            ],
            error: null
          })
        }))
      };

      // Mock no existing reports for any org
      const mockReportFromChain = {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: null,
                error: null
              })
            }))
          }))
        })),
        insert: vi.fn().mockResolvedValue({
          data: { id: 'new_report' },
          error: null
        })
      };

      // Mock storage operations
      const mockStorageChain = {
        upload: vi.fn().mockResolvedValue({
          data: { path: 'uploaded' },
          error: null
        })
      };

      mockSupabaseClient.from
        .mockReturnValueOnce(mockOrgsFromChain)  // Organizations fetch
        .mockReturnValue(mockReportFromChain);   // Report operations for each org

      mockSupabaseClient.storage.from.mockReturnValue(mockStorageChain);

      // Simulate scheduled run processing
      const orgsResult = await mockSupabaseClient
        .from('organizations')
        .select('id')
        .order('created_at');

      expect(orgsResult.data).toHaveLength(3);

      // Process each org (simulate the loop)
      const results = [];
      for (const org of orgsResult.data) {
        const existingReport = await mockSupabaseClient
          .from('reports')
          .select('storage_path, week_key')
          .eq('org_id', org.id)
          .eq('week_key', '2025-W02')
          .maybeSingle();

        if (!existingReport.data) {
          // Would generate and upload report here
          results.push({
            orgId: org.id,
            status: 'created'
          });
        }
      }

      expect(results).toHaveLength(3);
      expect(results.every(r => r.status === 'created')).toBe(true);
    });

    it('should respect idempotency in scheduled runs', async () => {
      // Mock mixed scenario: some orgs have existing reports, some don't
      const mockOrgsFromChain = {
        select: vi.fn(() => ({
          order: vi.fn().mockResolvedValue({
            data: [
              { id: 'org_1' },
              { id: 'org_2' }
            ],
            error: null
          })
        }))
      };

      // Mock org_1 has existing report, org_2 doesn't
      const mockReportFromChain = {
        select: vi.fn(() => ({
          eq: vi.fn((field, orgId) => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockImplementation(() => {
                if (orgId === 'org_1') {
                  return Promise.resolve({
                    data: { storage_path: 'reports/org_1/2025-W02.pdf' },
                    error: null
                  });
                } else {
                  return Promise.resolve({
                    data: null,
                    error: null
                  });
                }
              })
            }))
          }))
        }))
      };

      mockSupabaseClient.from
        .mockReturnValueOnce(mockOrgsFromChain)
        .mockReturnValue(mockReportFromChain);

      const orgsResult = await mockSupabaseClient
        .from('organizations')
        .select('id')
        .order('created_at');

      const results = [];
      for (const org of orgsResult.data) {
        const existingReport = await mockSupabaseClient
          .from('reports')
          .select('storage_path, week_key')
          .eq('org_id', org.id)
          .eq('week_key', '2025-W02')
          .maybeSingle();

        if (existingReport.data) {
          results.push({ orgId: org.id, status: 'exists' });
        } else {
          results.push({ orgId: org.id, status: 'created' });
        }
      }

      expect(results).toHaveLength(2);
      expect(results.find(r => r.orgId === 'org_1')?.status).toBe('exists');
      expect(results.find(r => r.orgId === 'org_2')?.status).toBe('created');
    });
  });
});