#!/usr/bin/env node

/**
 * Puppeteer Prerendering Script for SEO
 * 
 * This script generates static HTML files for marketing pages by:
 * 1. Serving the built dist folder locally
 * 2. Using Puppeteer to visit each route and wait for content
 * 3. Capturing the fully-rendered HTML
 * 4. Overwriting the dist files with the prerendered content
 */

import puppeteer from 'puppeteer';
import { spawn } from 'child_process';
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST_DIR = join(__dirname, '..', 'dist');
const PORT = 3000;
const BASE_URL = `http://localhost:${PORT}`;

// Routes to prerender with their validation selectors/text
const ROUTES = [
  { 
    path: '/', 
    waitForSelector: 'h1',
    validateText: null, // Home page - just ensure h1 exists
    outputPath: 'index.html'
  },
  { 
    path: '/resources', 
    waitForSelector: 'h1',
    validateText: ['Resources', 'Guides', 'Blog', 'Insights'],
    outputPath: 'resources/index.html'
  },
  { 
    path: '/pricing', 
    waitForSelector: 'h1',
    validateText: ['Pricing', 'Plans', 'Price'],
    outputPath: 'pricing/index.html'
  },
  { 
    path: '/features', 
    waitForSelector: 'h1',
    validateText: ['Features', 'Platform'],
    outputPath: 'features/index.html'
  },
  { 
    path: '/demo', 
    waitForSelector: 'h1',
    validateText: ['Demo', 'Watch', 'Video'],
    outputPath: 'demo/index.html'
  },
  { 
    path: '/terms', 
    waitForSelector: 'h1',
    validateText: ['Terms', 'Service'],
    outputPath: 'terms/index.html'
  },
  { 
    path: '/privacy', 
    waitForSelector: 'h1',
    validateText: ['Privacy', 'Policy'],
    outputPath: 'privacy/index.html'
  }
];

let serverProcess = null;

async function startServer() {
  return new Promise((resolve, reject) => {
    console.log(`🚀 Starting local server on port ${PORT}...`);
    
    serverProcess = spawn('npx', ['serve', DIST_DIR, '-l', PORT.toString(), '-s'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true
    });

    serverProcess.stdout.on('data', (data) => {
      const output = data.toString();
      if (output.includes('Accepting connections') || output.includes('Serving')) {
        console.log('✅ Server started successfully');
        resolve();
      }
    });

    serverProcess.stderr.on('data', (data) => {
      // serve outputs to stderr for some messages, not always errors
      const output = data.toString();
      if (output.includes('Accepting connections') || output.includes('Serving')) {
        console.log('✅ Server started successfully');
        resolve();
      }
    });

    serverProcess.on('error', (err) => {
      reject(new Error(`Failed to start server: ${err.message}`));
    });

    // Fallback timeout - assume server is ready after 3 seconds
    setTimeout(() => {
      console.log('✅ Server assumed ready (timeout fallback)');
      resolve();
    }, 3000);
  });
}

function stopServer() {
  if (serverProcess) {
    console.log('🛑 Stopping local server...');
    serverProcess.kill('SIGTERM');
    serverProcess = null;
  }
}

async function prerenderRoute(browser, route) {
  const { path, waitForSelector, validateText, outputPath } = route;
  const url = `${BASE_URL}${path}`;
  
  console.log(`\n📄 Prerendering: ${path}`);
  console.log(`   URL: ${url}`);
  
  const page = await browser.newPage();
  
  try {
    // Set viewport for consistent rendering
    await page.setViewport({ width: 1280, height: 800 });
    
    // Navigate and wait for network to be idle
    console.log(`   ⏳ Navigating and waiting for network idle...`);
    await page.goto(url, { 
      waitUntil: 'networkidle0',
      timeout: 30000 
    });
    
    // Wait for the specific selector
    console.log(`   ⏳ Waiting for selector: ${waitForSelector}`);
    await page.waitForSelector(waitForSelector, { timeout: 10000 });
    
    // Wait for React hydration and snapSaveState signal
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check for snapSaveState (react-snap compatibility)
    await page.evaluate(() => {
      if (typeof window.snapSaveState === 'function') {
        window.snapSaveState();
      }
    });
    
    // Validate content if required
    if (validateText && validateText.length > 0) {
      console.log(`   🔍 Validating content contains: ${validateText.join(' or ')}`);
      
      const pageContent = await page.content();
      const hasValidContent = validateText.some(text => 
        pageContent.toLowerCase().includes(text.toLowerCase())
      );
      
      if (!hasValidContent) {
        console.warn(`   ⚠️ Warning: Page may not contain expected content`);
        // Continue anyway but log the warning
      } else {
        console.log(`   ✅ Content validation passed`);
      }
    }
    
    // Capture the fully rendered HTML
    let html = await page.content();
    
    // Ensure proper doctype
    if (!html.startsWith('<!DOCTYPE')) {
      html = '<!DOCTYPE html>' + html;
    }
    
    // Write to the output file
    const outputFilePath = join(DIST_DIR, outputPath);
    const outputDir = dirname(outputFilePath);
    
    // Ensure directory exists
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }
    
    writeFileSync(outputFilePath, html, 'utf-8');
    console.log(`   ✅ Saved: ${outputPath} (${(html.length / 1024).toFixed(1)} KB)`);
    
    return { success: true, path, outputPath };
    
  } catch (error) {
    console.error(`   ❌ Error prerendering ${path}: ${error.message}`);
    return { success: false, path, error: error.message };
    
  } finally {
    await page.close();
  }
}

