import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { createHash } from "https://deno.land/std@0.177.0/crypto/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EnqueueRequest {
  scope: 'org' | 'prompt';
  promptIds?: string[];
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from auth header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authorization required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get user's org_id
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('org_id')
      .eq('id', user.id)
      .single();

    if (userError || !userData?.org_id) {
      return new Response(JSON.stringify({ error: 'User organization not found' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const orgId = userData.org_id;

    // Parse request body
    const body: EnqueueRequest = await req.json();
    const { scope, promptIds } = body;

    if (!scope || !['org', 'prompt'].includes(scope)) {
      return new Response(JSON.stringify({ error: 'Invalid scope' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (scope === 'prompt' && (!promptIds || promptIds.length === 0)) {
      return new Response(JSON.stringify({ error: 'promptIds required for prompt scope' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Generate input hash for deduplication
    const week = new Date().toISOString().substring(0, 10); // YYYY-MM-DD format
    const modelVersion = 'v1';
    const sortedPromptIds = promptIds ? [...promptIds].sort() : [];
    const hashInput = `${orgId}-${scope}-${sortedPromptIds.join(',')}-${week}-${modelVersion}`;
    const inputHash = createHash('sha256').update(hashInput).digest('hex');

    console.log('[enqueue-optimizations] Generated hash:', inputHash, 'for input:', hashInput);

    // Check for existing recent job with same hash (last 24h)
    const { data: existingJob, error: checkError } = await supabase
      .from('optimization_jobs')
      .select('id, status, created_at')
      .eq('org_id', orgId)
      .eq('input_hash', inputHash)
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (checkError) {
      console.error('[enqueue-optimizations] Error checking existing job:', checkError);
      return new Response(JSON.stringify({ error: 'Database error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // If recent job exists and is done, return it (idempotent)
    if (existingJob && existingJob.status === 'done') {
      console.log('[enqueue-optimizations] Returning existing completed job:', existingJob.id);
      return new Response(JSON.stringify({ 
        jobId: existingJob.id, 
        status: 'done', 
        message: 'Using existing results from last 24h' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // If job is running, return it
    if (existingJob && (existingJob.status === 'queued' || existingJob.status === 'running')) {
      console.log('[enqueue-optimizations] Returning existing running job:', existingJob.id);
      return new Response(JSON.stringify({ 
        jobId: existingJob.id, 
        status: existingJob.status,
        message: 'Job already in progress' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create new job
    const { data: newJob, error: insertError } = await supabase
      .from('optimization_jobs')
      .insert({
        org_id: orgId,
        requested_by: user.id,
        scope,
        prompt_ids: promptIds || null,
        target_week: week,
        input_hash: inputHash,
        model_version: modelVersion,
        status: 'queued'
      })
      .select()
      .single();

    if (insertError) {
      console.error('[enqueue-optimizations] Error creating job:', insertError);
      return new Response(JSON.stringify({ error: 'Failed to create job' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[enqueue-optimizations] Created new job:', newJob.id);

    return new Response(JSON.stringify({ 
      jobId: newJob.id, 
      status: 'queued',
      message: 'Optimization job queued successfully' 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('[enqueue-optimizations] Unexpected error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});