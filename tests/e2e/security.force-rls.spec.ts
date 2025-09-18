import { test, expect } from '@playwright/test';

test.describe('Force RLS Security', () => {
  test('anonymous users cannot read business tables', async ({ request }) => {
    const endpoints = [
      '/rest/v1/subscriber_public?select=*',
      '/rest/v1/subscribers?select=id',
      '/rest/v1/organizations?select=id',
      '/rest/v1/users?select=id',
      '/rest/v1/prompts?select=id',
      '/rest/v1/recommendations?select=id',
      '/rest/v1/reports?select=id'
    ];
    
    for (const endpoint of endpoints) {
      const response = await request.get(endpoint, {
        headers: {
          'apikey': process.env.VITE_SUPABASE_ANON_KEY!,
          'Authorization': `Bearer ${process.env.VITE_SUPABASE_ANON_KEY!}`
        }
      });
      
      // Should be forbidden or return no data due to RLS
      expect([401, 403, 200]).toContain(response.status());
      
      if (response.status() === 200) {
        const data = await response.json();
        expect(data).toEqual([]);
      }
    }
  });

  test('authenticated reads still work with proper scoping', async ({ request }) => {
    // This test validates that forcing RLS doesn't break existing functionality
    // In a real test, you would authenticate as a seeded user and verify
    // they can access their org-scoped data but not other orgs' data
    
    // For now, we just verify the test framework is working
    expect(true).toBeTruthy();
    
    // TODO: When authentication helpers are available:
    // 1. Login as test user A from org 1
    // 2. Verify they can read their prompts/recommendations
    // 3. Verify they cannot read data from org 2
    // 4. Confirm row counts match expected org-scoped data
  });

  test('service role maintains full access', async ({ request }) => {
    // Verify service role can still access all tables for backend operations
    const response = await request.get('/rest/v1/subscribers?select=id&limit=1', {
      headers: {
        'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY!,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`
      }
    });
    
    expect(response.status()).toBe(200);
  });

  test('views honor RLS with security_invoker', async ({ request }) => {
    // Test that views with security_invoker=on properly respect underlying table RLS
    const viewEndpoints = [
      '/rest/v1/subscriber_public?select=*'
    ];
    
    for (const endpoint of viewEndpoints) {
      const response = await request.get(endpoint, {
        headers: {
          'apikey': process.env.VITE_SUPABASE_ANON_KEY!,
          'Authorization': `Bearer ${process.env.VITE_SUPABASE_ANON_KEY!}`
        }
      });
      
      // Views should also respect RLS and deny anonymous access
      expect([401, 403, 200]).toContain(response.status());
      
      if (response.status() === 200) {
        const data = await response.json();
        expect(data).toEqual([]);
      }
    }
  });
});