#!/usr/bin/env node

/**
 * Comprehensive test script for the robust batch processor
 * Tests the processor in isolation to verify it works correctly
 */

import https from 'https';

const SUPABASE_URL = "https://cgocsffxqyhojtyzniyz.supabase.co";
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

async function testBatchProcessor() {
  console.log('🧪 Testing Robust Batch Processor');
  console.log('=====================================');
  
  const testOrgId = "4d1d9ebb-d13e-4094-99c8-e74fe8526239"; // Use existing org from logs
  
  const testCases = [
    {
      name: 'Missing orgId',
      input: {},
      expectedSuccess: false,
      expectedError: 'orgId is required'
    },
    {
      name: 'Empty providers array',
      input: { orgId: testOrgId, providers: [] },
      expectedSuccess: false,
      expectedError: 'No enabled providers have API keys'
    },
    {
      name: 'Invalid JSON',
      input: '{ invalid json }',
      expectedSuccess: false,
      expectedError: 'Invalid JSON'
    },
    {
      name: 'Valid request with org auto-fetch',
      input: { orgId: testOrgId, replace: true },
      expectedSuccess: true
    },
    {
      name: 'Resume non-existent job',
      input: { 
        orgId: testOrgId, 
        resumeJobId: '00000000-0000-0000-0000-000000000000',
        action: 'resume'
      },
      expectedSuccess: false
    }
  ];
  
  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    console.log(`\n📋 Test ${i + 1}: ${testCase.name}`);
    
    try {
      let requestData;
      if (typeof testCase.input === 'string') {
        // Test invalid JSON by sending raw string
        const postData = testCase.input;
        const options = {
          hostname: 'cgocsffxqyhojtyzniyz.supabase.co',
          port: 443,
          path: '/functions/v1/robust-batch-processor',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${ANON_KEY}`,
            'Content-Length': Buffer.byteLength(postData)
          }
        };
        
        const response = await new Promise((resolve, reject) => {
          const req = https.request(options, (res) => {
            let responseData = '';
            res.on('data', (chunk) => { responseData += chunk; });
            res.on('end', () => {
              try {
                const parsed = JSON.parse(responseData);
                resolve({ status: res.statusCode, data: parsed });
              } catch (e) {
                resolve({ status: res.statusCode, data: responseData });
              }
            });
          });
          req.on('error', reject);
          req.write(postData);
          req.end();
        });
        
        requestData = response;
      } else {
        requestData = await makeRequest('robust-batch-processor', testCase.input);
      }
      
      console.log(`   Status: ${requestData.status}`);
      console.log(`   Response:`, JSON.stringify(requestData.data, null, 2));
      
      // Validate expectations
      const isSuccess = requestData.data?.success === true;
      const hasExpectedError = testCase.expectedError && 
        requestData.data?.error?.includes(testCase.expectedError);
      
      if (testCase.expectedSuccess) {
        if (isSuccess) {
          console.log(`   ✅ PASS: Successfully processed as expected`);
        } else {
          console.log(`   ❌ FAIL: Expected success but got error: ${requestData.data?.error}`);
        }
      } else {
        if (!isSuccess && (hasExpectedError || !testCase.expectedError)) {
          console.log(`   ✅ PASS: Correctly failed with expected error`);
        } else if (isSuccess) {
          console.log(`   ❌ FAIL: Expected failure but got success`);
        } else {
          console.log(`   ⚠️  PARTIAL: Failed but with unexpected error: ${requestData.data?.error}`);
        }
      }
      
      // Wait between tests
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.log(`   💥 ERROR: ${error.message}`);
    }
  }
  
  console.log('\n📊 Batch Processor Test Complete');
  console.log('Check Supabase edge function logs for detailed execution logs');
}

testBatchProcessor().catch(console.error);