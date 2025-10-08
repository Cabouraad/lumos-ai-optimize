import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';
import { requireRole } from '../_shared/auth-v2.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize authenticated Supabase client
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response('Missing Authorization header', {
        status: 401,
        headers: corsHeaders
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: { headers: { Authorization: authHeader } }
      }
    );

    // Verify user has required role (owner or admin) and get org
    const { org_id: userOrgId } = await requireRole(supabase, ['owner', 'admin']);

    // Get user ID for subscriber lookup
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response('Unauthorized', {
        status: 401,
        headers: corsHeaders
      });
    }

    // Create service role client for database operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Check if user has bypass metadata
    const { data: subscriber, error: subscriberError } = await supabaseAdmin
      .from('subscribers')
      .select('metadata, subscription_tier')
      .eq('user_id', user.id)
      .single()

    if (subscriberError) {
      console.error('Subscriber lookup error:', subscriberError)
      return new Response(JSON.stringify({
        error: 'Subscriber not found',
        code: 'NOT_FOUND'
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Check if bypass is active
    if (subscriber.metadata?.source !== 'bypass') {
      return new Response(JSON.stringify({
        error: 'No test access found to remove',
        code: 'NO_BYPASS_ACTIVE'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Remove the bypass by clearing subscription data
    const { error: updateError } = await supabase
      .from('subscribers')
      .update({
        subscription_tier: 'free',
        subscribed: false,
        payment_collected: false,
        trial_expires_at: null,
        subscription_end: null,
        metadata: {
          ...subscriber.metadata,
          source: null,
          removed_at: new Date().toISOString(),
          removed_by: user.id
        }
      })
      .eq('user_id', user.id)

    if (updateError) {
      console.error('Update error:', updateError)
      return new Response(JSON.stringify({
        error: 'Failed to remove test access',
        code: 'UPDATE_FAILED'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log(`Test access removed for user ${user.id}`)

    return new Response(JSON.stringify({
      success: true,
      message: 'Test access removed successfully',
      removed_at: new Date().toISOString()
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: unknown) {
    console.error('Remove test access error:', error)
    return new Response(JSON.stringify({
      error: 'Internal server error',
      message: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})