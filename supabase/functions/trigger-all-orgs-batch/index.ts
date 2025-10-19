import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get JWT from request
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Verify user is authenticated
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const runId = crypto.randomUUID();
    console.log(`🚀 Batch trigger for all orgs initiated by user ${user.email}`, { runId });

    const { replace = true } = await req.json().catch(() => ({ replace: true }));

    // Get all organizations with active prompts
    const { data: orgs, error: orgsError } = await supabase
      .from('organizations')
      .select(`
        id,
        name,
        prompts!inner(id)
      `)
      .eq('prompts.active', true);

    if (orgsError) {
      console.error('❌ Failed to fetch organizations:', orgsError);
      throw new Error(`Failed to fetch organizations: ${orgsError.message}`);
    }

    if (!orgs || orgs.length === 0) {
      console.log('No organizations with active prompts found');
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No organizations with active prompts to process',
        totalOrgs: 0,
        triggeredJobs: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`📊 Found ${orgs.length} organizations with active prompts`);

    const orgResults: any[] = [];
    let successCount = 0;
    let failureCount = 0;

    // Process each organization by triggering robust-batch-processor
    for (const org of orgs) {
      try {
        console.log(`🏢 Triggering batch for org: ${org.name} (${org.id})`);
        
        const { data, error } = await supabase.functions.invoke('robust-batch-processor', {
          body: { 
            orgId: org.id, 
            replace,
            source: 'trigger-all-orgs-batch',
            correlationId: runId
          }
        });

        if (error) {
          console.error(`❌ Failed to trigger batch for org ${org.name}:`, error);
          failureCount++;
          orgResults.push({
            orgId: org.id,
            orgName: org.name,
            success: false,
            error: error.message
          });
        } else {
          console.log(`✅ Batch triggered for org ${org.name}, jobId: ${data?.jobId}`);
          successCount++;
          orgResults.push({
            orgId: org.id,
            orgName: org.name,
            success: true,
            jobId: data?.jobId,
            action: data?.action
          });
        }

        // Small delay between organizations to prevent overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (err: any) {
        console.error(`❌ Error processing org ${org.name}:`, err);
        failureCount++;
        orgResults.push({
          orgId: org.id,
          orgName: org.name,
          success: false,
          error: err.message
        });
      }
    }

    const result = {
      success: true,
      runId,
      message: `Batch processing triggered for ${successCount} organizations`,
      totalOrgs: orgs.length,
      triggeredJobs: successCount,
      failedTriggers: failureCount,
      timestamp: new Date().toISOString(),
      results: orgResults
    };

    console.log('🎯 All orgs batch trigger completed:', result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('💥 Error in trigger-all-orgs-batch:', error);
    
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
