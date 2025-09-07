import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[WEEKLY-REPORT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    logStep('Weekly report generation started');

    // Check for CRON secret - only allow automated generation
    const cronSecret = Deno.env.get('CRON_SECRET');
    const cronHeaderSecret = req.headers.get('x-cron-secret');
    
    if (!cronSecret || cronHeaderSecret !== cronSecret) {
      logStep('Unauthorized request - CRON secret required');
      return new Response(JSON.stringify({
        success: false,
        error: 'Unauthorized. Reports are generated automatically.'
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // This function is only used by the scheduler - no need for week calculation or org lookup
    logStep('CRON-only function called');
    
    return new Response(JSON.stringify({
      success: true,
      message: 'Weekly reports are generated automatically by the scheduler.'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    logStep('Error generating report', { error: error.message });
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
