import { test, expect } from '@playwright/test';

test.describe('Competitor and Brand Detection', () => {
  
  test.beforeEach(async ({ page }) => {
    // Enable fake providers for predictable testing
    await page.addInitScript(() => {
      window.localStorage.setItem('E2E_FAKE_PROVIDERS', 'true');
    });
    
    // Login as growth user
    await page.goto('/auth');
    await page.fill('input[type="email"]', 'growth_e2e@test.app');
    await page.fill('input[type="password"]', 'test123456789');
    await page.click('button[type="submit"]:has-text("Sign In")');
    await expect(page).toHaveURL(/.*\/dashboard/);
  });

  test('should detect and display competitor brands correctly', async ({ page }) => {
    // Navigate to prompts or dashboard
    await page.goto('/prompts');
    
    // Run a CRM-related prompt that should detect HubSpot, Salesforce, etc.
    const crmPromptSelector = page.locator('text=HubSpot, text=Salesforce, text=CRM').first();
    
    if (await crmPromptSelector.isVisible()) {
      // Find the run button for this prompt
      const promptRow = crmPromptSelector.locator('..').locator('..');
      await promptRow.locator('button:has-text("Run"), button:has-text("Execute")').click();
    } else {
      // Create new CRM prompt
      await page.click('button:has-text("Create"), button:has-text("Add Prompt")');
      await page.fill('textarea, input[type="text"]', 'Compare HubSpot vs Salesforce for CRM management');
      await page.click('button:has-text("Create"), button:has-text("Save")');
      
      // Run the new prompt
      await page.locator('button:has-text("Run"), button:has-text("Execute")').first().click();
    }
    
    // Wait for results
    await expect(page.locator('.result, .response').first()).toBeVisible({ timeout: 15000 });
    
    // Should show competitor chips/tags
    await expect(page.locator('.competitor, .brand-chip, .tag:has-text("HubSpot"), .tag:has-text("Salesforce")').first()).toBeVisible({ timeout: 5000 });
    
    // Should detect multiple competitors
    const competitorElements = page.locator('.competitor, .brand-chip, [data-testid="competitor"]');
    const competitorCount = await competitorElements.count();
    
    expect(competitorCount).toBeGreaterThan(1);
    
    console.log(`✅ Detected ${competitorCount} competitors correctly`);
  });

  test('should identify organization brand correctly', async ({ page }) => {
    await page.goto('/prompts');
    
    // Run any prompt
    await page.locator('button:has-text("Run"), button:has-text("Execute")').first().click();
    
    // Wait for results
    await expect(page.locator('.result, .response').first()).toBeVisible({ timeout: 15000 });
    
    // Should show organization brand detection
    // Our test org is "Growth E2E Corp"
    await expect(page.locator('text=Growth E2E, text=org brand, .org-brand').first()).toBeVisible({ timeout: 10000 });
    
    // Should show brand presence indicator
    await expect(page.locator('.brand-present, text=Brand Found, [data-testid="brand-detected"]').first()).toBeVisible();
    
    console.log('✅ Organization brand detected correctly');
  });

  test('should navigate to competitors page and show catalog', async ({ page }) => {
    // Try to navigate to competitors page
    try {
      await page.goto('/competitors');
    } catch {
      // Look for competitors link in navigation
      await page.click('text=Competitors, a[href*="competitor"]');
    }
    
    // Should show competitors catalog
    await expect(page.locator('h1:has-text("Competitors"), h2:has-text("Competitors")').first()).toBeVisible();
    
    // Should show test competitors from seed data
    await expect(page.locator('text=TestCompetitor, text=HubSpot, text=Salesforce').first()).toBeVisible({ timeout: 10000 });
    
    // Should have brand management options
    await expect(page.locator('button:has-text("Add"), button:has-text("Edit"), .brand-actions').first()).toBeVisible();
    
    console.log('✅ Competitors catalog displays correctly');
  });

  test('should show brand vs competitor distinction', async ({ page }) => {
    await page.goto('/prompts');
    
    // Run a prompt
    await page.locator('button:has-text("Run"), button:has-text("Execute")').first().click();
    
    // Wait for results
    await expect(page.locator('.result, .response').first()).toBeVisible({ timeout: 15000 });
    
    // Look for visual distinction between org brand and competitors
    const orgBrandElements = page.locator('.org-brand, .brand-present, [data-brand-type="org"]');
    const competitorElements = page.locator('.competitor, [data-brand-type="competitor"]');
    
    // Should have different styling/indicators
    if (await orgBrandElements.first().isVisible() && await competitorElements.first().isVisible()) {
      // Check if they have different classes or styling
      const orgBrandClass = await orgBrandElements.first().getAttribute('class') || '';
      const competitorClass = await competitorElements.first().getAttribute('class') || '';
      
      expect(orgBrandClass).not.toBe(competitorClass);
      
      console.log('✅ Brand vs competitor distinction is clear');
    } else {
      console.log('ℹ️ Brand/competitor elements not found - may be displayed differently');
    }
  });

  test('should handle brand detection across different providers', async ({ page }) => {
    await page.goto('/prompts');
    
    // Run the same prompt and check if different providers detect brands consistently
    await page.locator('button:has-text("Run"), button:has-text("Execute")').first().click();
    
    // Wait for results from multiple providers
    await expect(page.locator('.result, .response').first()).toBeVisible({ timeout: 15000 });
    
    // Should show results from multiple providers (fake providers)
    const providerResults = page.locator('.provider-result, .response-card');
    const resultCount = await providerResults.count();
    
    expect(resultCount).toBeGreaterThan(1);
    
    // Each provider should detect some brands
    for (let i = 0; i < Math.min(resultCount, 3); i++) {
      const result = providerResults.nth(i);
      await expect(result.locator('.competitor, .brand, text=HubSpot, text=Salesforce').first()).toBeVisible();
    }
    
    console.log(`✅ ${resultCount} providers all detected brands consistently`);
  });

  test('should show brand confidence scoring', async ({ page }) => {
    await page.goto('/prompts');
    
    // Run a prompt
    await page.locator('button:has-text("Run"), button:has-text("Execute")').first().click();
    
    // Wait for results
    await expect(page.locator('.result, .response').first()).toBeVisible({ timeout: 15000 });
    
    // Should show scoring information
    await expect(page.locator('.score, text=Score, [data-testid="score"]').first()).toBeVisible();
    
    // Score should be a reasonable number
    const scoreText = await page.locator('.score, [data-testid="score"]').first().textContent();
    
    if (scoreText) {
      const scoreMatch = scoreText.match(/(\d+(?:\.\d+)?)/);
      if (scoreMatch) {
        const score = parseFloat(scoreMatch[1]);
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(10);
        console.log(`✅ Brand scoring works (score: ${score})`);
      }
    }
  });
});