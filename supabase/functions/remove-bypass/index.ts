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
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Verify user and get their data
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (authError || !user) {
      console.error('Auth error:', authError)
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Parse request body to get target email (optional)
    let targetEmail: string | null = null
    if (req.method === 'POST') {
      try {
        const body = await req.json()
        targetEmail = body.email || null
      } catch {
        // Body parsing failed, use current user
      }
    }

    // Get caller's role and org from database
    const { data: callerData, error: callerError } = await supabase
      .from('users')
      .select('role, org_id, email')
      .eq('id', user.id)
      .single()

    if (callerError || !callerData) {
      console.error('Caller data error:', callerError)
      return new Response(JSON.stringify({ error: 'Caller not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Check if caller has admin/owner role
    if (callerData.role !== 'owner' && callerData.role !== 'admin') {
      console.log(`Access denied: caller has role ${callerData.role}, requires owner or admin`)
      return new Response(JSON.stringify({
        error: 'Access denied: Admin/Owner role required',
        code: 'INSUFFICIENT_ROLE'
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Determine target email: provided email or caller's email
    const emailToProcess = targetEmail || callerData.email

    console.log(`[REMOVE-BYPASS] Caller: ${callerData.email} (${callerData.role}), Target: ${emailToProcess}`)

    // Find the target subscriber
    const { data: targetSubscriber, error: subscriberError } = await supabase
      .from('subscribers')
      .select('user_id, email, metadata, subscription_tier')
      .eq('email', emailToProcess)
      .single()

    if (subscriberError) {
      console.error('Target subscriber lookup error:', subscriberError)
      return new Response(JSON.stringify({
        error: 'Target subscriber not found',
        code: 'NOT_FOUND',
        email: emailToProcess
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Check if bypass is active
    if (targetSubscriber.metadata?.source !== 'bypass') {
      return new Response(JSON.stringify({
        error: 'No active bypass found to remove',
        code: 'NO_BYPASS_ACTIVE',
        email: emailToProcess
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Update metadata to mark bypass as removed and set status to canceled
    const updatedMetadata = {
      ...targetSubscriber.metadata,
      source: 'removed',
      removed_at: new Date().toISOString(),
      removed_by: user.id,
      removed_by_email: callerData.email,
      original_source: 'bypass'
    }

    const { error: updateError } = await supabase
      .from('subscribers')
      .update({
        subscription_tier: 'free',
        subscribed: false,
        payment_collected: false,
        trial_expires_at: null,
        subscription_end: null,
        metadata: updatedMetadata
      })
      .eq('user_id', targetSubscriber.user_id)

    if (updateError) {
      console.error('Update error:', updateError)
      return new Response(JSON.stringify({
        error: 'Failed to remove bypass',
        code: 'UPDATE_FAILED'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log(`[REMOVE-BYPASS] Success: Bypass removed for ${emailToProcess} by ${callerData.email}`)

    return new Response(JSON.stringify({
      ok: true,
      email: emailToProcess,
      removed_by: callerData.email,
      removed_at: new Date().toISOString()
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: unknown) {
    console.error('Remove bypass error:', error)
    return new Response(JSON.stringify({
      error: 'Internal server error',
      message: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})