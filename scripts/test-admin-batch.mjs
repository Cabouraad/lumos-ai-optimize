#!/usr/bin/env node

/**
 * Test script for admin batch trigger
 * Usage: node scripts/test-admin-batch.mjs [options]
 * Options:
 *   --preflight    Run preflight checks only
 *   --replace      Replace existing jobs
 *   --help         Show help
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://cgocsffxqyhojtyzniyz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnb2NzZmZ4cXlob2p0eXpuaXl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwNDI1MDksImV4cCI6MjA3MDYxODUwOX0.Rn2lVaTcuu0TEn7S20a_56mkEBkG3_a7CT16CpEfirk';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  preflight: args.includes('--preflight'),
  replace: args.includes('--replace'),
  help: args.includes('--help')
};

if (options.help) {
  console.log(`
Admin Batch Trigger Test Script

Usage: node scripts/test-admin-batch.mjs [options]

Options:
  --preflight    Run preflight checks only (don't start actual batches)
  --replace      Replace existing batch jobs
  --help         Show this help message

Examples:
  node scripts/test-admin-batch.mjs --preflight
  node scripts/test-admin-batch.mjs --replace
  node scripts/test-admin-batch.mjs --preflight --replace
`);
  process.exit(0);
}

async function testAdminBatchTrigger() {
  console.log('🔧 Testing Admin Batch Trigger');
  console.log('Options:', options);
  
  try {
    // You'll need to set your admin JWT token here
    const adminToken = process.env.ADMIN_JWT_TOKEN;
    if (!adminToken) {
      console.error('❌ Please set ADMIN_JWT_TOKEN environment variable');
      console.log('  1. Login to your app');
      console.log('  2. Open browser dev tools > Application > Local Storage');
      console.log('  3. Copy the sb-cgocsffxqyhojtyzniyz-auth-token value');
      console.log('  4. Extract the access_token from the JSON');
      console.log('  5. Run: ADMIN_JWT_TOKEN="your_token_here" node scripts/test-admin-batch.mjs');
      process.exit(1);
    }

    console.log('🚀 Calling admin-batch-trigger...');
    
    const requestBody = {};
    if (options.preflight) requestBody.preflight = true;
    if (options.replace) requestBody.replace = true;

    const { data, error } = await supabase.functions.invoke('admin-batch-trigger', {
      body: requestBody,
      headers: {
        Authorization: `Bearer ${adminToken}`
      }
    });

    if (error) {
      console.error('❌ Error:', error);
      return;
    }

    console.log('✅ Success!');
    console.log('\n📊 Summary:');
    console.log(`  Run ID: ${data.runId}`);
    console.log(`  Total Organizations: ${data.summary.totalOrgs}`);
    console.log(`  Processed: ${data.summary.processedOrgs}`);
    console.log(`  Successful Jobs: ${data.summary.successfulJobs}`);
    console.log(`  Skipped: ${data.summary.skippedOrgs}`);
    console.log(`  Total Prompts: ${data.summary.totalPrompts}`);
    console.log(`  Expected Tasks: ${data.summary.totalExpectedTasks}`);
    console.log(`  Providers Available: ${data.summary.providersUsed.join(', ')}`);

    console.log('\n📋 Organization Results:');
    data.results.forEach((result, index) => {
      const status = result.success ? '✅' : '❌';
      const action = result.action || 'unknown';
      const prompts = result.promptCount || 0;
      const tasks = result.expectedTasks || 0;
      const providers = (result.availableProviders || []).length;
      
      console.log(`  ${index + 1}. ${status} ${result.orgName} (${action})`);
      console.log(`     Prompts: ${prompts}, Expected Tasks: ${tasks}, Providers: ${providers}`);
      
      if (result.skipReason) {
        console.log(`     Skip Reason: ${result.skipReason}`);
      }
      
      if (result.batchJobId) {
        console.log(`     Batch Job ID: ${result.batchJobId}`);
      }
      
      if (result.error) {
        console.log(`     Error: ${result.error}`);
      }
    });

    console.log(`\n🎉 Test completed at ${new Date().toISOString()}`);

  } catch (error) {
    console.error('💥 Test failed:', error.message);
    process.exit(1);
  }
}

testAdminBatchTrigger();