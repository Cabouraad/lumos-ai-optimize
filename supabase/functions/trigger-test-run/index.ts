import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('🚀 Triggering test run of all prompts...');

    // Call the run-all-prompts function with HubSpot org ID
    const { data, error } = await supabase.functions.invoke('run-all-prompts', {
      body: {
        manualRun: true,
        organizationId: '4d1d9ebb-d13e-4094-99c8-e74fe8526239'
      }
    });

    if (error) {
      console.error('❌ Test run failed:', error);
      return new Response(JSON.stringify({ 
        success: false, 
        error: error.message,
        details: error 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('✅ Test run completed:', data);
    
    // Wait a moment then check results
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check how many responses were created
    const { data: responseCheck } = await supabase
      .from('prompt_provider_responses')
      .select('id, provider, status, created_at')
      .eq('org_id', '4d1d9ebb-d13e-4094-99c8-e74fe8526239')
      .order('created_at', { ascending: false })
      .limit(10);

    return new Response(JSON.stringify({
      success: true,
      runResult: data,
      newResponses: responseCheck?.length || 0,
      recentResponses: responseCheck || [],
      message: `Test run completed. Check the dashboard for updated prompt cards!`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('💥 Test trigger error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});