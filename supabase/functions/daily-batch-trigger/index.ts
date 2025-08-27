import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CRON_SECRET = Deno.env.get('CRON_SECRET');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Verify cron secret for security
  const cronSecret = req.headers.get('x-cron-secret');
  
  if (!cronSecret || !CRON_SECRET || cronSecret !== CRON_SECRET) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized - Invalid cron secret' }), 
      { status: 401, headers: corsHeaders }
    );
  }

  // Check for duplicate runs using scheduler_state
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
  const runKey = `daily-batch-${today}`;

  try {
    // Get current scheduler state
    const { data: schedulerState, error: stateError } = await supabase
      .from('scheduler_state')
      .select('last_daily_run_key, last_daily_run_at')
      .eq('id', 'main')
      .single();

    if (stateError) {
      console.error('Failed to get scheduler state:', stateError);
      // Continue anyway - this is just duplicate prevention
    }

    // Check if already run today
    if (schedulerState?.last_daily_run_key === runKey) {
      console.log(`Daily batch already ran today (${today}), skipping`);
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Daily batch already completed today',
        lastRun: schedulerState.last_daily_run_at
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Update scheduler state to mark this run
    const { error: updateError } = await supabase
      .from('scheduler_state')
      .update({
        last_daily_run_key: runKey,
        last_daily_run_at: new Date().toISOString()
      })
      .eq('id', 'main');

    if (updateError) {
      console.error('Failed to update scheduler state:', updateError);
      // Continue anyway - this shouldn't block the batch
    }

  } catch (error) {
    console.error('Error checking scheduler state:', error);
    // Continue anyway - duplicate prevention failure shouldn't block batch
  }


  try {
    console.log('Starting daily batch trigger at 12AM EST...');

    // Get all organizations with active prompts
    const { data: orgs } = await supabase
      .from('organizations')
      .select(`
        id,
        name,
        prompts!inner(id)
      `)
      .eq('prompts.active', true);

    if (!orgs || orgs.length === 0) {
      console.log('No organizations with active prompts found');
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No organizations to process' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let totalBatchJobs = 0;
    let successfulJobs = 0;

    // Trigger batch processor for each org
    for (const org of orgs) {
      try {
        console.log(`Triggering batch processor for org ${org.id} (${org.name})`);
        
        const { data, error } = await supabase.functions.invoke('robust-batch-processor', {
          body: { orgId: org.id }
        });

        if (error) {
          console.error(`Failed to trigger batch for org ${org.id}:`, error);
        } else {
          console.log(`Successfully triggered batch for org ${org.id}`);
          successfulJobs++;
        }
        
        totalBatchJobs++;

        // Small delay to avoid overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (orgError) {
        console.error(`Error processing org ${org.id}:`, orgError);
        totalBatchJobs++;
      }
    }

    console.log(`Daily batch trigger completed. Processed ${totalBatchJobs} orgs, ${successfulJobs} successful`);

    return new Response(JSON.stringify({ 
      success: true, 
      totalOrgs: totalBatchJobs,
      successfulJobs,
      message: `Triggered batch processing for ${successfulJobs}/${totalBatchJobs} organizations`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Daily batch trigger error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});