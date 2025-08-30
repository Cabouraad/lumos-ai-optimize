#!/usr/bin/env node

// Final scheduler test with proper authentication
const https = require('https');

const SUPABASE_URL = "https://cgocsffxqyhojtyzniyz.supabase.co";
const CRON_SECRET = "a978931713ce1c30123378480cbf38a3fc3ea7b9d299c6c848c463c3ca6e983";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnb2NzZmZ4cXlob2p0eXpuaXl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwNDI1MDksImV4cCI6MjA3MDYxODUwOX0.Rn2lVaTcuu0TEn7S20a_56mkEBkG3_a7CT16CpEfirk";

async function makeRequest(path, data = {}) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(data);
    
    const options = {
      hostname: 'cgocsffxqyhojtyzniyz.supabase.co',
      port: 443,
      path: `/functions/v1/${path}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-manual-call': 'true',
        'x-cron-secret': CRON_SECRET,
        'Authorization': `Bearer ${ANON_KEY}`,
        'Content-Length': Buffer.byteLength(postData)
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

async function testScheduler() {
  console.log('🚀 Testing Fixed Scheduler System');
  console.log('=====================================');
  
  try {
    // Step 1: Test daily batch trigger
    console.log('\n📡 Step 1: Testing daily-batch-trigger...');
    const triggerResult = await makeRequest('daily-batch-trigger', {
      force: true,
      manual_test: true,
      timestamp: new Date().toISOString()
    });
    
    console.log(`Status: ${triggerResult.status}`);
    console.log('Response:', JSON.stringify(triggerResult.data, null, 2));
    
    if (triggerResult.status === 200) {
      console.log('✅ Daily batch trigger successful');
      
      // Wait for processing
      console.log('\n⏳ Waiting 15 seconds for batch processing...');
      await new Promise(resolve => setTimeout(resolve, 15000));
      
      // Step 2: Test batch reconciler
      console.log('\n🔧 Step 2: Testing batch-reconciler...');
      const reconcilerResult = await makeRequest('batch-reconciler', {
        manual_test: true,
        timestamp: new Date().toISOString()
      });
      
      console.log(`Status: ${reconcilerResult.status}`);
      console.log('Response:', JSON.stringify(reconcilerResult.data, null, 2));
      
      if (reconcilerResult.status === 200) {
        console.log('✅ Batch reconciler successful');
        
        // Step 3: Test idempotency (without force flag)
        console.log('\n🔄 Step 3: Testing idempotency (should skip)...');
        const idempotencyResult = await makeRequest('daily-batch-trigger', {
          manual_test: true,
          timestamp: new Date().toISOString()
          // No force flag this time
        });
        
        console.log(`Status: ${idempotencyResult.status}`);
        console.log('Response:', JSON.stringify(idempotencyResult.data, null, 2));
        
        if (idempotencyResult.data && idempotencyResult.data.message && 
            idempotencyResult.data.message.includes('already completed')) {
          console.log('✅ Idempotency working correctly');
        } else {
          console.log('⚠️ Idempotency may not be working as expected');
        }
      }
    } else {
      console.log('❌ Daily batch trigger failed');
    }
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
  
  console.log('\n📊 Test Complete - Check Supabase logs and database for detailed results');
  console.log('Monitor: scheduler_runs, batch_jobs, batch_tasks tables');
}

testScheduler();