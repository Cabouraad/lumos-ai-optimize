#!/usr/bin/env -S deno run --allow-all

/**
 * Test Runner for Org Brand Detection (HubSpot CRM fix)
 * 
 * Usage: deno run --allow-all test-org-brand-detection.ts
 */

import { runOrgBrandDetectionTests } from './supabase/functions/_shared/tests/org-brand-detection.test.ts';

async function main() {
  try {
    console.log('🚀 Starting Org Brand Detection Test Suite...');
    console.log('============================================');
    
    const startTime = Date.now();
    const results = await runOrgBrandDetectionTests();
    const endTime = Date.now();
    
    console.log('============================================');
    console.log(`⚡ Total execution time: ${endTime - startTime}ms`);
    console.log(`📊 Final Results: ${results.passed} passed, ${results.failed} failed`);
    
    if (results.failed === 0) {
      console.log('🎉 All org brand detection tests passed! HubSpot CRM fix is working correctly.');
      Deno.exit(0);
    } else {
      console.log('💥 Some tests failed. Please review the output above.');
      Deno.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Test suite failed to run:', error.message);
    console.error(error.stack);
    Deno.exit(1);
  }
}

// Run the test suite
if (import.meta.main) {
  main();
}