async function verifyPrerender() {
  console.log('\n🔍 Verifying prerendered files...\n');
  
  const resourcesPath = join(DIST_DIR, 'resources', 'index.html');
  const homePath = join(DIST_DIR, 'index.html');
  
  if (!existsSync(resourcesPath)) {
    console.error('❌ resources/index.html does not exist!');
    return false;
  }
  
  const resourcesContent = readFileSync(resourcesPath, 'utf-8');
  const homeContent = readFileSync(homePath, 'utf-8');
  
  // Check that resources page has unique content
  const hasResourcesContent = 
    resourcesContent.toLowerCase().includes('resources') ||
    resourcesContent.toLowerCase().includes('guides') ||
    resourcesContent.toLowerCase().includes('blog');
  
  // Check that it's not identical to home page
  const isDifferentFromHome = resourcesContent !== homeContent;
  
  if (hasResourcesContent && isDifferentFromHome) {
    console.log('✅ Verification PASSED:');
    console.log('   - resources/index.html contains resources-specific content');
    console.log('   - resources/index.html is different from index.html');
    return true;
  } else {
    console.error('❌ Verification FAILED:');
    if (!hasResourcesContent) {
      console.error('   - resources/index.html does not contain expected content');
    }
    if (!isDifferentFromHome) {
      console.error('   - resources/index.html is identical to index.html');
    }
    return false;
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('        🔧 Puppeteer Prerendering for SEO                  ');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  let browser = null;
  
  try {
    // Check if dist folder exists
    if (!existsSync(DIST_DIR)) {
      throw new Error('dist folder not found. Run vite build first.');
    }
    
    // Try to launch Puppeteer - skip gracefully if Chrome not available
    console.log('\n🌐 Launching Puppeteer browser...');
    try {
      browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
    } catch (launchError) {
      console.log('⚠️  Puppeteer could not launch (Chrome not available in this environment)');
      console.log('   Skipping prerendering - build will complete without static HTML generation');
      console.log('   Run this script locally to generate prerendered pages.\n');
      process.exit(0); // Exit successfully to not block the build
    }
    console.log('✅ Browser launched');
    
    // Start local server
    await startServer();
    
    // Prerender each route
    const results = [];
    for (const route of ROUTES) {
      const result = await prerenderRoute(browser, route);
      results.push(result);
    }
    
    // Summary
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('                      Summary                              ');
    console.log('═══════════════════════════════════════════════════════════');
    
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    console.log(`✅ Successful: ${successful}`);
    console.log(`❌ Failed: ${failed}`);
    
    if (failed > 0) {
      console.log('\nFailed routes:');
      results.filter(r => !r.success).forEach(r => {
        console.log(`  - ${r.path}: ${r.error}`);
      });
    }
    
    // Verify the prerender worked correctly
    const verified = await verifyPrerender();
    
    if (!verified) {
      process.exit(1);
    }
    
    console.log('\n✨ Prerendering complete!\n');
    
  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    process.exit(1);
    
  } finally {
    // Cleanup
    if (browser) {
      console.log('🧹 Closing browser...');
      await browser.close();
    }
    stopServer();
  }
}

// Run the script
main();
