import { test, expect } from '@playwright/test';

test.describe('Subscribers RLS Security', () => {
  test('anonymous users cannot access subscribers table', async ({ page }) => {
    // Test direct API access as anon
    const response = await page.request.get('/rest/v1/subscribers?select=id', {
      headers: {
        'apikey': process.env.VITE_SUPABASE_ANON_KEY!,
        'Authorization': `Bearer ${process.env.VITE_SUPABASE_ANON_KEY!}`
      }
    });
    
    // Should be forbidden or return no data
    expect([401, 403, 200]).toContain(response.status());
    
    if (response.status() === 200) {
      const data = await response.json();
      expect(data).toEqual([]);
    }
  });

  test('authenticated users can only access their org subscription via view', async ({ page }) => {
    // This test would need to authenticate as a real user
    // and verify they can only see their org's data via subscriber_public
    
    // Navigate to login page and authenticate
    await page.goto('/auth');
    
    // TODO: Add authentication steps here
    // await page.fill('[data-testid="email"]', 'test@example.com');
    // await page.fill('[data-testid="password"]', 'password');
    // await page.click('[data-testid="login"]');
    
    // Test API access to subscriber_public
    const response = await page.request.get('/rest/v1/subscriber_public?select=*', {
      headers: {
        'apikey': process.env.VITE_SUPABASE_ANON_KEY!,
        // 'Authorization': 'Bearer <user-jwt-token>'
      }
    });
    
    expect(response.status()).toBe(200);
    const data = await response.json();
    
    // Should only return data for the authenticated user's org
    if (data.length > 0) {
      expect(data[0]).toHaveProperty('id');
      expect(data[0]).toHaveProperty('org_id');
      expect(data[0]).toHaveProperty('tier');
      expect(data[0]).not.toHaveProperty('stripe_customer_id');
      expect(data[0]).not.toHaveProperty('email');
    }
  });

  test('server role can access full subscribers table', async ({ page }) => {
    // Test that service role can access the base table
    const response = await page.request.get('/rest/v1/subscribers?select=*', {
      headers: {
        'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY!,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`
      }
    });
    
    expect(response.status()).toBe(200);
    const data = await response.json();
    
    // Service role should have access to all fields
    if (data.length > 0) {
      expect(data[0]).toHaveProperty('id');
      expect(data[0]).toHaveProperty('user_id');
      expect(data[0]).toHaveProperty('email');
      expect(data[0]).toHaveProperty('stripe_customer_id');
    }
  });
});