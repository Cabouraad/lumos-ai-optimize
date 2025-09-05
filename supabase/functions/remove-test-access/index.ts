import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get auth header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response('Missing Authorization header', {
        status: 401,
        headers: corsHeaders
      })
    }

    // Verify user and get their data
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (authError || !user) {
      console.error('Auth error:', authError)
      return new Response('Unauthorized', {
        status: 401,
        headers: corsHeaders
      })
    }

    // Get user's role and org from database
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role, org_id')
      .eq('id', user.id)
      .single()

    if (userError || !userData) {
      console.error('User data error:', userError)
      return new Response('User not found', {
        status: 404,
        headers: corsHeaders
      })
    }

    // Check if user has admin/owner role
    if (userData.role !== 'owner' && userData.role !== 'admin') {
      console.log(`Access denied: user has role ${userData.role}, requires owner or admin`)
      return new Response(JSON.stringify({
        error: 'Access denied: Admin/Owner role required',
        code: 'INSUFFICIENT_ROLE'
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Check if user has bypass metadata
    const { data: subscriber, error: subscriberError } = await supabase
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

    console.log(`Test access removed for user ${user.id} by ${userData.role}`)

    return new Response(JSON.stringify({
      success: true,
      message: 'Test access removed successfully',
      removed_at: new Date().toISOString()
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
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