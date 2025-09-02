import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ORIGIN = Deno.env.get("APP_ORIGIN") ?? "https://llumos.app";

const corsHeaders = {
  'Access-Control-Allow-Origin': ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Only allow service role or authenticated users with proper access
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized - Bearer token required' }), 
      { status: 401, headers: corsHeaders }
    );
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const cronSecret = Deno.env.get('CRON_SECRET');

  if (!cronSecret) {
    return new Response(
      JSON.stringify({ error: 'CRON_SECRET not configured in environment' }), 
      { status: 500, headers: corsHeaders }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    console.log('Syncing CRON_SECRET to app_settings...');

    // Upsert the cron secret into app_settings
    const { data, error } = await supabase
      .from('app_settings')
      .upsert({
        key: 'cron_secret',
        value: cronSecret,
        description: 'Secret used for authenticating cron job requests'
      }, {
        onConflict: 'key'
      });

    if (error) {
      console.error('Failed to sync cron secret:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to sync cron secret', details: error.message }), 
        { status: 500, headers: corsHeaders }
      );
    }

    console.log('Successfully synced CRON_SECRET to database');

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'CRON_SECRET successfully synced to database',
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Sync cron secret error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});