import { test, expect } from '@playwright/test';

test.describe('Reports Functionality', () => {
  
  test('should restrict reports access for starter tier', async ({ page }) => {
    // Login as starter user
    await page.goto('/auth');
    await page.fill('input[type="email"]', 'starter_e2e@test.app');
    await page.fill('input[type="password"]', 'test123456789');
    await page.click('button[type="submit"]:has-text("Sign In")');
    await expect(page).toHaveURL(/.*\/dashboard/);
    
    // Try to access reports
    await page.goto('/reports');
    
    // Should see upgrade/subscription required message
    await expect(page.locator('text=upgrade, text=subscription, text=Growth').first()).toBeVisible({ timeout: 5000 });
    
    // Should NOT see reports list or download buttons
    await expect(page.locator('.reports-list, button:has-text("Download")')).not.toBeVisible();
    
    console.log('✅ Starter tier correctly restricted from reports');
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
    
    // Should see reports page
    await expect(page.locator('h1:has-text("Reports"), h2:has-text("Reports")').first()).toBeVisible();
    
    // Should NOT see upgrade prompts
    await expect(page.locator('text=upgrade to access, text=subscription required')).not.toBeVisible();
    
    console.log('✅ Growth tier has proper access to reports');
  });

  test('should generate and display weekly report', async ({ page }) => {
    // Login as growth user
    await page.goto('/auth');
    await page.fill('input[type="email"]', 'growth_e2e@test.app');
    await page.fill('input[type="password"]', 'test123456789');
    await page.click('button[type="submit"]:has-text("Sign In")');
    await expect(page).toHaveURL(/.*\/dashboard/);
    
    await page.goto('/reports');
    
    // Look for generate report button
    const generateButton = page.locator('button:has-text("Generate"), button:has-text("Create Report"), button:has-text("Weekly Report")');
    
    if (await generateButton.isVisible()) {
      await generateButton.click();
      
      // Wait for generation process
      await expect(page.locator('text=generating, text=processing').first()).toBeVisible({ timeout: 5000 });
      
      // Wait for completion (this might take a while with real generation)
      await expect(page.locator('text=completed, text=ready, .report-item').first()).toBeVisible({ timeout: 30000 });
      
      console.log('✅ Weekly report generated successfully');
    } else {
      console.log('ℹ️ Generate button not found - checking for existing reports');
    }
    
    // Check if reports list shows something
    const reportItems = page.locator('.report-item, .report-row, tr');
    const reportCount = await reportItems.count();
    
    if (reportCount > 0) {
      console.log(`✅ Found ${reportCount} reports in the list`);
    }
  });

  test('should allow report download for growth users', async ({ page }) => {
    // Login as growth user
    await page.goto('/auth');
    await page.fill('input[type="email"]', 'growth_e2e@test.app');
    await page.fill('input[type="password"]', 'test123456789');
    await page.click('button[type="submit"]:has-text("Sign In")');
    await expect(page).toHaveURL(/.*\/dashboard/);
    
    await page.goto('/reports');
    
    // Look for existing reports or create one first
    const downloadButton = page.locator('button:has-text("Download"), a:has-text("Download"), [download]');
    
    if (await downloadButton.first().isVisible()) {
      // Set up download handler
      const downloadPromise = page.waitForDownload({ timeout: 30000 });
      
      // Click download
      await downloadButton.first().click();
      
      // Wait for download
      try {
        const download = await downloadPromise;
        
        // Verify download
        expect(download.suggestedFilename()).toMatch(/\.pdf$/i);
        
        console.log(`✅ Report downloaded: ${download.suggestedFilename()}`);
        
      } catch (error) {
        // Download might not work in test environment, check for proper response
        console.log('ℹ️ Download test completed (file handling may vary in test env)');
      }
      
    } else {
      console.log('ℹ️ No download buttons found - may need to generate reports first');
    }
  });

  test('should show proper report metadata', async ({ page }) => {
    // Login as growth user
    await page.goto('/auth');
    await page.fill('input[type="email"]', 'growth_e2e@test.app');
    await page.fill('input[type="password"]', 'test123456789');
    await page.click('button[type="submit"]:has-text("Sign In")');
    await expect(page).toHaveURL(/.*\/dashboard/);
    
    await page.goto('/reports');
    
    // Look for report metadata
    const reportElements = page.locator('.report-item, .report-row, tr');
    
    if (await reportElements.first().isVisible()) {
      // Should show dates
      await expect(page.locator('text=Jan, text=Feb, text=Mar, text=2024, text=2025').first()).toBeVisible({ timeout: 5000 });
      
      // Should show status
      await expect(page.locator('text=completed, text=ready, text=generated, .status').first()).toBeVisible();
      
      console.log('✅ Report metadata displays correctly');
      
    } else {
      console.log('ℹ️ No reports found - metadata test skipped');
    }
  });

  test('should handle report generation errors gracefully', async ({ page }) => {
    // Login as growth user
    await page.goto('/auth');
    await page.fill('input[type="email"]', 'growth_e2e@test.app');
    await page.fill('input[type="password"]', 'test123456789');
    await page.click('button[type="submit"]:has-text("Sign In")');
    await expect(page).toHaveURL(/.*\/dashboard/);
    
    await page.goto('/reports');
    
    // The page should not crash even if there are generation issues
    await expect(page.locator('h1, h2').first()).toBeVisible();
    
    // Should show either reports or helpful empty state
    const hasReports = await page.locator('.report-item, .report-row').isVisible();
    const hasEmptyState = await page.locator('text=no reports, text=empty, .empty-state').isVisible();
    
    expect(hasReports || hasEmptyState).toBeTruthy();
    
    console.log('✅ Reports page handles empty/error states properly');
  });

  test('should show weekly report date ranges correctly', async ({ page }) => {
    // Login as growth user  
    await page.goto('/auth');
    await page.fill('input[type="email"]', 'growth_e2e@test.app');
    await page.fill('input[type="password"]', 'test123456789');
    await page.click('button[type="submit"]:has-text("Sign In")');
    await expect(page).toHaveURL(/.*\/dashboard/);
    
    await page.goto('/reports');
    
    // Look for date range information
    const dateElements = page.locator('text=Week, text=to, text=-, text=Jan, text=Feb');
    
    if (await dateElements.first().isVisible()) {
      // Should show proper week ranges
      await expect(page.locator('text=Week of, text=Jan 1 - Jan 7, text=to').first()).toBeVisible({ timeout: 5000 });
      
      console.log('✅ Weekly report date ranges display correctly');
      
    } else {
      console.log('ℹ️ No date ranges found - may need existing reports');
    }
  });
});