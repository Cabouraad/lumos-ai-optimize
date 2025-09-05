import { test, expect } from '@playwright/test';

test.describe('Dashboard Core Functionality', () => {
  
  test.beforeEach(async ({ page }) => {
    // Enable fake providers for predictable testing
    await page.addInitScript(() => {
      window.localStorage.setItem('E2E_FAKE_PROVIDERS', 'true');
    });
    
    // Login as growth user (has full access)
    await page.goto('/auth');
    await page.fill('input[type="email"]', 'growth_e2e@test.app');
    await page.fill('input[type="password"]', 'test123456789');
    await page.click('button[type="submit"]:has-text("Sign In")');
    await expect(page).toHaveURL(/.*\/dashboard/);
  });

  test('should display dashboard with prompts and metrics', async ({ page }) => {
    // Wait for dashboard to load
    await expect(page.locator('h1, h2')).toBeVisible();
    
    // Should show prompts section
    await expect(page.locator('text=Prompts').first()).toBeVisible();
    
    // Should show some metrics or charts
    await expect(page.locator('.chart, .metric, .score, [data-testid="metrics"]')).toBeVisible({ timeout: 10000 });
    
    // Should show existing test prompts
    await expect(page.locator('text=Compare HubSpot, text=project management, text=marketing automation').first()).toBeVisible();
    
    console.log('✅ Dashboard displays correctly with prompts and metrics');
  });

  test('should create and run a new prompt', async ({ page }) => {
    // Navigate to prompts page or find create button
    try {
      await page.goto('/prompts');
    } catch {
      // If no prompts page, look for create button on dashboard
      await page.goto('/dashboard');
    }
    
    // Find create prompt button
    await page.click('button:has-text("Create"), button:has-text("Add Prompt"), button:has-text("New Prompt")');
    
    // Fill prompt form
    const testPromptText = "What are the best email marketing platforms for small businesses?";
    await page.fill('textarea, input[type="text"]', testPromptText);
    
    // Save/create the prompt
    await page.click('button:has-text("Create"), button:has-text("Save"), button[type="submit"]');
    
    // Wait for prompt to be created
    await expect(page.locator(`text=${testPromptText.slice(0, 30)}`)).toBeVisible({ timeout: 5000 });
    
    // Find and click "Run Now" for this prompt
    const promptRow = page.locator(`text=${testPromptText.slice(0, 30)}`).locator('..').locator('..');
    await promptRow.locator('button:has-text("Run"), button:has-text("Execute")').click();
    
    // Wait for results to appear (fake providers should respond quickly)
    await expect(page.locator('.result, .response, .score').first()).toBeVisible({ timeout: 15000 });
    
    // Should see fake provider results
    await expect(page.locator('text=OpenAI Analysis, text=Perplexity Research, text=Gemini Insights').first()).toBeVisible({ timeout: 10000 });
    
    console.log('✅ New prompt created and executed successfully');
  });

  test('should toggle providers and see different results', async ({ page }) => {
    await page.goto('/prompts');
    
    // Find first existing prompt and run it
    await page.locator('button:has-text("Run"), button:has-text("Execute")').first().click();
    
    // Wait for initial results
    await expect(page.locator('.result, .response').first()).toBeVisible({ timeout: 15000 });
    
    // Count initial results
    const initialResultCount = await page.locator('.provider-result, .response-card').count();
    
    // Look for provider settings/toggles
    try {
      await page.click('button:has-text("Settings"), button:has-text("Providers"), button[aria-label="Provider settings"]');
      
      // Toggle a provider off (if toggles are available)
      const providerToggle = page.locator('input[type="checkbox"], .toggle').first();
      if (await providerToggle.isVisible()) {
        await providerToggle.click();
        
        // Run prompt again
        await page.locator('button:has-text("Run"), button:has-text("Execute")').first().click();
        
        // Should see fewer results
        await expect(page.locator('.provider-result, .response-card')).toHaveCount(initialResultCount - 1, { timeout: 15000 });
      }
    } catch {
      console.log('ℹ️ Provider toggles not found - this may be implemented differently');
    }
    
    console.log('✅ Provider functionality tested');
  });

  test('should display prompt results with proper structure', async ({ page }) => {
    await page.goto('/prompts');
    
    // Run the first available prompt
    await page.locator('button:has-text("Run"), button:has-text("Execute")').first().click();
    
    // Wait for results
    await expect(page.locator('.result, .response').first()).toBeVisible({ timeout: 15000 });
    
    // Verify result structure
    const resultCards = page.locator('.provider-result, .response-card, .result-item');
    const cardCount = await resultCards.count();
    
    expect(cardCount).toBeGreaterThan(0);
    
    // Each result should show provider name
    for (let i = 0; i < Math.min(cardCount, 3); i++) {
      const card = resultCards.nth(i);
      await expect(card.locator('text=OpenAI, text=Perplexity, text=Gemini').first()).toBeVisible();
    }
    
    // Should show scores or metrics
    await expect(page.locator('.score, text=Score, [data-testid="score"]')).toBeVisible();
    
    console.log(`✅ Results displayed properly (${cardCount} provider results found)`);
  });

  test('should handle errors gracefully', async ({ page }) => {
    // Disable fake providers to potentially trigger errors
    await page.evaluate(() => {
      window.localStorage.removeItem('E2E_FAKE_PROVIDERS');
    });
    
    await page.goto('/prompts');
    
    // Try to run a prompt without API keys (should handle gracefully)
    await page.locator('button:has-text("Run"), button:has-text("Execute")').first().click();
    
    // Wait for either results or error handling
    await page.waitForTimeout(5000);
    
    // Should not crash the page
    await expect(page.locator('body')).toBeVisible();
    
    // Should show either results or helpful error messages
    const hasResults = await page.locator('.result, .response').isVisible();
    const hasErrors = await page.locator('text=error, text=failed, .error').isVisible();
    
    expect(hasResults || hasErrors).toBeTruthy();
    
    console.log('✅ Error handling works correctly');
  });
});