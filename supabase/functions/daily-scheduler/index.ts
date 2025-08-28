import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0'

const CRON_SECRET = Deno.env.get('CRON_SECRET');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SchedulerState {
  id: string;
  last_daily_run_key: string | null;
  last_daily_run_at: string | null;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Verify cron secret for security (CRITICAL FIX)
  const cronSecret = req.headers.get('x-cron-secret');
  
  if (!CRON_SECRET || !cronSecret || cronSecret !== CRON_SECRET) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized: Invalid or missing cron secret' }), 
      { status: 401, headers: corsHeaders }
    );
  }

  try {
    // Initialize Supabase client with service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get current date and time in America/New_York timezone with proper formatting
    const now = new Date();
    const nyFormatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    
    const nyParts = nyFormatter.formatToParts(now);
    const nyMonth = nyParts.find(part => part.type === 'month')?.value;
    const nyDay = nyParts.find(part => part.type === 'day')?.value;
    const nyYear = nyParts.find(part => part.type === 'year')?.value;
    const nyHour = parseInt(nyParts.find(part => part.type === 'hour')?.value || '0');
    const nyMinute = parseInt(nyParts.find(part => part.type === 'minute')?.value || '0');
    
    const todayKey = `${nyYear}-${nyMonth}-${nyDay}`;
    const nyTimeStr = `${nyYear}-${nyMonth}-${nyDay} ${nyHour}:${nyMinute.toString().padStart(2, '0')} ET`;
    
    console.log(`Daily scheduler triggered at ${nyTimeStr} for date ${todayKey}`);
    
    // Verify we're in the midnight window (00:00-00:30 ET) for safety
    if (nyHour === 0 && nyMinute <= 30) {
      console.log(`✅ Running in midnight window: ${nyHour}:${nyMinute.toString().padStart(2, '0')} ET`);
    } else {
      console.log(`⚠️ Running outside midnight window: ${nyHour}:${nyMinute.toString().padStart(2, '0')} ET - This may be a manual trigger or retry`);
    }

    // Use the safer RPC function to check/mark daily run
    const { data: runCheck, error: runCheckError } = await supabase
      .rpc('try_mark_daily_run', { p_today_key: todayKey });

    if (runCheckError) {
      console.error('Error checking/updating scheduler state:', runCheckError);
      throw runCheckError;
    }

    console.log('Daily run check result:', runCheck);

    // If we didn't update (already ran today), skip
    if (!runCheck.updated) {
      console.log(`Daily run already completed for ${todayKey} at ${runCheck.previous_key}`);
      return new Response(
        JSON.stringify({ 
          message: 'Daily run already completed',
          date: todayKey,
          previous_run: runCheck.previous_key,
          skipped: true,
          ny_time: nyTimeStr
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );
    }

    console.log('Starting daily prompt runs for', todayKey);

    // Get all organizations
    const { data: organizations, error: orgError } = await supabase
      .from('organizations')
      .select('id, name');

    if (orgError) {
      console.error('Error fetching organizations:', orgError);
      throw orgError;
    }

    console.log(`Found ${organizations?.length || 0} organizations to process`);

    let totalRuns = 0;
    let successfulRuns = 0;

    // Process each organization
    for (const org of organizations || []) {
      try {
        console.log(`Processing organization: ${org.name} (${org.id})`);

        // Get active prompts for this organization
        const { data: prompts, error: promptsError } = await supabase
          .from('prompts')
          .select('id, text, org_id')
          .eq('org_id', org.id)
          .eq('active', true);

        if (promptsError) {
          console.error(`Error fetching prompts for org ${org.id}:`, promptsError);
          continue;
        }

        console.log(`Found ${prompts?.length || 0} active prompts for ${org.name}`);

        // Get enabled providers
        const { data: providers, error: providersError } = await supabase
          .from('llm_providers')
          .select('id, name')
          .eq('enabled', true);

        if (providersError) {
          console.error('Error fetching providers:', providersError);
          continue;
        }

        // Run each prompt once (it will internally handle all providers)
        for (const prompt of prompts || []) {
          try {
            totalRuns++;

            // Call the existing run-prompt-now function for each prompt
            const { data: runResult, error: runError } = await supabase.functions.invoke('run-prompt-now', {
              body: {
                promptId: prompt.id
              }
            });

            if (runError) {
              console.error(`Failed to run prompt ${prompt.id}:`, runError);
            } else {
              successfulRuns++;
              console.log(`Successfully ran prompt "${prompt.text}"`);
            }

            // Small delay to prevent overwhelming the providers
            await new Promise(resolve => setTimeout(resolve, 2000));

          } catch (error) {
            console.error(`Error running prompt ${prompt.id}:`, error);
          }
        }

      } catch (error) {
        console.error(`Error processing organization ${org.id}:`, error);
      }
    }

    const result = {
      message: 'Daily run completed',
      date: todayKey,
      totalRuns,
      successfulRuns,
      organizations: organizations?.length || 0,
      timestamp: new Date().toISOString()
    };

    console.log('Daily scheduler completed:', result);

    return new Response(
      JSON.stringify(result),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Daily scheduler error:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Daily scheduler failed',
        message: error.message,
        timestamp: new Date().toISOString()
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});