import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";
import { createHash } from "https://deno.land/std@0.168.0/crypto/mod.ts";

const ORIGIN = Deno.env.get("APP_ORIGIN") || "*";

function cors() {
  return {
    "access-control-allow-origin": ORIGIN,
    "access-control-allow-headers": "authorization, content-type, x-client-info, apikey",
    "access-control-allow-methods": "POST, OPTIONS",
  };
}

function ok(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...cors() },
  });
}

interface EnqueueRequest {
  scope: 'org' | 'prompt';
  promptIds?: string[];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors() });
  }

  try {
    const auth = req.headers.get("authorization") || "";
    if (!auth.startsWith("Bearer ")) {
      return ok({ code: "unauthorized", detail: "Missing Bearer token." }, 200);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Service client for system writes (bypasses RLS)
    const svc = createClient(supabaseUrl, supabaseServiceKey);
    
    // User-bound client for reads
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { authorization: auth } }
    });

    const token = auth.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return ok({ code: "unauthorized", detail: "Invalid token" }, 200);
    }

    const { data: userData, error: userError } = await svc
      .from('users')
      .select('org_id')
      .eq('id', user.id)
      .single();

    if (userError || !userData?.org_id) {
      return ok({ code: "forbidden", detail: "User organization not found" }, 200);
    }

    const orgId = userData.org_id;

    const body: EnqueueRequest = await req.json().catch(() => ({}));
    const { scope, promptIds } = body;

    if (!scope || !['org', 'prompt'].includes(scope)) {
      return ok({ code: "invalid_input", detail: "Invalid scope" }, 200);
    }

    if (scope === 'prompt' && (!promptIds || promptIds.length === 0)) {
      return ok({ code: "invalid_input", detail: "promptIds required for prompt scope" }, 200);
    }

    // Generate input hash for deduplication
    const week = new Date().toISOString().substring(0, 10); // YYYY-MM-DD format
    const modelVersion = 'v1';
    const sortedPromptIds = promptIds ? [...promptIds].sort() : [];
    const hashInput = `${orgId}-${scope}-${sortedPromptIds.join(',')}-${week}-${modelVersion}`;
    const inputHash = createHash('sha256').update(hashInput).digest('hex');

    console.log('[enqueue-optimizations] Generated hash:', inputHash, 'for input:', hashInput);

    const { data: existingJob, error: checkError } = await svc
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
      return ok({ code: "db_error", detail: "Database error checking jobs" }, 200);
    }

    if (existingJob && existingJob.status === 'done') {
      console.log('[enqueue-optimizations] Returning existing completed job:', existingJob.id);
      return ok({ 
        code: "queued",
        jobId: existingJob.id, 
        status: 'done', 
        message: 'Using existing results from last 24h' 
      }, 200);
    }

    if (existingJob && (existingJob.status === 'queued' || existingJob.status === 'running')) {
      console.log('[enqueue-optimizations] Returning existing running job:', existingJob.id);
      return ok({ 
        code: "queued",
        jobId: existingJob.id, 
        status: existingJob.status,
        message: 'Job already in progress' 
      }, 200);
    }

    const { data: newJob, error: insertError } = await svc
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
      return ok({ code: "db_error", detail: "Failed to create job" }, 200);
    }

    console.log('[enqueue-optimizations] Created new job:', newJob.id);

    return ok({ 
      code: "queued",
      jobId: newJob.id, 
      status: 'queued',
      message: 'Optimization job queued successfully' 
    }, 200);

  } catch (error: unknown) {
    console.error('[enqueue-optimizations] Unexpected error:', error);
    return ok({ code: "crash", detail: String(error) }, 200);
  }
});