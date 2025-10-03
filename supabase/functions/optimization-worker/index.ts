// deno-lint-ignore-file no-explicit-any
/**
 * Optimization worker (CRON job)
 * Dequeues jobs and delegates to shared engine
 * Handles stuck job recovery and heartbeat updates
 */
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { runOptimizationEngine } from "../_shared/optimizations/engine.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET")!;

function j(s: any, code = 200) {
  return new Response(JSON.stringify(s), {
    status: code,
    headers: { 'content-type': 'application/json' }
  });
}

serve(async (req) => {
  console.log("[optimization-worker] Worker started");
  
  try {
    // Verify CRON authorization
    if (req.headers.get("authorization") !== `Bearer ${CRON_SECRET}`) {
      console.warn("[optimization-worker] Unauthorized request");
      return j({ error: "unauthorized" }, 401);
    }
    
    const service = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Reclaim stuck jobs (running but stale >10 minutes)
    const staleTimestamp = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data: stuckJobs } = await service
      .from("optimization_jobs")
      .select("id")
      .eq("status", "running")
      .lt("updated_at", staleTimestamp);
      
    if (stuckJobs && stuckJobs.length > 0) {
      console.log(`[optimization-worker] Reclaiming ${stuckJobs.length} stuck jobs`);
      await service
        .from("optimization_jobs")
        .update({ 
          status: "queued", 
          updated_at: new Date().toISOString() 
        })
        .eq("status", "running")
        .lt("updated_at", staleTimestamp);
    }

    // Fetch next queued job
    const { data: job } = await service
      .from("optimization_jobs")
      .select("id,org_id,requested_by,scope,prompt_ids,created_at")
      .eq("status", "queued")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
      
    if (!job) {
      console.log("[optimization-worker] No jobs in queue");
      return j({ ok: true, processed: 0 });
    }

    console.log(`[optimization-worker] Processing job ${job.id}`);

    // Mark job as running with heartbeat
    await service
      .from("optimization_jobs")
      .update({ 
        status: "running", 
        updated_at: new Date().toISOString() 
      })
      .eq("id", job.id);

    // Determine target prompts
    let promptIds: string[] = [];
    if (job.scope === "prompt" && Array.isArray(job.prompt_ids) && job.prompt_ids.length) {
      promptIds = job.prompt_ids;
      console.log(`[optimization-worker] Targeting ${promptIds.length} specific prompts`);
    } else {
      // Get low visibility prompts
      const { data: lows } = await service
        .from("prompt_visibility_14d")
        .select("prompt_id")
        .eq("org_id", job.org_id)
        .lt("presence_rate", 50)
        .order("presence_rate", { ascending: true })
        .limit(10);
      promptIds = (lows ?? []).map((r: any) => r.prompt_id);
      console.log(`[optimization-worker] Found ${promptIds.length} low visibility prompts`);
    }

    if (promptIds.length === 0) {
      console.log("[optimization-worker] No prompts to process, marking job as done");
      await service
        .from("optimization_jobs")
        .update({ 
          status: "done", 
          updated_at: new Date().toISOString() 
        })
        .eq("id", job.id);
      return j({ ok: true, jobId: job.id, inserted: 0, results: [] });
    }

    // Get org details
    const { data: org } = await service
      .from("organizations")
      .select("id,name")
      .eq("id", job.org_id)
      .single();

    // Run optimization engine
    const jwt = ""; // Worker uses service role; engine still requires param
    const results = await runOptimizationEngine({
      jwt,
      orgId: job.org_id,
      promptIds,
      brand: org?.name || "Your Brand",
      mode: "queue"
    });

    const inserted = results.reduce((a, b) => a + b.inserted, 0);
    console.log(`[optimization-worker] Job ${job.id} complete: ${inserted} insertions`);

    // Mark job as done
    await service
      .from("optimization_jobs")
      .update({ 
        status: "done", 
        updated_at: new Date().toISOString() 
      })
      .eq("id", job.id);

    return j({ ok: true, jobId: job.id, inserted, results });
  } catch (e) {
    console.error("[optimization-worker] Error:", e);
    return j({ error: "crash", detail: String(e) }, 500);
  }
});