import { test, expect } from '@playwright/test';

const TEST_USERS = [
  { email: 'starter_e2e@test.app', password: 'test123456789', tier: 'starter' },
  { email: 'growth_e2e@test.app', password: 'test123456789', tier: 'growth' }
];

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  TEST_USERS.forEach(user => {
    test(`should login and reach dashboard - ${user.tier} user`, async ({ page }) => {
      // Navigate to auth page
      await page.click('text=Sign In');
      await expect(page).toHaveURL(/.*\/auth/);

      // Fill login form
      await page.fill('input[type="email"]', user.email);
      await page.fill('input[type="password"]', user.password);
      
      // Submit login
      await page.click('button[type="submit"]:has-text("Sign In")');
      
      // Wait for redirect to dashboard
      await expect(page).toHaveURL(/.*\/dashboard/, { timeout: 10000 });
      
      // Verify dashboard elements are present
      await expect(page.locator('h1, h2').first()).toBeVisible();
      await expect(page.locator('text=Prompts, text=Dashboard').first()).toBeVisible();
      
      // Verify no authentication errors
      await expect(page.locator('text=Authentication failed, text=Invalid credentials')).not.toBeVisible();
      
      console.log(`✅ ${user.email} successfully logged in and reached dashboard`);
    });

    test(`should handle logout properly - ${user.tier} user`, async ({ page }) => {
      // Login first
      await page.goto('/auth');
      await page.fill('input[type="email"]', user.email);
      await page.fill('input[type="password"]', user.password);
      await page.click('button[type="submit"]:has-text("Sign In")');
      await expect(page).toHaveURL(/.*\/dashboard/);
      
      // Find and click logout button (might be in a menu or directly visible)
      try {
        await page.click('button:has-text("Sign Out"), button:has-text("Logout")');
      } catch {
        // Try menu-based logout
        await page.click('[aria-label="User menu"], [aria-label="Profile menu"]');
        await page.click('text=Sign Out, text=Logout');
      }
      
      // Should redirect to home page or auth page
      await expect(page).toHaveURL(/.*\/(auth|$)/, { timeout: 5000 });
      
      // Verify logged out state
      await expect(page.locator('text=Sign In, text=Login')).toBeVisible();
      
      console.log(`✅ ${user.email} successfully logged out`);
    });
  });

  test('should handle invalid credentials gracefully', async ({ page }) => {
    await page.goto('/auth');
    
    // Try invalid login
    await page.fill('input[type="email"]', 'invalid@test.app');
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button[type="submit"]:has-text("Sign In")');
    
    // Should show error message
    await expect(page.locator('text=Invalid, text=failed, text=error').first()).toBeVisible({ timeout: 5000 });
    
    // Should stay on auth page
    await expect(page).toHaveURL(/.*\/auth/);
    
    console.log('✅ Invalid credentials handled properly');
  });
});