// Manual test script for daily batch trigger
const SUPABASE_URL = 'https://cgocsffxqyhojtyzniyz.supabase.co';
const CRON_SECRET = 'a978931713ce1c30123378480cbf38a3fc3ea7b9d299c6c848c463c3ca6e983';

async function testDailyBatchTrigger() {
    console.log('🚀 Starting manual daily batch trigger test...');
    
    try {
        // Step 1: Trigger daily batch with manual override
        console.log('📡 Calling daily-batch-trigger with manual override...');
        const response = await fetch(`${SUPABASE_URL}/functions/v1/daily-batch-trigger`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-manual-call': 'true',
                'x-cron-secret': CRON_SECRET,
                'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnb2NzZmZ4cXlob2p0eXpuaXl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwNDI1MDksImV4cCI6MjA3MDYxODUwOX0.Rn2lVaTcuu0TEn7S20a_56mkEBkG3_a7CT16CpEfirk'
            },
            body: JSON.stringify({ 
                manualTest: true,
                timestamp: new Date().toISOString()
            })
        });
        
        const responseText = await response.text();
        console.log(`✅ Response Status: ${response.status}`);
        console.log(`📄 Response Body:`, responseText);
        
        if (response.status === 200) {
            console.log('🎉 Daily batch trigger successful! Now monitoring results...');
            return JSON.parse(responseText);
        } else {
            console.error('❌ Daily batch trigger failed');
            return null;
        }
        
    } catch (error) {
        console.error('🔥 Error during test:', error);
        return null;
    }
}

async function testBatchReconciler() {
    console.log('🔧 Starting batch reconciler test...');
    
    try {
        const response = await fetch(`${SUPABASE_URL}/functions/v1/batch-reconciler`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-manual-call': 'true',
                'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnb2NzZmZ4cXlob2p0eXpuaXl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwNDI1MDksImV4cCI6MjA3MDYxODUwOX0.Rn2lVaTcuu0TEn7S20a_56mkEBkG3_a7CT16CpEfirk'
            },
            body: JSON.stringify({
                manualTest: true,
                timestamp: new Date().toISOString()
            })
        });
        
        const responseText = await response.text();
        console.log(`✅ Reconciler Response Status: ${response.status}`);
        console.log(`📄 Reconciler Response Body:`, responseText);
        
        return response.status === 200 ? JSON.parse(responseText) : null;
        
    } catch (error) {
        console.error('🔥 Reconciler Error:', error);
        return null;
    }
}

// Run the test
testDailyBatchTrigger();