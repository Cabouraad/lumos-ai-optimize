// Simple Node.js test script to manually trigger the functions
const https = require('https');

const SUPABASE_URL = 'cgocsffxqyhojtyzniyz.supabase.co';
const CRON_SECRET = 'a978931713ce1c30123378480cbf38a3fc3ea7b9d299c6c848c463c3ca6e983';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnb2NzZmZ4cXlob2p0eXpuaXl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwNDI1MDksImV4cCI6MjA3MDYxODUwOX0.Rn2lVaTcuu0TEn7S20a_56mkEBkG3_a7CT16CpEfirk';

function makeRequest(path, body) {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify(body);
        
        const options = {
            hostname: SUPABASE_URL,
            port: 443,
            path: path,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData),
                'x-manual-call': 'true',
                'x-cron-secret': CRON_SECRET,
                'Authorization': `Bearer ${ANON_KEY}`
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                console.log(`Status: ${res.statusCode}`);
                console.log('Response:', data);
                resolve({ status: res.statusCode, data: data });
            });
        });

        req.on('error', (e) => {
            console.error('Request error:', e);
            reject(e);
        });

        req.write(postData);
        req.end();
    });
}

async function test() {
    console.log('🚀 Testing daily batch trigger...');
    
    try {
        const result = await makeRequest('/functions/v1/daily-batch-trigger', {
            manualTest: true,
            timestamp: new Date().toISOString()
        });
        
        console.log('✅ Daily batch result:', result);
        
        // Wait 5 seconds then test reconciler
        console.log('⏳ Waiting 5 seconds...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        console.log('🔧 Testing batch reconciler...');
        const reconcilerResult = await makeRequest('/functions/v1/batch-reconciler', {
            manualTest: true,
            timestamp: new Date().toISOString()
        });
        
        console.log('✅ Reconciler result:', reconcilerResult);
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

test();