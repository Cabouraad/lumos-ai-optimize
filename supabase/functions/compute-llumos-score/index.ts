import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

interface RequestBody {
  scope?: 'org' | 'prompt';
  promptId?: string;
  brandId?: string;
  force?: boolean;
  orgId?: string; // Only for cron jobs with x-cron-secret
}

// Helper to get cached score
async function getCachedScore(
  serviceClient: ReturnType<typeof createClient>,
  orgId: string,
  scope: string,
  promptId: string | null,
  maxAgeMs: number = 60 * 60 * 1000 // 1 hour default
) {
  const cacheExpiryTime = new Date(Date.now() - maxAgeMs);
  
  let cacheQuery = serviceClient
    .from('llumos_scores')
    .select('*')
    .eq('org_id', orgId)
    .eq('scope', scope)
    .gte('updated_at', cacheExpiryTime.toISOString())
    .order('updated_at', { ascending: false })
    .limit(1);
  
  if (scope === 'prompt' && promptId) {
    cacheQuery = cacheQuery.eq('prompt_id', promptId);
  } else if (scope === 'org') {
    cacheQuery = cacheQuery.is('prompt_id', null);
  }
  
  const { data: existingScore } = await cacheQuery.maybeSingle();
  return existingScore;
}

// Helper to compute score with timeout
async function computeScoreWithTimeout(
  serviceClient: ReturnType<typeof createClient>,
  orgId: string,
  promptId: string | null,
  brandId: string | null,
  timeoutMs: number = 25000 // 25 second timeout (edge functions have 30s limit)
) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const { data: result, error: rpcError } = await serviceClient.rpc(
      'compute_llumos_score',
      {
        p_org_id: orgId,
        p_prompt_id: promptId,
        p_brand_id: brandId,
      }
    );
    
    clearTimeout(timeoutId);
    
    if (rpcError) {
      throw new Error(`Score computation failed: ${rpcError.message}`);
    }
    
    return result;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const cronSecret = Deno.env.get('CRON_SECRET');
    
    // Check if this is a cron job request
    const isCronRequest = req.headers.get('x-cron-secret') === cronSecret;
    
    let orgId: string;
    let body: RequestBody = {};
    
    if (isCronRequest) {
      // Cron request: process all active orgs if no orgId specified
      body = await req.json().catch(() => ({}));
      
      if (!body.orgId) {
        // Batch process all active orgs
        const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
        
        // Find active orgs (those with responses in last 56 days)
        const { data: activeOrgIds } = await serviceClient
          .from('prompt_provider_responses')
          .select('org_id')
          .gte('run_at', new Date(Date.now() - 56 * 24 * 60 * 60 * 1000).toISOString())
          .eq('status', 'success');
        
        const uniqueOrgIds = [...new Set(activeOrgIds?.map(r => r.org_id) || [])];
        
        if (uniqueOrgIds.length === 0) {
          return new Response(
            JSON.stringify({ 
              message: 'No active organizations found',
              processed: 0,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        const { data: activeOrgs, error: orgsError } = await serviceClient
          .from('organizations')
          .select('id, name')
          .in('id', uniqueOrgIds);
        
        if (orgsError) {
          throw new Error(`Failed to fetch active orgs: ${orgsError.message}`);
        }
        
        if (!activeOrgs || activeOrgs.length === 0) {
          return new Response(
            JSON.stringify({ 
              message: 'No active organizations found',
              processed: 0,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        // Process each org
        const results = [];
        for (const org of activeOrgs) {
          try {
            const { data: rpcResult } = await serviceClient.rpc(
              'compute_llumos_score',
              {
                p_org_id: org.id,
                p_prompt_id: null,
              }
            );
            
            // Insert/update the score record (read-then-write to avoid unique constraint issues)
            console.log('[CronUpsertLookup]', {
              orgId: org.id,
              scope: 'org',
              promptId: null,
              windowStart: rpcResult.window.start,
            });
            const { data: existingScoreRecord } = await serviceClient
              .from('llumos_scores')
              .select('id')
              .eq('org_id', org.id)
              .eq('scope', 'org')
              .is('prompt_id', null)
              .eq('window_start', rpcResult.window.start)
              .maybeSingle();
            console.log('[CronUpsertLookupResult]', { found: !!existingScoreRecord?.id, id: existingScoreRecord?.id });
            
            if (existingScoreRecord?.id) {
              const { error: updateError } = await serviceClient
                .from('llumos_scores')
                .update({
                  composite: rpcResult.composite,
                  llumos_score: rpcResult.score,
                  submetrics: rpcResult.submetrics,
                  window_end: rpcResult.window.end,
                  reason: rpcResult.reason,
                })
                .eq('id', existingScoreRecord.id);
              if (updateError) {
                console.error('[CronUpdateError]', updateError);
                throw new Error(`Failed to update score: ${updateError.message}`);
              }
            } else {
              const { error: insertError } = await serviceClient
                .from('llumos_scores')
                .insert({
                  org_id: org.id,
                  prompt_id: null,
                  scope: 'org',
                  composite: rpcResult.composite,
                  llumos_score: rpcResult.score,
                  submetrics: rpcResult.submetrics,
                  window_start: rpcResult.window.start,
                  window_end: rpcResult.window.end,
                  reason: rpcResult.reason,
                });
              if (insertError) {
                console.error('[CronInsertError]', insertError);
                const msg = (insertError as any)?.message || '';
                const code = (insertError as any)?.code;
                if (code === '23505' || msg.includes('duplicate key') || msg.includes('already exists')) {
                  console.warn('[CronInsertConflict] Retrying as update.');
                  const { data: raceRecord } = await serviceClient
                    .from('llumos_scores')
                    .select('id')
                    .eq('org_id', org.id)
                    .eq('scope', 'org')
                    .is('prompt_id', null)
                    .eq('window_start', rpcResult.window.start)
                    .maybeSingle();
                  if (raceRecord?.id) {
                    const { error: updateError2 } = await serviceClient
                      .from('llumos_scores')
                      .update({
                        composite: rpcResult.composite,
                        llumos_score: rpcResult.score,
                        submetrics: rpcResult.submetrics,
                        window_end: rpcResult.window.end,
                        reason: rpcResult.reason,
                      })
                      .eq('id', raceRecord.id);
                    if (updateError2) {
                      console.error('[CronUpdateAfterConflictError]', updateError2);
                      throw new Error(`Failed to update score after conflict: ${updateError2.message}`);
                    }
                  } else {
                    throw new Error('Insert conflict occurred but no existing record was found.');
                  }
                } else {
                  throw new Error(`Failed to save score: ${msg}`);
                }
              }
            }
            
            results.push({ org_id: org.id, org_name: org.name, score: rpcResult.score, success: true });
          } catch (error) {
            console.error(`Failed to compute score for org ${org.id}:`, error);
            results.push({ 
              org_id: org.id, 
              org_name: org.name, 
              success: false, 
              error: error instanceof Error ? error.message : 'Unknown error' 
            });
          }
        }
        
        return new Response(
          JSON.stringify({
            message: 'Batch computation complete',
            processed: results.length,
            successful: results.filter(r => r.success).length,
            failed: results.filter(r => !r.success).length,
            results,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Single org specified in cron request
      orgId = body.orgId;
      console.log(`[CRON] Computing Llumos score for org ${orgId}`);
    } else {
      // User request: validate JWT and get org from user
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) {
        throw new Error('Missing authorization header');
      }

      // Extract token from "Bearer <token>" format
      const token = authHeader.replace('Bearer ', '');
      
      const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
      
      // Use anon key for JWT validation
      const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);

      const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
      if (authError || !user) {
        console.error('Auth validation failed:', authError);
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Use service role to fetch user's org_id (RLS bypassed)
      const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
      const { data: userData, error: userError } = await serviceClient
        .from('users')
        .select('org_id')
        .eq('id', user.id)
        .single();

      if (userError || !userData?.org_id) {
        console.error('User org lookup failed:', userError);
        throw new Error('User org not found');
      }

      orgId = userData.org_id;
      body = await req.json().catch(() => ({}));
    }

    // Parse request body
    const scope = body.scope || 'org';
    const promptId = body.promptId || null;
    const brandId = body.brandId || null;
    const force = body.force || false;

    // Validate scope
    if (scope !== 'org' && scope !== 'prompt') {
      throw new Error('Invalid scope. Must be "org" or "prompt"');
    }

    if (scope === 'prompt' && !promptId) {
      throw new Error('promptId required for prompt scope');
    }

    // Use service role client for computation
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    // Check for cached score (both for regular and brand-specific requests)
    // Use 1 hour TTL for regular, 24 hour TTL for brand-specific (to reduce load)
    const cacheTtl = brandId ? 24 * 60 * 60 * 1000 : 60 * 60 * 1000;
    const cachedScore = await getCachedScore(serviceClient, orgId, scope, promptId, cacheTtl);
    
    if (!force && cachedScore) {
      const cacheAge = Math.round((Date.now() - new Date(cachedScore.updated_at || cachedScore.created_at).getTime()) / 1000 / 60);
      console.log(`[Cache Hit] Returning cached score (age: ${cacheAge} minutes, brand: ${brandId || 'none'})`);
      return new Response(
        JSON.stringify({
          score: cachedScore.llumos_score,
          composite: cachedScore.composite,
          tier: getTier(cachedScore.llumos_score),
          submetrics: cachedScore.submetrics,
          window: {
            start: cachedScore.window_start,
            end: cachedScore.window_end,
          },
          totalResponses: cachedScore.reason === 'insufficient_data' ? 0 : undefined,
          refreshedAt: cachedScore.updated_at || cachedScore.created_at,
          cached: true,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`[Cache Miss] Computing fresh score for org ${orgId}, scope ${scope}, prompt ${promptId || 'all'}, brand ${brandId || 'all'}`);

    // Try to compute score with timeout protection
    let result;
    try {
      result = await computeScoreWithTimeout(serviceClient, orgId, promptId, brandId);
    } catch (computeError) {
      // If computation times out, try to return stale cached data
      console.error('[Compute Timeout/Error]', computeError);
      
      // Try to get any cached score (without TTL restriction) as fallback
      const staleCachedScore = await getCachedScore(
        serviceClient, 
        orgId, 
        scope, 
        promptId, 
        365 * 24 * 60 * 60 * 1000 // 1 year - basically any cached score
      );
      
      if (staleCachedScore) {
        const cacheAge = Math.round((Date.now() - new Date(staleCachedScore.updated_at || staleCachedScore.created_at).getTime()) / 1000 / 60);
        console.log(`[Fallback] Returning stale cached score (age: ${cacheAge} minutes)`);
        return new Response(
          JSON.stringify({
            score: staleCachedScore.llumos_score,
            composite: staleCachedScore.composite,
            tier: getTier(staleCachedScore.llumos_score),
            submetrics: staleCachedScore.submetrics,
            window: {
              start: staleCachedScore.window_start,
              end: staleCachedScore.window_end,
            },
            totalResponses: staleCachedScore.reason === 'insufficient_data' ? 0 : undefined,
            refreshedAt: staleCachedScore.updated_at || staleCachedScore.created_at,
            cached: true,
            stale: true,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // No cached data available, re-throw the error
      throw computeError;
    }

    console.log('Score computed:', result);

    // Insert/update the score record (read-then-write to avoid unique constraint issues)
    let conflictQuery = serviceClient
      .from('llumos_scores')
      .select('id')
      .eq('org_id', orgId)
      .eq('scope', scope)
      .eq('window_start', result.window.start);
    
    // Apply prompt filter based on scope
    if (scope === 'prompt' && promptId) {
      conflictQuery = conflictQuery.eq('prompt_id', promptId);
    } else {
      conflictQuery = conflictQuery.is('prompt_id', null);
    }
    
    console.log('[UpsertLookup]', {
      orgId,
      scope,
      promptId: scope === 'prompt' ? promptId : null,
      windowStart: result.window.start,
    });
    
    const { data: existingScoreRecord } = await conflictQuery.maybeSingle();
    console.log('[UpsertLookupResult]', { found: !!existingScoreRecord?.id, id: existingScoreRecord?.id });
    
    if (existingScoreRecord?.id) {
      const { error: updateError } = await serviceClient
        .from('llumos_scores')
        .update({
          composite: result.composite,
          llumos_score: result.score,
          submetrics: result.submetrics,
          window_end: result.window.end,
          reason: result.reason,
        })
        .eq('id', existingScoreRecord.id);
      
      if (updateError) {
        console.error('Update error:', updateError);
        throw new Error(`Failed to update score: ${updateError.message}`);
      }
    } else {
      const { error: insertError } = await serviceClient
        .from('llumos_scores')
        .insert({
          org_id: orgId,
          prompt_id: promptId ?? null,
          scope,
          composite: result.composite,
          llumos_score: result.score,
          submetrics: result.submetrics,
          window_start: result.window.start,
          window_end: result.window.end,
          reason: result.reason,
        });
      
      if (insertError) {
        console.error('Insert error:', insertError);
        const msg = (insertError as any)?.message || '';
        const code = (insertError as any)?.code;
        if (code === '23505' || msg.includes('duplicate key') || msg.includes('already exists')) {
          console.warn('Insert unique violation detected. Retrying as update.');
          const { data: raceRecord } = await conflictQuery.maybeSingle();
          if (raceRecord?.id) {
            const { error: updateError2 } = await serviceClient
              .from('llumos_scores')
              .update({
                composite: result.composite,
                llumos_score: result.score,
                submetrics: result.submetrics,
                window_end: result.window.end,
                reason: result.reason,
              })
              .eq('id', raceRecord.id);
            if (updateError2) {
              console.error('Update-after-conflict error:', updateError2);
              throw new Error(`Failed to update score after conflict: ${updateError2.message}`);
            }
          } else {
            throw new Error('Insert conflict occurred but no existing record was found.');
          }
        } else {
          throw new Error(`Failed to save score: ${msg}`);
        }
      }
    }

    // Fetch the updated record to get refreshedAt
    const { data: updatedScore } = await serviceClient
      .from('llumos_scores')
      .select('updated_at, created_at')
      .eq('org_id', orgId)
      .eq('scope', scope)
      .eq('window_start', result.window.start)
      .match(scope === 'prompt' ? { prompt_id: promptId } : { prompt_id: null })
      .maybeSingle();

    // Return the computed score
    return new Response(
      JSON.stringify({
        score: result.score,
        composite: result.composite,
        tier: result.tier,
        submetrics: result.submetrics,
        window: result.window,
        reason: result.reason,
        totalResponses: result.total_responses,
        refreshedAt: updatedScore?.updated_at || updatedScore?.created_at || new Date().toISOString(),
        cached: false,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in compute-llumos-score:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : undefined,
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

function getTier(score: number): string {
  if (score >= 760) return 'Excellent';
  if (score >= 700) return 'Very Good';
  if (score >= 640) return 'Good';
  if (score >= 580) return 'Fair';
  return 'Needs Improvement';
}
