import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-key',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const adminKey = req.headers.get('x-admin-key');
    
    if (!adminKey) {
      return new Response(JSON.stringify({ 
        error: 'Missing admin key - this endpoint requires admin access' 
      }), {
        status: 401,
        headers: corsHeaders
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify admin key
    const { data: adminKeyData } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'admin_key')
      .single();

    if (!adminKeyData?.value || adminKeyData.value !== adminKey) {
      return new Response(JSON.stringify({ error: 'Invalid admin key' }), {
        status: 403,
        headers: corsHeaders
      });
    }

    const runId = crypto.randomUUID();
    console.log('🚀 Manual daily run started by admin', { runId });

    // Get cron secret for internal function calls
    const { data: cronSecretData } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'cron_secret')
      .single();

    if (!cronSecretData?.value) {
      throw new Error('Cron secret not found in database');
    }

    const cronSecret = cronSecretData.value;

    // Step 1: Trigger daily batch with force flag
    console.log('Step 1: Triggering daily batch trigger with force flag...');
    
    const dailyBatchResponse = await supabase.functions.invoke('daily-batch-trigger', {
      body: { 
        force: true,
        source: 'manual-daily-run',
        runId
      },
      headers: {
        'x-cron-secret': cronSecret
      }
    });

    if (dailyBatchResponse.error) {
      throw new Error(`Daily batch trigger failed: ${dailyBatchResponse.error.message}`);
    }

    console.log('✅ Daily batch trigger completed:', dailyBatchResponse.data);

    // Step 2: Wait a moment and run reconciler to clean up any issues
    console.log('Step 2: Running batch reconciler to ensure job completion...');
    
    await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds

    const reconcilerResponse = await supabase.functions.invoke('batch-reconciler', {
      body: { 
        source: 'manual-daily-run',
        runId
      },
      headers: {
        'x-cron-secret': cronSecret
      }
    });

    if (reconcilerResponse.error) {
      console.warn('⚠️ Reconciler failed:', reconcilerResponse.error);
    } else {
      console.log('✅ Reconciler completed:', reconcilerResponse.data);
    }

    // Step 3: Run postcheck to verify coverage
    console.log('Step 3: Running postcheck to verify coverage...');
    
    const postcheckResponse = await supabase.functions.invoke('scheduler-postcheck', {
      body: { 
        source: 'manual-daily-run',
        runId
      },
      headers: {
        'x-cron-secret': cronSecret
      }
    });

    if (postcheckResponse.error) {
      console.warn('⚠️ Postcheck failed:', postcheckResponse.error);
    } else {
      console.log('✅ Postcheck completed:', postcheckResponse.data);
    }

    const result = {
      success: true,
      runId,
      message: 'Manual daily run completed successfully',
      timestamp: new Date().toISOString(),
      steps: {
        dailyBatch: {
          success: !dailyBatchResponse.error,
          data: dailyBatchResponse.data,
          error: dailyBatchResponse.error?.message
        },
        reconciler: {
          success: !reconcilerResponse.error,
          data: reconcilerResponse.data,
          error: reconcilerResponse.error?.message
        },
        postcheck: {
          success: !postcheckResponse.error,
          data: postcheckResponse.data,
          error: postcheckResponse.error?.message
        }
      }
    };

    console.log('🎯 Manual daily run completed:', result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    console.error('💥 Manual daily run error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});