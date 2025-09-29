

const ORIGIN = Deno.env.get("APP_ORIGIN") ?? "https://llumos.app";

const corsHeaders = {
  'Access-Control-Allow-Origin': ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    console.log('Triggering competitor sync...');

    // Call the sync-competitor-detection function
    const syncUrl = `${supabaseUrl}/functions/v1/sync-competitor-detection`;
    
    const response = await fetch(syncUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ trigger: 'automated' })
    });

    const result = await response.json();

    console.log('Sync trigger result:', result);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Competitor sync triggered successfully',
        syncResult: result,
        timestamp: new Date().toISOString()
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error: unknown) {
    console.error('Error triggering competitor sync:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: 'Failed to trigger competitor sync',
        message: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});