import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { todayKeyNY, isPastThreeAMNY } from "../_shared/time.ts";

// Import the runPrompt function from client library (need to adapt for server-side)
import { normalize, isOrgBrand } from "../../../lib/brand/match.ts";
import { computeScore } from "../../../lib/scoring/visibility.ts";
import { extractBrands as extractBrandsOpenAI } from "../../../lib/providers/openai.ts";
import { extractBrands as extractBrandsPerplexity } from "../../../lib/providers/perplexity.ts";
import { getQuotasForTier } from "../../../lib/tiers/quotas.ts";
import { extractArtifacts, createBrandGazetteer } from "../../../lib/visibility/extractArtifacts.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Run all active prompts for all organizations
async function runAllPrompts(supabase: any, openaiKey: string, perplexityKey: string) {
  console.log('Starting automated daily prompt scanning...');
  
  // Get all organizations with active prompts
  const { data: organizations, error: orgError } = await supabase
    .from('organizations')
    .select(`
      id,
      name,
      plan_tier,
      prompts!inner(
        id,
        text,
        active
      )
    `)
    .eq('prompts.active', true)
    .order('name');

  if (orgError) {
    console.error('Error fetching organizations:', orgError);
    return { success: false, error: orgError.message, totalRuns: 0 };
  }

  if (!organizations || organizations.length === 0) {
    console.log('No organizations with active prompts found');
    return { success: true, totalRuns: 0 };
  }

  let totalRuns = 0;
  const results = [];

  for (const org of organizations) {
    try {
      console.log(`Processing organization: ${org.name} (${org.prompts.length} active prompts)`);
      
      for (const prompt of org.prompts) {
        try {
          const result = await runPromptServerSide(prompt.id, org.id, supabase, openaiKey, perplexityKey, org.plan_tier);
          totalRuns += result.runsCreated;
          console.log(`Prompt "${prompt.text.slice(0, 50)}..." - Created ${result.runsCreated} runs`);
        } catch (promptError) {
          console.error(`Error running prompt ${prompt.id}:`, promptError);
        }
      }
      
      results.push({ org: org.name, promptCount: org.prompts.length });
    } catch (orgError) {
      console.error(`Error processing organization ${org.id}:`, orgError);
    }
  }

  console.log(`Daily scan completed: ${totalRuns} total runs across ${organizations.length} organizations`);
  return { success: true, totalRuns, organizations: results };
}

