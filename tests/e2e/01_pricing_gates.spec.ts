import { test, expect } from '@playwright/test';

const TEST_USERS = [
  { email: 'starter_e2e@test.app', password: 'test123456789', tier: 'starter' },
  { email: 'growth_e2e@test.app', password: 'test123456789', tier: 'growth' }
];

test.describe('Pricing and Subscription Gates', () => {
  
  test.beforeEach(async ({ page }) => {
    // Set up fake providers for testing
    await page.addInitScript(() => {
      window.localStorage.setItem('E2E_FAKE_PROVIDERS', 'true');
    });
  });

  TEST_USERS.forEach(user => {
    test(`should show correct pricing tier - ${user.tier} user`, async ({ page }) => {
      // Login
      await page.goto('/auth');
      await page.fill('input[type="email"]', user.email);
      await page.fill('input[type="password"]', user.password);
      await page.click('button[type="submit"]:has-text("Sign In")');
      await expect(page).toHaveURL(/.*\/dashboard/);
      
      // Navigate to pricing page
      await page.goto('/pricing');
      
      if (user.tier === 'starter') {
        // Starter user should see Starter as selected/active
        await expect(page.locator('.pricing-card:has-text("Starter"), .plan-card:has-text("Starter")').first()).toHaveClass(/selected|active|current/);
        
        // Should see upgrade options for Growth/Pro
        await expect(page.locator('text=Upgrade, button:has-text("Choose Growth")')).toBeVisible();
        
      } else if (user.tier === 'growth') {
        // Growth user should see Growth as selected/active
        await expect(page.locator('.pricing-card:has-text("Growth"), .plan-card:has-text("Growth")').first()).toHaveClass(/selected|active|current/);
        
        // Should see manage subscription option
        await expect(page.locator('text=Manage, text=Current Plan')).toBeVisible();
      }
      
      console.log(`✅ ${user.email} sees correct pricing tier: ${user.tier}`);
    });

    test(`should handle subscription check - ${user.tier} user`, async ({ page }) => {
      // Login
      await page.goto('/auth');
      await page.fill('input[type="email"]', user.email);
      await page.fill('input[type="password"]', user.password);
      await page.click('button[type="submit"]:has-text("Sign In")');
      await expect(page).toHaveURL(/.*\/dashboard/);
      
      // Navigate to settings or subscription page
      try {
        await page.goto('/settings');
      } catch {
        // If no settings page, check dashboard for subscription info
        await page.goto('/dashboard');
      }
      
      // Should show subscription status
      await expect(page.locator(`text=${user.tier}, text=subscription`).first()).toBeVisible({ timeout: 5000 });
      
      console.log(`✅ ${user.email} subscription check completed`);
    });
  });

  test('should show trial information for new users', async ({ page }) => {
    // This test assumes that our test users have trial information
    await page.goto('/auth');
    await page.fill('input[type="email"]', 'starter_e2e@test.app');
    await page.fill('input[type="password"]', 'test123456789');
    await page.click('button[type="submit"]:has-text("Sign In")');
    await expect(page).toHaveURL(/.*\/dashboard/);
    
    // Look for trial indicators
    const trialElements = page.locator('text=trial, text=Trial, text=14 days, text=days remaining');
    
    // At least one trial indicator should be present
    await expect(trialElements.first()).toBeVisible({ timeout: 5000 });
    
    console.log('✅ Trial information is displayed');
  });

  test('should restrict reports access for starter tier', async ({ page }) => {
    // Login as starter user
    await page.goto('/auth');
    await page.fill('input[type="email"]', 'starter_e2e@test.app');
    await page.fill('input[type="password"]', 'test123456789');
    await page.click('button[type="submit"]:has-text("Sign In")');
    await expect(page).toHaveURL(/.*\/dashboard/);
    
    // Try to navigate to reports
    await page.goto('/reports');
    
    // Should see upgrade prompt or be redirected
    const upgradeElements = page.locator('text=Upgrade, text=Growth, text=subscription required');
    await expect(upgradeElements.first()).toBeVisible({ timeout: 5000 });
    
    // Should NOT see reports list
    await expect(page.locator('text=Download, .reports-list')).not.toBeVisible();
    
    console.log('✅ Starter tier properly restricted from reports');
  });

  test('should allow reports access for growth tier', async ({ page }) => {
    // Login as growth user
    await page.goto('/auth');
    await page.fill('input[type="email"]', 'growth_e2e@test.app');
    await page.fill('input[type="password"]', 'test123456789');
    await page.click('button[type="submit"]:has-text("Sign In")');
    await expect(page).toHaveURL(/.*\/dashboard/);
    
    // Navigate to reports
    await page.goto('/reports');
    
    // Should see reports interface (even if empty)
    await expect(page.locator('h1:has-text("Reports"), h2:has-text("Reports")')).toBeVisible();
    
    // Should NOT see upgrade prompts
    await expect(page.locator('text=Upgrade to access')).not.toBeVisible();
    
    console.log('✅ Growth tier has access to reports');
  });
});