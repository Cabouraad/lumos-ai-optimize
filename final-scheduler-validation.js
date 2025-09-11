#!/usr/bin/env node

// Final validation script to ensure tonight's batch run will succeed
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

async function validateSystem() {
  console.log('🚀 FINAL SCHEDULER VALIDATION');
  console.log('Ensuring tonight\'s 3:00 AM ET batch run will succeed');
  console.log('='.repeat(55));
  
  let allGood = true;
  
  try {
    // 1. Check cron manager status
    console.log('\n📊 1. Checking cron job status...');
    const statusResult = await makeRequest('cron-manager', { action: 'status' });
    if (statusResult.status === 200) {
      console.log('✅ Cron manager accessible');
      const jobs = statusResult.data.jobs || [];
      console.log(`   Active jobs: ${jobs.length}`);
      jobs.forEach(job => {
        console.log(`   - ${job.jobname}: ${job.active ? 'ACTIVE' : 'INACTIVE'} (${job.schedule})`);
      });
    } else {
      console.log('❌ Cron manager issue');
      allGood = false;
    }
    
    // 2. Health check
    console.log('\n🏥 2. Running health check...');
    const healthResult = await makeRequest('cron-manager', { action: 'health' });
    if (healthResult.status === 200 && healthResult.data.healthy) {
      console.log('✅ System health: GOOD');
      console.log(`   Extensions: pg_cron=${healthResult.data.extensions?.pg_cron}, pg_net=${healthResult.data.extensions?.pg_net}`);
      console.log(`   Cron secret: ${healthResult.data.cron_secret_exists ? 'EXISTS' : 'MISSING'}`);
    } else {
      console.log('❌ Health check failed');
      allGood = false;
    }
    
    // 3. Test manual run to validate end-to-end functionality
    console.log('\n🧪 3. Testing end-to-end functionality...');
    const testResult = await makeRequest('daily-batch-trigger', { 
      force: true,
      manual_test: true 
    }, {
      'x-manual-call': 'true'
    });
    
    if (testResult.status === 200) {
      console.log('✅ Manual trigger test: SUCCESS');
      console.log(`   Organizations processed: ${testResult.data.organizations_processed || 0}`);
      console.log(`   Jobs created: ${testResult.data.jobs_created || 0}`);
    } else {
      console.log('❌ Manual trigger test failed');
      console.log(`   Status: ${testResult.status}`);
      console.log(`   Response: ${JSON.stringify(testResult.data)}`);
      allGood = false;
    }
    
    // 4. Validate batch processor
    console.log('\n⚙️ 4. Testing batch processor...');
    const batchResult = await makeRequest('robust-batch-processor', {
      test_mode: true,
      org_id: '4d1d9ebb-d13e-4094-99c8-e74fe8526239' // HubSpot org
    }, {
      'x-manual-call': 'true'
    });
    
    if (batchResult.status === 200 || batchResult.status === 429) {
      console.log('✅ Batch processor: ACCESSIBLE');
    } else {
      console.log('❌ Batch processor issue');
      allGood = false;
    }
    
    // 5. Summary and prediction
    console.log('\n📋 VALIDATION SUMMARY');
    console.log('-'.repeat(30));
    
    if (allGood) {
      console.log('✅ SYSTEM READY FOR TONIGHT\'S RUN');
      console.log('\nExpected timeline (Eastern Time):');
      console.log('🕒 03:00 AM - daily-batch-trigger activates');
      console.log('🔄 03:01 AM - 3 organizations queued');
      console.log('⚡ 03:02 AM - robust-batch-processor starts');
      console.log('📊 03:05 AM - ~99 tasks (33 prompts × 3 providers)');
      console.log('✅ 03:15 AM - Expected completion');
      console.log('🧹 03:30 AM - batch-reconciler cleanup');
      console.log('📝 04:00 AM - scheduler-postcheck validation');
      
      console.log('\n📈 Expected results:');
      console.log('- 3 batch_jobs created (one per org)');
      console.log('- ~99 batch_tasks processed');
      console.log('- ~300 prompt_provider_responses inserted');
      console.log('- All jobs marked "completed"');
      
    } else {
      console.log('❌ ISSUES DETECTED - FIX BEFORE TONIGHT');
    }
    
    console.log('\n🔍 MONITORING INSTRUCTIONS:');
    console.log('1. Check Supabase Edge Function logs at 3:00 AM ET');
    console.log('2. Query: SELECT * FROM batch_jobs WHERE created_at >= CURRENT_DATE');
    console.log('3. Query: SELECT * FROM scheduler_runs WHERE started_at >= CURRENT_DATE');
    console.log('4. Watch for completion by 3:20 AM ET');
    
  } catch (error) {
    console.error('❌ Validation failed:', error.message);
    allGood = false;
  }
  
  process.exit(allGood ? 0 : 1);
}

validateSystem();