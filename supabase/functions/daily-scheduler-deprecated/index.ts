// ⚠️ DEPRECATED: This function has been replaced by daily-batch-trigger
// 
// This function is maintained for backward compatibility but should not be used.
// All daily scheduling functionality has been moved to daily-batch-trigger
// which provides better timezone handling and duplicate prevention.
//
// Migration completed: 2025-08-29
// TODO: Remove this function after confirming no external dependencies



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

  console.log('⚠️ DEPRECATED: daily-scheduler called - redirecting to daily-batch-trigger');

  return new Response(
    JSON.stringify({ 
      deprecated: true,
      message: 'This function has been deprecated. Use daily-batch-trigger instead.',
      redirectTo: 'daily-batch-trigger',
      deprecatedSince: '2025-08-29'
    }),
    { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 410 // Gone
    }
  );
});