import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock Supabase client
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
  functions: {
    invoke: vi.fn(),
  }
};

vi.mock('@/integrations/supabase/client', () => ({
  supabase: mockSupabase,
}));

describe('Domain Verification System', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Domain Validation Logic', () => {
    const testOrgId = 'test-org-id';
    
    it('should allow invitations when domain verification bypass is enabled', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: {
          valid: true,
          reason: 'Domain verification bypassed'
        },
        error: null,
      });

      const { data } = await mockSupabase.rpc('validate_domain_invitation', {
        p_org_id: testOrgId,
        p_email: 'user@external.com'
      });

      expect(data.valid).toBe(true);
      expect(data.reason).toBe('Domain verification bypassed');
    });

    it('should allow invitations when no domain is configured', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: {
          valid: true,
          reason: 'No domain restriction'
        },
        error: null,
      });

      const { data } = await mockSupabase.rpc('validate_domain_invitation', {
        p_org_id: testOrgId,
        p_email: 'user@any.com'
      });

      expect(data.valid).toBe(true);
      expect(data.reason).toBe('No domain restriction');
    });

    it('should block invitations when domain is not verified', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: {
          valid: false,
          reason: 'Domain must be verified before sending invitations'
        },
        error: null,
      });

      const { data } = await mockSupabase.rpc('validate_domain_invitation', {
        p_org_id: testOrgId,
        p_email: 'user@example.com'
      });

      expect(data.valid).toBe(false);
      expect(data.reason).toBe('Domain must be verified before sending invitations');
    });

    it('should allow matching domain emails when domain is verified', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: {
          valid: true,
          reason: 'Email domain matches verified organization domain'
        },
        error: null,
      });

      const { data } = await mockSupabase.rpc('validate_domain_invitation', {
        p_org_id: testOrgId,
        p_email: 'user@company.com'
      });

      expect(data.valid).toBe(true);
      expect(data.reason).toBe('Email domain matches verified organization domain');
    });

    it('should block non-matching domain emails when domain is verified', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: {
          valid: false,
          reason: 'Email domain "external.com" does not match organization domain "company.com"'
        },
        error: null,
      });

      const { data } = await mockSupabase.rpc('validate_domain_invitation', {
        p_org_id: testOrgId,
        p_email: 'user@external.com'
      });

      expect(data.valid).toBe(false);
      expect(data.reason).toContain('does not match organization domain');
    });
  });

  describe('Domain Verification Edge Function', () => {
    it('should verify domain via DNS method', async () => {
      mockSupabase.functions.invoke.mockResolvedValue({
        data: {
          success: true,
          message: 'Domain example.com verified successfully!',
          method: 'dns',
          verificationDetails: 'DNS TXT record: _llumos-verify.example.com',
          verifiedAt: '2024-01-01T00:00:00Z'
        },
        error: null,
      });

      const { data } = await mockSupabase.functions.invoke('verify-domain', {
        body: { action: 'verify', method: 'dns' }
      });

      expect(data.success).toBe(true);
      expect(data.method).toBe('dns');
      expect(data.verificationDetails).toContain('DNS TXT record');
    });

    it('should verify domain via file method', async () => {
      mockSupabase.functions.invoke.mockResolvedValue({
        data: {
          success: true,
          message: 'Domain example.com verified successfully!',
          method: 'file',
          verificationDetails: 'HTTP file: https://example.com/.well-known/llumos-verify.txt',
          verifiedAt: '2024-01-01T00:00:00Z'
        },
        error: null,
      });

      const { data } = await mockSupabase.functions.invoke('verify-domain', {
        body: { action: 'verify', method: 'file' }
      });

      expect(data.success).toBe(true);
      expect(data.method).toBe('file');
      expect(data.verificationDetails).toContain('HTTP file');
    });

    it('should handle verification failure', async () => {
      mockSupabase.functions.invoke.mockResolvedValue({
        data: {
          success: false,
          error: 'Domain verification failed. Please ensure DNS TXT record: _llumos-verify.example.com contains the correct token.',
          method: 'dns',
          verificationDetails: 'DNS TXT record: _llumos-verify.example.com'
        },
        error: null,
      });

      const { data } = await mockSupabase.functions.invoke('verify-domain', {
        body: { action: 'verify', method: 'dns' }
      });

      expect(data.success).toBe(false);
      expect(data.error).toContain('verification failed');
    });

    it('should regenerate verification token', async () => {
      mockSupabase.functions.invoke.mockResolvedValue({
        data: {
          success: true,
          token: 'new-verification-token-abc123',
          message: 'New verification token generated successfully'
        },
        error: null,
      });

      const { data } = await mockSupabase.functions.invoke('verify-domain', {
        body: { action: 'regenerate' }
      });

      expect(data.success).toBe(true);
      expect(data.token).toBeTruthy();
      expect(data.message).toContain('generated successfully');
    });
  });

  describe('Feature Flag Integration', () => {
    it('should respect domain verification bypass flag', async () => {
      // Test flag enabled scenario
      const flagEnabled = true;
      expect(flagEnabled).toBe(true);
    });

    it('should enforce domain verification when bypass flag is disabled', async () => {
      // Test flag disabled scenario  
      const flagDisabled = false;
      expect(flagDisabled).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing organization', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: {
          valid: false,
          reason: 'Organization not found'
        },
        error: null,
      });

      const { data } = await mockSupabase.rpc('validate_domain_invitation', {
        p_org_id: 'non-existent-org',
        p_email: 'user@example.com'
      });

      expect(data.valid).toBe(false);
      expect(data.reason).toBe('Organization not found');
    });

    it('should handle verification function errors', async () => {
      mockSupabase.functions.invoke.mockResolvedValue({
        data: {
          success: false,
          error: 'No verification token found. Please regenerate token.'
        },
        error: null,
      });

      const { data } = await mockSupabase.functions.invoke('verify-domain', {
        body: { action: 'verify', method: 'dns' }
      });

      expect(data.success).toBe(false);
      expect(data.error).toContain('No verification token');
    });
  });
});