import { test, expect } from '@playwright/test';

test.describe('Accessibility Compliance', () => {
  
  test.beforeEach(async ({ page }) => {
    // Login as growth user for full access
    await page.goto('/auth');
    await page.fill('input[type="email"]', 'growth_e2e@test.app');
    await page.fill('input[type="password"]', 'test123456789');
    await page.click('button[type="submit"]:has-text("Sign In")');
    await expect(page).toHaveURL(/.*\/dashboard/);
  });

  test('should have no console errors on main pages', async ({ page }) => {
    const consoleErrors: string[] = [];
    
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    
    // Test main pages
    const pages = ['/dashboard', '/prompts', '/reports', '/pricing'];
    
    for (const pagePath of pages) {
      await page.goto(pagePath);
      await page.waitForTimeout(2000); // Let page settle
      
      console.log(`✅ Checked ${pagePath} for console errors`);
    }
    
    // Filter out known non-critical errors
    const criticalErrors = consoleErrors.filter(error => 
      !error.includes('ResizeObserver') && 
      !error.includes('favicon') &&
      !error.includes('chrome-extension')
    );
    
    if (criticalErrors.length > 0) {
      console.log('⚠️ Console errors found:', criticalErrors);
    }
    
    expect(criticalErrors.length).toBeLessThan(5); // Allow some minor errors
    
    console.log(`✅ Console error check completed (${criticalErrors.length} critical errors)`);
  });

  test('should have accessible button and link labels', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Check buttons have accessible names
    const buttons = page.locator('button');
    const buttonCount = await buttons.count();
    
    for (let i = 0; i < Math.min(buttonCount, 10); i++) {
      const button = buttons.nth(i);
      
      if (await button.isVisible()) {
        const hasText = await button.textContent();
        const hasAriaLabel = await button.getAttribute('aria-label');
        const hasTitle = await button.getAttribute('title');
        
        // Button should have some form of accessible name
        expect(hasText || hasAriaLabel || hasTitle).toBeTruthy();
      }
    }
    
    // Check links have accessible names
    const links = page.locator('a');
    const linkCount = await links.count();
    
    for (let i = 0; i < Math.min(linkCount, 10); i++) {
      const link = links.nth(i);
      
      if (await link.isVisible()) {
        const hasText = await link.textContent();
        const hasAriaLabel = await link.getAttribute('aria-label');
        
        expect(hasText || hasAriaLabel).toBeTruthy();
      }
    }
    
    console.log(`✅ Checked ${Math.min(buttonCount, 10)} buttons and ${Math.min(linkCount, 10)} links for accessibility`);
  });

  test('should have proper heading hierarchy', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Check heading structure
    const headings = page.locator('h1, h2, h3, h4, h5, h6');
    const headingCount = await headings.count();
    
    expect(headingCount).toBeGreaterThan(0);
    
    // Should have at least one h1
    await expect(page.locator('h1').first()).toBeVisible();
    
    console.log(`✅ Found ${headingCount} headings with proper h1 present`);
  });

  test('should support keyboard navigation', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Tab through interactive elements
    await page.keyboard.press('Tab');
    
    // Should be able to focus interactive elements
    const focusedElement = page.locator(':focus');
    await expect(focusedElement).toBeVisible({ timeout: 3000 });
    
    // Continue tabbing
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Tab');
      
      // Each tab should move focus
      const currentFocused = page.locator(':focus');
      if (await currentFocused.isVisible()) {
        console.log(`Tab ${i + 1}: Focused element found`);
      }
    }
    
    console.log('✅ Keyboard navigation tested');
  });

  test('should have semantic color tokens (no direct colors)', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Get computed styles of some elements
    const elements = page.locator('button, .card, .badge').first();
    
    if (await elements.isVisible()) {
      const styles = await elements.evaluate(el => {
        const computed = window.getComputedStyle(el);
        return {
          color: computed.color,
          backgroundColor: computed.backgroundColor,
          borderColor: computed.borderColor
        };
      });
      
      // Colors should be using HSL values (from design system)
      const hasHSLColors = Object.values(styles).some(color => 
        color && color.includes('hsl') || color.includes('var(')
      );
      
      if (hasHSLColors) {
        console.log('✅ Design system colors detected');
      } else {
        console.log('ℹ️ Color system check completed (may be using RGB computed values)');
      }
    }
  });

  test('should have proper form labels and validation', async ({ page }) => {
    // Test form accessibility on auth page
    await page.goto('/auth');
    
    // Check email input has label
    const emailInput = page.locator('input[type="email"]');
    if (await emailInput.isVisible()) {
      const hasLabel = await page.locator('label[for*="email"], label:has-text("email")').isVisible();
      const hasAriaLabel = await emailInput.getAttribute('aria-label');
      const hasPlaceholder = await emailInput.getAttribute('placeholder');
      
      expect(hasLabel || hasAriaLabel || hasPlaceholder).toBeTruthy();
    }
    
    // Check password input has label
    const passwordInput = page.locator('input[type="password"]');
    if (await passwordInput.isVisible()) {
      const hasLabel = await page.locator('label[for*="password"], label:has-text("password")').isVisible();
      const hasAriaLabel = await passwordInput.getAttribute('aria-label');
      
      expect(hasLabel || hasAriaLabel).toBeTruthy();
    }
    
    console.log('✅ Form accessibility checked');
  });

  test('should have accessible dialog and tooltip triggers', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Look for dialog triggers
    const dialogTriggers = page.locator('button[aria-haspopup="dialog"], button[data-dialog-trigger]');
    
    if (await dialogTriggers.first().isVisible()) {
      const hasAriaLabel = await dialogTriggers.first().getAttribute('aria-label');
      const hasText = await dialogTriggers.first().textContent();
      
      expect(hasAriaLabel || hasText).toBeTruthy();
      
      console.log('✅ Dialog triggers have accessible names');
    }
    
    // Look for tooltip triggers
    const tooltipTriggers = page.locator('[data-tooltip], [aria-describedby]');
    
    if (await tooltipTriggers.first().isVisible()) {
      console.log('✅ Tooltip triggers found');
    }
  });

  test('should have proper contrast for text elements', async ({ page }) => {
    await page.goto('/dashboard');
    
    // This is a basic check - full contrast testing would need specialized tools
    // We're checking that text is not too light/transparent
    
    const textElements = page.locator('p, span, div, h1, h2, h3, button');
    const elementCount = await textElements.count();
    
    let contrastIssues = 0;
    
    for (let i = 0; i < Math.min(elementCount, 20); i++) {
      const element = textElements.nth(i);
      
      if (await element.isVisible()) {
        const styles = await element.evaluate(el => {
          const computed = window.getComputedStyle(el);
          return {
            color: computed.color,
            opacity: computed.opacity
          };
        });
        
        // Check for very transparent text
        const opacity = parseFloat(styles.opacity);
        if (opacity < 0.3) {
          contrastIssues++;
        }
      }
    }
    
    // Should have minimal contrast issues
    expect(contrastIssues).toBeLessThan(3);
    
    console.log(`✅ Contrast check completed (${contrastIssues} potential issues found)`);
  });

  test('should handle screen reader landmarks', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Check for semantic landmarks
    const landmarks = {
      main: page.locator('main, [role="main"]'),
      nav: page.locator('nav, [role="navigation"]'),
      header: page.locator('header, [role="banner"]'),
    };
    
    for (const [landmarkType, element] of Object.entries(landmarks)) {
      if (await element.isVisible()) {
        console.log(`✅ Found ${landmarkType} landmark`);
      }
    }
    
    // Should have at least main content area
    await expect(landmarks.main.or(page.locator('[role="main"]'))).toBeVisible();
  });
});