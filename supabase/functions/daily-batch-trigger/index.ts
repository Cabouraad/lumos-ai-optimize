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

  // Verify cron secret for security
  const cronSecret = req.headers.get('x-cron-secret');
  
  if (!cronSecret || !CRON_SECRET || cronSecret !== CRON_SECRET) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }), 
      { status: 401, headers: corsHeaders }
    );
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const supabase = createClient(supabaseUrl, supabaseKey);

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