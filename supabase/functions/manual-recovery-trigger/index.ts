import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('🚀 Starting manual recovery for missed daily batch processing...');

    // Get all organizations that need processing
    const { data: orgs, error: orgsError } = await supabase
      .from('organizations')
      .select('id, name')
      .order('name');

    if (orgsError) {
      throw new Error(`Failed to fetch organizations: ${orgsError.message}`);
    }

    console.log(`📋 Found ${orgs.length} organizations to process`);

    // Trigger daily batch for each organization
    const results = [];
    for (const org of orgs) {
      console.log(`🔄 Processing organization: ${org.name} (${org.id})`);
      
      try {
        const { data: batchResult, error: batchError } = await supabase.functions.invoke('robust-batch-processor', {
          body: {
            orgId: org.id,
            correlationId: `manual-recovery-${Date.now()}`,
            force: true,
            manual_recovery: true,
            recovery_date: new Date().toISOString().split('T')[0]
          }
        });

        if (batchError) {
          console.error(`❌ Failed to process ${org.name}:`, batchError);
          results.push({
            org_id: org.id,
            org_name: org.name,
            success: false,
            error: batchError.message
          });
        } else {
          console.log(`✅ Successfully triggered batch for ${org.name}:`, batchResult);
          results.push({
            org_id: org.id,
            org_name: org.name,
            success: true,
            batch_result: batchResult
          });
        }
      } catch (error: unknown) {
        console.error(`💥 Exception processing ${org.name}:`, error);
        results.push({
          org_id: org.id,
          org_name: org.name,
          success: false,
          error: error instanceof Error ? error.message : String(error)
        });
      }

      // Small delay between org processing to avoid overloading
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    const successCount = results.filter((r: any) => r.success).length;
    const failureCount = results.filter((r: any) => !r.success).length;

    console.log(`🎉 Manual recovery completed: ${successCount} successful, ${failureCount} failed`);

    return new Response(JSON.stringify({
      success: true,
      total_organizations: orgs.length,
      successful_triggers: successCount,
      failed_triggers: failureCount,
      recovery_timestamp: new Date().toISOString(),
      results: results,
      message: `Manual recovery completed for ${orgs.length} organizations`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: unknown) {
    console.error('💥 Manual recovery failed:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      recovery_timestamp: new Date().toISOString(),
      message: 'Manual recovery failed'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});