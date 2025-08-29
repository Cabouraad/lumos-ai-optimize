#!/usr/bin/env -S deno run --allow-all

/**
 * Test Runner for Competitor Detection
 * 
 * Usage: deno run --allow-all test-competitor-detection.ts
 */

import { runCompetitorDetectionTests } from './supabase/functions/_shared/tests/competitor-detection.test.ts';

async function main() {
  try {
    console.log('🚀 Starting Competitor Detection Test Suite...');
    console.log('=====================================');
    
    const startTime = Date.now();
    const results = await runCompetitorDetectionTests();
    const endTime = Date.now();
    
    console.log('=====================================');
    console.log(`⚡ Total execution time: ${endTime - startTime}ms`);
    console.log(`📊 Final Results: ${results.passed} passed, ${results.failed} failed`);
    
    if (results.failed === 0) {
      console.log('🎉 All tests passed! Competitor detection is working correctly.');
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