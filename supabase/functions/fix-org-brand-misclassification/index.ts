/**
 * Backfill Script: Fix Org Brand Misclassification
 * 
 * This edge function identifies and fixes cases where org brands were
 * misclassified as competitors (like "HubSpot CRM" being treated as a competitor
 * when "HubSpot" is the organization's brand).
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

interface FixResult {
  orgId: string;
  orgName: string;
  responsesFixed: number;
  misclassifiedTerms: string[];
  newScores: { responseId: string; oldScore: number; newScore: number }[];
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { orgId, dryRun = true } = await req.json();

    if (!orgId) {
      return Response.json(
        { error: 'orgId is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    console.log(`🔧 Starting org brand misclassification fix for org: ${orgId} (dry run: ${dryRun})`);

    // 1. Get organization info
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('name, domain')
      .eq('id', orgId)
      .single();

    if (orgError || !org) {
      throw new Error(`Failed to fetch organization: ${orgError?.message}`);
    }

    // 2. Get org brands from brand catalog
    const { data: orgBrands, error: brandsError } = await supabase
      .from('brand_catalog')
      .select('name, variants_json')
      .eq('org_id', orgId)
      .eq('is_org_brand', true);

    if (brandsError) {
      throw new Error(`Failed to fetch org brands: ${brandsError.message}`);
    }

    // 3. Generate comprehensive org brand aliases
    const orgBrandAliases = new Set<string>();
    
    // Add org name and domain-based variants
    if (org.name) {
      addBrandAliases(orgBrandAliases, org.name);
    }
    
    if (org.domain) {
      const domainBrand = org.domain.split('.')[0];
      const capitalizedDomain = capitalize(domainBrand);
      addBrandAliases(orgBrandAliases, capitalizedDomain);
    }

    // Add catalog brands and their variants
    for (const brand of orgBrands || []) {
      addBrandAliases(orgBrandAliases, brand.name);
      
      if (brand.variants_json && Array.isArray(brand.variants_json)) {
        for (const variant of brand.variants_json) {
          addBrandAliases(orgBrandAliases, variant);
        }
      }
    }

    console.log(`🏷️ Generated ${orgBrandAliases.size} org brand aliases`);

    // 4. Find misclassified responses
    const { data: responses, error: responsesError } = await supabase
      .from('prompt_provider_responses')
      .select('id, competitors_json, score, org_brand_present, run_at')
      .eq('org_id', orgId)
      .eq('status', 'success')
      .gte('run_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()) // Last 30 days
      .not('competitors_json', 'eq', '[]');

    if (responsesError) {
      throw new Error(`Failed to fetch responses: ${responsesError.message}`);
    }

    const fixes: any[] = [];
    const misclassifiedTerms = new Set<string>();
    let totalFixed = 0;

    // 5. Process each response
    for (const response of responses || []) {
      if (!response.competitors_json || !Array.isArray(response.competitors_json)) {
        continue;
      }

      const originalCompetitors = response.competitors_json;
      const filteredCompetitors: string[] = [];
      const foundOrgBrands: string[] = [];

      // Check each competitor
      for (const competitor of originalCompetitors) {
        if (typeof competitor !== 'string') continue;
        
        const normalizedCompetitor = competitor.toLowerCase().trim();
        let isOrgBrand = false;

        // Check against all org brand aliases
        for (const alias of orgBrandAliases) {
          if (normalizedCompetitor === alias || 
              normalizedCompetitor.includes(alias) ||
              alias.includes(normalizedCompetitor)) {
            
            // Additional validation to avoid false positives
            const competitorWords = normalizedCompetitor.split(' ');
            const aliasWords = alias.split(' ');
            
            // If competitor contains all words from alias, it's likely the same org
            const containsAllAliasWords = aliasWords.every(aliasWord =>
              competitorWords.some(compWord => compWord === aliasWord)
            );
            
            if (containsAllAliasWords) {
              isOrgBrand = true;
              foundOrgBrands.push(competitor);
              misclassifiedTerms.add(competitor);
              console.log(`🎯 Found misclassified org brand: "${competitor}" matches alias "${alias}"`);
              break;
            }
          }
        }

        if (!isOrgBrand) {
          filteredCompetitors.push(competitor);
        }
      }

      // If we found misclassified terms, prepare the fix
      if (foundOrgBrands.length > 0) {
        const oldScore = response.score || 0;
        let newScore = oldScore;

        // Recalculate score based on org brand presence
        if (!response.org_brand_present) {
          // Brand found, boost score significantly
          newScore = Math.max(6.0, oldScore + 3.0);
          
          // Adjust for competition level
          const competitionPenalty = Math.min(1.5, filteredCompetitors.length * 0.2);
          newScore = Math.max(4.0, newScore - competitionPenalty);
        }

        const fix = {
          responseId: response.id,
          oldScore,
          newScore,
          originalCompetitorsCount: originalCompetitors.length,
          newCompetitorsCount: filteredCompetitors.length,
          foundOrgBrands,
          filteredCompetitors
        };

        fixes.push(fix);
        totalFixed++;

        // Apply fix if not dry run
        if (!dryRun) {
          const { error: updateError } = await supabase
            .from('prompt_provider_responses')
            .update({
              org_brand_present: true,
              org_brand_prominence: 1, // Assume early position since it was detected
              competitors_json: filteredCompetitors,
              competitors_count: filteredCompetitors.length,
              score: newScore,
              metadata: {
                ...response.metadata,
                org_brand_fix_applied: true,
                original_score: oldScore,
                original_competitors_count: originalCompetitors.length,
                misclassified_org_brands: foundOrgBrands,
                fix_applied_at: new Date().toISOString(),
                fix_version: '3.0'
              }
            })
            .eq('id', response.id);

          if (updateError) {
            console.error(`❌ Failed to update response ${response.id}:`, updateError.message);
          } else {
            console.log(`✅ Fixed response ${response.id}: score ${oldScore} → ${newScore}`);
          }
        }
      }
    }

    const result: FixResult = {
      orgId,
      orgName: org.name,
      responsesFixed: totalFixed,
      misclassifiedTerms: Array.from(misclassifiedTerms),
      newScores: fixes.map(f => ({
        responseId: f.responseId,
        oldScore: f.oldScore,
        newScore: f.newScore
      }))
    };

    console.log(`🎉 Fix complete: ${totalFixed} responses would be fixed`);
    console.log(`📊 Misclassified terms found: ${Array.from(misclassifiedTerms).join(', ')}`);

    return Response.json({
      success: true,
      dryRun,
      result,
      summary: {
        orgId,
        orgName: org.name,
        totalResponses: responses?.length || 0,
        responsesFixed: totalFixed,
        misclassifiedTermsCount: misclassifiedTerms.size,
        avgScoreIncrease: fixes.length > 0 
          ? fixes.reduce((sum, f) => sum + (f.newScore - f.oldScore), 0) / fixes.length 
          : 0
      }
    }, { headers: corsHeaders });

  } catch (error) {
    console.error('❌ Fix failed:', error);
    return Response.json(
      { error: error.message },
      { status: 500, headers: corsHeaders }
    );
  }
});

/**
 * Generate common business aliases for a brand name
 */
function addBrandAliases(aliasSet: Set<string>, brandName: string): void {
  const normalized = brandName.toLowerCase().trim();
  aliasSet.add(normalized);
  
  const businessSuffixes = [
    'crm', 'platform', 'software', 'app', 'tool', 'suite', 'system',
    'marketing hub', 'sales hub', 'service hub', 'marketing platform',
    'sales platform', 'marketing software', 'sales software',
    'automation', 'analytics', 'insights', 'pro', 'enterprise'
  ];

  for (const suffix of businessSuffixes) {
    aliasSet.add(`${normalized} ${suffix}`);
  }
}

/**
 * Capitalize first letter of each word
 */
function capitalize(str: string): string {
  return str.split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}