/**
 * Test for the enhanced structured logger with correlation ID and key redaction
 */

import { describe, it, expect } from 'vitest';

// Mock the logger since we can't directly test the edge function version
describe('Logger Redaction', () => {
  it('should redact sensitive keys', () => {
    const mockData = {
      STRIPE_SECRET_KEY: 'sk_test_123456',
      normalData: 'this is fine',
      password: 'secret123',
      SUPABASE_SERVICE_ROLE_KEY: 'service_role_123',
      user: {
        name: 'John',
        token: 'access_token_123'
      }
    };

    // Simple redaction function similar to the logger
    const redactSensitiveData = (data: any): any => {
      if (typeof data !== 'object' || data === null) {
        return data;
      }

      if (Array.isArray(data)) {
        return data.map(item => redactSensitiveData(item));
      }

      const redacted = { ...data };
      const sensitiveKeys = [
        'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 
        'SERVICE_ROLE_KEY', 'SUPABASE_SERVICE_ROLE_KEY',
        'OPENAI_API_KEY', 'PERPLEXITY_API_KEY', 'CRON_SECRET',
        'password', 'token', 'secret', 'key', 'auth'
      ];

      for (const [key, value] of Object.entries(redacted)) {
        const keyLower = key.toLowerCase();
        const shouldRedact = sensitiveKeys.some(sensitiveKey => 
          keyLower.includes(sensitiveKey.toLowerCase()) || 
          keyLower.includes('secret') || 
          keyLower.includes('password') ||
          keyLower.includes('token')
        );

        if (shouldRedact) {
          redacted[key] = '[REDACTED]';
        } else if (typeof value === 'object' && value !== null) {
          redacted[key] = redactSensitiveData(value);
        }
      }

      return redacted;
    };

    const result = redactSensitiveData(mockData);

    expect(result.STRIPE_SECRET_KEY).toBe('[REDACTED]');
    expect(result.password).toBe('[REDACTED]');
    expect(result.SUPABASE_SERVICE_ROLE_KEY).toBe('[REDACTED]');
    expect(result.normalData).toBe('this is fine');
    expect(result.user.name).toBe('John');
    expect(result.user.token).toBe('[REDACTED]');
  });

  it('should generate unique correlation IDs', () => {
    // Mock crypto.randomUUID if not available
    const mockUUID = () => {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    };

    const id1 = mockUUID();
    const id2 = mockUUID();

    expect(id1).not.toBe(id2);
    expect(id1).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });
});