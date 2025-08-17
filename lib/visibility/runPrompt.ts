/**
 * Visibility runner for executing prompts against providers
 */

import { supabase } from '@/integrations/supabase/client';
import { normalize, isOrgBrand } from '../brand/match';
import { computeScore } from '../scoring/visibility';
import { extractBrands as extractBrandsOpenAI } from '../providers/openai';
import { extractBrands as extractBrandsPerplexity } from '../providers/perplexity';
import { getQuotasForTier } from '../tiers/quotas';
import { extractArtifacts, createBrandGazetteer } from './extractArtifacts';

export interface RunPromptResult {
  success: boolean;
  error?: string;
  runsCreated: number;
}

export async function runPrompt(promptId: string, orgId: string, openaiKey?: string, perplexityKey?: string): Promise<RunPromptResult> {
  try {
    // Load prompt and org data
    const { data: prompt } = await supabase
      .from('prompts')
      .select('text')
      .eq('id', promptId)
      .single();

    if (!prompt) {
      return { success: false, error: 'Prompt not found' };
    }

    const { data: org } = await supabase
      .from('organizations')
      .select('plan_tier')
      .eq('id', orgId)
      .single();

    if (!org) {
      return { success: false, error: 'Organization not found' };
    }

    // Get enabled providers
    const { data: providers } = await supabase
      .from('llm_providers')
      .select('*')
      .eq('enabled', true)
      .order('name');

    if (!providers || providers.length === 0) {
      return { success: false, error: 'No enabled providers' };
    }

    // Get org brand catalog
    const { data: brandCatalog } = await supabase
      .from('brand_catalog')
      .select('name, variants_json')
      .eq('org_id', orgId);

    if (!brandCatalog) {
      return { success: false, error: 'Could not load brand catalog' };
    }

    const quotas = getQuotasForTier(org.plan_tier);
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
      return { success: false, error: 'Daily quota exceeded' };
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

        // Normalize and analyze brands (keep existing logic for compatibility)
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
            cost_est: 0, // Will be calculated based on tier costs later
            citations: artifacts.citations,
            brands: artifacts.brands,
            competitors: artifacts.competitors
          })
          .select()
          .single();

        if (newRun) {
          // Insert visibility_results (keep existing structure for compatibility)
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

  } catch (error: any) {
    return { success: false, error: error.message };
  }
}