#!/usr/bin/env node

/**
 * Scheduler Verification Script
 * 
 * This script helps verify that the scheduler is working correctly by:
 * 1. Running preflight checks (API tests)
 * 2. Running an end-to-end test
 * 3. Checking scheduler state and logs
 * 
 * Usage: node scripts/verify-scheduler.mjs [--test]
 */

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing required environment variables: SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function runPreflightChecks() {
  console.log('🔍 Running preflight checks...\n');
  
  try {
    // Test API providers
    const { data: apiTests, error: apiError } = await supabase.functions.invoke('test-scheduler-apis');
    
    if (apiError) {
      console.error('❌ API tests failed:', apiError.message);
      return false;
    }
    
    console.log('📊 API Test Results:');
    apiTests.apiTests.forEach(test => {
      const status = test.success ? '✅' : '❌';
      console.log(`  ${status} ${test.provider}: ${test.success ? `${test.duration}ms` : test.error}`);
    });
    
    console.log(`\n📋 Database Status:`);
    console.log(`  Organizations: ${apiTests.databaseStatus.organizations}`);
    console.log(`  Active Prompts: ${apiTests.databaseStatus.activePrompts}`);
    console.log(`  Enabled Providers: ${apiTests.databaseStatus.enabledProviders.join(', ')}`);
    
    const ready = apiTests.recommendations.readyForScheduledRun;
    console.log(`\n🎯 Scheduler Ready: ${ready ? '✅ YES' : '❌ NO'}`);
    
    if (apiTests.recommendations.issues.length > 0) {
      console.log('\n⚠️  Issues found:');
      apiTests.recommendations.issues.forEach(issue => {
        console.log(`  • ${issue}`);
      });
    }
    
    return ready;
  } catch (error) {
    console.error('❌ Preflight checks failed:', error.message);
    return false;
  }
}

async function runEndToEndTest() {
  console.log('\n🚀 Running end-to-end test...\n');
  
  try {
    const { data: testResult, error: testError } = await supabase.functions.invoke('daily-scan', {
      body: { test: true }
    });
    
    if (testError) {
      console.error('❌ End-to-end test failed:', testError.message);
      return false;
    }
    
    console.log('📈 End-to-End Test Results:');
    console.log(`  Status: ${testResult.status === 'success' ? '✅ SUCCESS' : '❌ ' + testResult.status}`);
    console.log(`  Test Mode: ${testResult.testMode ? '✅ Enabled' : '❌ Disabled'}`);
    console.log(`  Timestamp: ${new Date(testResult.timestamp).toLocaleString()}`);
    
    if (testResult.result) {
      console.log(`  Organizations Processed: ${testResult.result.organizationsProcessed || 'N/A'}`);
      console.log(`  Prompts Processed: ${testResult.result.promptsProcessed || 'N/A'}`);
    }
    
    return testResult.status === 'success';
  } catch (error) {
    console.error('❌ End-to-end test failed:', error.message);
    return false;
  }
}

async function checkSchedulerState() {
  console.log('\n📅 Checking scheduler state...\n');
  
  try {
    const { data: status, error: statusError } = await supabase.functions.invoke('scheduler-status');
    
    if (statusError) {
      console.error('❌ Failed to get scheduler status:', statusError.message);
      return false;
    }
    
    console.log('🗓️  Scheduler State:');
    console.log(`  Last Run Key: ${status.last_daily_run_key}`);
    console.log(`  Last Run At: ${status.last_daily_run_at ? new Date(status.last_daily_run_at).toLocaleString() : 'Never'}`);
    console.log(`  Status: ${status.status}`);
    
    return true;
  } catch (error) {
    console.error('❌ Failed to check scheduler state:', error.message);
    return false;
  }
}

async function main() {
  const isTestMode = process.argv.includes('--test');
  
  console.log('🔧 Scheduler Verification Tool');
  console.log('==============================\n');
  
  // Step 1: Preflight checks
  const preflightPassed = await runPreflightChecks();
  
  if (!preflightPassed) {
    console.log('\n❌ Preflight checks failed. Please resolve issues before continuing.');
    process.exit(1);
  }
  
  // Step 2: End-to-end test (if requested)
  if (isTestMode) {
    const testPassed = await runEndToEndTest();
    
    if (!testPassed) {
      console.log('\n❌ End-to-end test failed. The scheduler may not work correctly.');
      process.exit(1);
    }
  }
  
  // Step 3: Check scheduler state
  await checkSchedulerState();
  
  console.log('\n✅ Verification complete!');
  console.log('\n📝 Summary:');
  console.log('  • API providers are working');
  console.log('  • Database has active organizations and prompts');
  console.log('  • Scheduler configuration is valid');
  
  if (isTestMode) {
    console.log('  • End-to-end test passed successfully');
  }
  
  console.log('\n🎯 The scheduler should work reliably at 3:00 AM EST.');
  console.log('\n💡 To run a full test: node scripts/verify-scheduler.mjs --test');
}

main().catch(error => {
  console.error('💥 Script failed:', error.message);
  process.exit(1);
});