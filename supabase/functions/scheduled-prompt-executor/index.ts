import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';
import { getStrictCorsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  const requestOrigin = req.headers.get('Origin');
  const corsHeaders = getStrictCorsHeaders(requestOrigin);
  
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const runId = crypto.randomUUID();
  const currentTime = new Date();
  
  console.log('🔄 Scheduled prompt executor started', { runId, currentTime: currentTime.toISOString() });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Verify cron secret
    const cronSecret = req.headers.get('x-cron-secret');
    
    if (!cronSecret) {
      console.error('❌ Missing cron secret');
      return new Response(
        JSON.stringify({ error: 'Missing cron secret' }),
        { status: 401, headers: corsHeaders }
      );
    }

    // Verify secret against database
    const { data: secretData, error: secretError } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'cron_secret')
      .single();

    if (secretError || !secretData?.value || secretData.value !== cronSecret) {
      console.error('❌ Invalid cron secret');
      return new Response(
        JSON.stringify({ error: 'Invalid cron secret' }),
        { status: 401, headers: corsHeaders }
      );
    }

    // Log execution start
    const { error: logError } = await supabase
      .from('scheduler_runs')
      .insert({
        id: runId,
        run_key: currentTime.toISOString().split('T')[0], // Use date as key
        function_name: 'scheduled-prompt-executor',
        started_at: currentTime.toISOString(),
        status: 'running'
      });

    if (logError) {
      console.warn('⚠️ Failed to log scheduler run start:', logError);
    }

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
      await supabase.from('scheduler_runs').update({
        status: 'failed',
        error_message: `Failed to fetch organizations: ${orgsError.message}`,
        completed_at: new Date().toISOString()
      }).eq('id', runId);
      
      return new Response(
        JSON.stringify({ error: 'Failed to fetch organizations' }),
        { status: 500, headers: corsHeaders }
      );
    }

    if (!orgs || orgs.length === 0) {
      console.log('No organizations with active prompts found');
      
      await supabase.from('scheduler_runs').update({
        status: 'completed',
        result: { 
          message: 'No organizations to process',
          totalOrgs: 0,
          successfulJobs: 0,
          timestamp: currentTime.toISOString()
        },
        completed_at: new Date().toISOString()
      }).eq('id', runId);
      
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No organizations to process',
        totalOrgs: 0,
        timestamp: currentTime.toISOString()
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`📊 Found ${orgs.length} organizations with active prompts`);

    let successfulJobs = 0;
    const orgResults: any[] = [];

    // Process each organization using robust-batch-processor
    for (const org of orgs) {
      try {
        console.log(`🏢 Processing org: ${org.name} (${org.id})`);
        
        const { data, error } = await supabase.functions.invoke('robust-batch-processor', {
          body: { 
            action: 'create',
            orgId: org.id, 
            source: 'scheduled-prompt-executor',
            replace: false, // Don't replace existing jobs
            correlationId: runId
          },
          headers: { 'x-cron-secret': cronSecret }
        });

        if (error) {
          console.error(`❌ Failed to trigger batch for org ${org.name}:`, error);
          orgResults.push({
            orgId: org.id,
            orgName: org.name,
            success: false,
            error: error.message
          });
        } else {
          console.log(`✅ Batch triggered for org ${org.name}, action: ${data?.action}`);
          orgResults.push({
            orgId: org.id,
            orgName: org.name,
            success: true,
            action: data?.action,
            batchJobId: data?.batchJobId
          });
          successfulJobs++;
        }

        // Small delay to avoid overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (orgError: unknown) {
        console.error(`❌ Error processing org ${org.name}:`, orgError);
        orgResults.push({
          orgId: org.id,
          orgName: org.name,
          success: false,
          error: orgError instanceof Error ? orgError.message : String(orgError)
        });
      }
    }

    const isSuccess = successfulJobs > 0;
    const result = {
      success: isSuccess,
      message: isSuccess 
        ? `Successfully triggered batch processing for ${successfulJobs}/${orgs.length} organizations` 
        : 'No organizations could be processed',
      totalOrgs: orgs.length,
      successfulJobs,
      failedJobs: orgs.length - successfulJobs,
      orgResults,
      timestamp: currentTime.toISOString(),
      coverage: {
        percent: orgs.length > 0 ? Math.round((successfulJobs / orgs.length) * 100) : 100,
        successful: successfulJobs,
        total: orgs.length
      }
    };

    console.log(`🎉 Scheduled execution completed:`, result);

    // Log completion
    await supabase.from('scheduler_runs').update({
      status: isSuccess ? 'completed' : 'failed',
      result: result,
      completed_at: new Date().toISOString()
    }).eq('id', runId);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    console.error('❌ Scheduled prompt executor error:', error);
    
    // Log the failure
    await supabase.from('scheduler_runs').update({
      status: 'failed',
      error_message: error.message || 'Unknown error',
      result: {
        success: false,
        error: error.message || 'Unknown error',
        timestamp: currentTime.toISOString()
      },
      completed_at: new Date().toISOString()
    }).eq('id', runId);
    
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message || 'Unknown error',
      timestamp: currentTime.toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});