// Server-side version of runPrompt function
async function runPromptServerSide(promptId: string, orgId: string, supabase: any, openaiKey: string, perplexityKey: string, planTier: string) {
  // Load prompt and org data
  const { data: prompt } = await supabase
    .from('prompts')
    .select('text')
    .eq('id', promptId)
    .single();

  if (!prompt) {
    return { success: false, error: 'Prompt not found', runsCreated: 0 };
  }

  // Get enabled providers
  const { data: providers } = await supabase
    .from('llm_providers')
    .select('*')
    .eq('enabled', true)
    .order('name');

  if (!providers || providers.length === 0) {
    return { success: false, error: 'No enabled providers', runsCreated: 0 };
  }

  // Get org brand catalog
  const { data: brandCatalog } = await supabase
    .from('brand_catalog')
    .select('name, variants_json')
    .eq('org_id', orgId);

  if (!brandCatalog) {
    return { success: false, error: 'Could not load brand catalog', runsCreated: 0 };
  }

  const quotas = getQuotasForTier(planTier);
  let runsCreated = 0;

  // Create brand gazetteer and user brand norms for artifact extraction
  const brandGazetteer = createBrandGazetteer(brandCatalog);
  const userBrandNorms = brandCatalog.map(brand => normalize(brand.name));

  // Check today's runs to respect quotas
  const today = new Date().toISOString().split('T')[0];
  const { data: todayRuns } = await supabase
    .from('prompt_runs')
    .select('id')
    .gte('run_at', `${today}T00:00:00Z`)
    .lt('run_at', `${today}T23:59:59Z`)
    .in('prompt_id', [promptId]);

  if (todayRuns && todayRuns.length >= quotas.promptsPerDay) {
    return { success: false, error: 'Daily quota exceeded', runsCreated: 0 };
  }

  // Process each provider
  for (const provider of providers.slice(0, quotas.providersPerPrompt)) {
    try {
      // Check caching rule: if last 3 runs had same brand set, skip
      const { data: recentRuns } = await supabase
        .from('prompt_runs')
        .select(`
          id,
          visibility_results (brands_json)
        `)
        .eq('prompt_id', promptId)
        .eq('provider_id', provider.id)
        .eq('status', 'success')
        .order('run_at', { ascending: false })
        .limit(3);

      if (recentRuns && recentRuns.length === 3) {
        const brandSets = recentRuns.map(run => 
          JSON.stringify((run.visibility_results as any)[0]?.brands_json || [])
        ).sort();
        
        if (brandSets[0] === brandSets[1] && brandSets[1] === brandSets[2]) {
          // Use cached result
          const lastResult = recentRuns[0].visibility_results as any;
          if (lastResult && lastResult[0]) {
            const { data: cachedRun } = await supabase
              .from('prompt_runs')
              .insert({
                prompt_id: promptId,
                provider_id: provider.id,
                status: 'success',
                token_in: 0,
                token_out: 0,
                cost_est: 0,
                citations: [],
                brands: [],
                competitors: []
              })
              .select()
              .single();

            if (cachedRun) {
              await supabase
                .from('visibility_results')
                .insert({
                  prompt_run_id: cachedRun.id,
                  org_brand_present: lastResult[0].org_brand_present,
                  org_brand_prominence: lastResult[0].org_brand_prominence,
                  brands_json: lastResult[0].brands_json,
                  competitors_count: lastResult[0].competitors_count,
                  raw_evidence: 'Cached result',
                  score: lastResult[0].score
                });
              runsCreated++;
            }
            continue;
          }
        }
      }

      // Extract brands from provider
      let extraction;
      if (provider.name === 'openai' && openaiKey) {
        extraction = await extractBrandsOpenAI(prompt.text, openaiKey);
      } else if (provider.name === 'perplexity' && perplexityKey) {
        extraction = await extractBrandsPerplexity(prompt.text, perplexityKey);
      } else {
        continue; // Skip if no API key
      }

      // Extract structured artifacts from the full response
      const artifacts = extractArtifacts(extraction.responseText, userBrandNorms, brandGazetteer);

      // Normalize and analyze brands
      const normalizedBrands = extraction.brands.map(normalize);
      const orgBrands = normalizedBrands.filter(brand => 
        isOrgBrand(brand, brandCatalog)
      );
      
      const orgPresent = orgBrands.length > 0;
      const orgBrandIdx = orgPresent ? normalizedBrands.findIndex(brand => 
        isOrgBrand(brand, brandCatalog)
      ) : null;
      
      const competitorsCount = normalizedBrands.length - orgBrands.length;
      const score = computeScore(orgPresent, orgBrandIdx, competitorsCount);

      // Insert prompt_runs with structured artifacts
      const { data: newRun } = await supabase
        .from('prompt_runs')
        .insert({
          prompt_id: promptId,
          provider_id: provider.id,
          status: 'success',
          token_in: extraction.tokenIn,
          token_out: extraction.tokenOut,
          cost_est: 0,
          citations: artifacts.citations,
          brands: artifacts.brands,
          competitors: artifacts.competitors
        })
        .select()
        .single();

      if (newRun) {
        // Insert visibility_results
        await supabase
          .from('visibility_results')
          .insert({
            prompt_run_id: newRun.id,
            org_brand_present: orgPresent,
            org_brand_prominence: orgBrandIdx ?? 0,
            brands_json: extraction.brands,
            competitors_count: competitorsCount,
            raw_evidence: JSON.stringify({ 
              normalized: normalizedBrands, 
              orgMatches: orgBrands,
              fullResponse: extraction.responseText,
              artifacts: artifacts 
            }),
            score: score,
            raw_ai_response: extraction.responseText
          });
        
        runsCreated++;
      }

    } catch (providerError) {
      console.error(`Provider ${provider.name} error:`, providerError);
      
      // Log failed run
      await supabase
        .from('prompt_runs')
        .insert({
          prompt_id: promptId,
          provider_id: provider.id,
          status: 'error',
          token_in: 0,
          token_out: 0,
          cost_est: 0,
          citations: [],
          brands: [],
          competitors: []
        });
    }
  }

  return { success: true, runsCreated };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Authenticate with CRON_SECRET
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${Deno.env.get("CRON_SECRET")}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openaiKey = Deno.env.get('OPENAI_API_KEY')!;
    const perplexityKey = Deno.env.get('PERPLEXITY_API_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Daily scan function triggered');

    // Idempotency gate: only after 3:00 AM ET
    if (!isPastThreeAMNY()) {
      console.log('Outside time window - before 3:00 AM ET');
      return new Response(
        JSON.stringify({ status: "outside-window" }),
        { 
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200
        }
      );
    }

    // Read current state
    const key = todayKeyNY();
    console.log(`Checking for today's key: ${key}`);
    
    const { data: state } = await supabase
      .from("scheduler_state")
      .select("*")
      .eq("id", "global")
      .single();

    if (state && state.last_daily_run_key === key) {
      console.log(`Already ran today: ${key}`);
      return new Response(
        JSON.stringify({ status: "already-ran", key }),
        { 
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200
        }
      );
    }

    // Lightweight mutex: only one runner flips the key
    const { data: before } = await supabase
      .from("scheduler_state")
      .select("last_daily_run_key")
      .eq("id", "global")
      .single();

    if (before && before.last_daily_run_key === key) {
      console.log('Another instance already claimed the run');
      return new Response(
        JSON.stringify({ status: "locked" }),
        { 
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200
        }
      );
    }

    // Claim the run
    console.log('Claiming daily run...');
    const { error: upErr } = await supabase
      .from("scheduler_state")
      .update({ 
        last_daily_run_key: key, 
        last_daily_run_at: new Date().toISOString() 
      })
      .eq("id", "global");

    if (upErr) {
      console.error('Failed to claim mutex:', upErr);
      return new Response(
        JSON.stringify({ status: "mutex-failed", error: upErr.message }),
        { 
          status: 409, 
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    console.log('Running automated daily prompt scanning...');
    
    // Run all active prompts for all organizations
    const result = await runAllPrompts(supabase, openaiKey, perplexityKey);

    console.log('Daily scan result:', result);

    return new Response(
      JSON.stringify({ 
        status: "ok", 
        key,
        result
      }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200
      }
    );

  } catch (e) {
    console.error('Daily scan function error:', e);
    return new Response(
      JSON.stringify({ 
        status: "error", 
        message: String(e) 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});