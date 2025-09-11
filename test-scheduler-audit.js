#!/usr/bin/env node

// Comprehensive scheduler audit and setup script
const https = require('https');

const SUPABASE_URL = "https://cgocsffxqyhojtyzniyz.supabase.co";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnb2NzZmZ4cXlob2p0eXpuaXl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwNDI1MDksImV4cCI6MjA3MDYxODUwOX0.Rn2lVaTcuu0TEn7S20a_56mkEBkG3_a7CT16CpEfirk";

async function makeRequest(path, data = {}, headers = {}) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(data);
    
    const options = {
      hostname: 'cgocsffxqyhojtyzniyz.supabase.co',
      port: 443,
      path: `/functions/v1/${path}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ANON_KEY}`,
        'Content-Length': Buffer.byteLength(postData),
        ...headers
      }
    };

    const req = https.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseData);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: responseData });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

async function auditScheduler() {
  console.log('🔍 SCHEDULER AUDIT - Ensuring Tonight\'s Batch Run Success');
  console.log('='.repeat(60));
  
  try {
    // Step 1: Check cron manager health
    console.log('\n📊 Step 1: Checking cron manager health...');
    const healthResult = await makeRequest('cron-manager', { action: 'health' });
    console.log(`Status: ${healthResult.status}`);
    console.log('Health Response:', JSON.stringify(healthResult.data, null, 2));
    
    // Step 2: Check current cron job status
    console.log('\n📋 Step 2: Checking current cron jobs...');
    const statusResult = await makeRequest('cron-manager', { action: 'status' });
    console.log(`Status: ${statusResult.status}`);
    console.log('Jobs Status:', JSON.stringify(statusResult.data, null, 2));
    
    // Step 3: Setup/ensure cron jobs are installed
    console.log('\n⚙️ Step 3: Setting up cron jobs...');
    const setupResult = await makeRequest('cron-manager', { action: 'setup' });
    console.log(`Status: ${setupResult.status}`);
    console.log('Setup Response:', JSON.stringify(setupResult.data, null, 2));
    
    // Step 4: Test manual daily run
    console.log('\n🧪 Step 4: Testing manual daily run...');
    const manualResult = await makeRequest('manual-daily-run', { 
      force: true,
      test_mode: true 
    }, {
      'x-admin-key': 'admin-key-placeholder'
    });
    console.log(`Status: ${manualResult.status}`);
    console.log('Manual Run Response:', JSON.stringify(manualResult.data, null, 2));
    
    // Step 5: Verify organizations with active prompts
    console.log('\n🏢 Step 5: Checking organizations...');
    console.log('This would require a database query - check Supabase dashboard');
    
    // Summary
    console.log('\n✅ AUDIT COMPLETE');
    console.log('-'.repeat(40));
    console.log('Next steps:');
    console.log('1. Monitor logs at 3:00 AM ET tonight');
    console.log('2. Check batch_jobs table for new entries');
    console.log('3. Verify scheduler_runs table for completion status');
    console.log('\nKey times (Eastern Time):');
    console.log('- 3:00 AM: daily-batch-trigger starts');
    console.log('- 3:05 AM: robust-batch-processor runs');
    console.log('- 3:30 AM: batch-reconciler cleanup');
    console.log('- 4:00 AM: scheduler-postcheck validation');
    
  } catch (error) {
    console.error('❌ Audit failed:', error.message);
  }
}

auditScheduler();