import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
// Removed requireOwnerRole import as we'll validate differently
import { getScoreThresholds } from '../_shared/scoring.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Safe body parsing and robust org resolution
    let body: any = {};
    try {
      body = await req.json();
    } catch (_) {
      body = {};
    }

    const requestedOrgId = body.orgId || body.accountId || null;
    const cleanupOnly = !!body.cleanupOnly;

    let orgId = requestedOrgId as string | null;

    // If orgId not provided, try to resolve from caller JWT via anon client
    if (!orgId) {
      try {
        const supabaseAnon = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
          global: { headers: { Authorization: req.headers.get('Authorization') || '' } },
        });
        const { data: resolvedOrgId } = await (supabaseAnon as any).rpc('get_current_user_org_id');
        if (resolvedOrgId) orgId = resolvedOrgId as string;
      } catch (e) {
        console.warn('[advanced-recommendations] Could not resolve org from JWT:', e?.message || e);
      }
    }
    
    if (!orgId) {
      return new Response(JSON.stringify({ error: 'Organization ID is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    console.log(`[advanced-recommendations] Processing for org: ${orgId}, cleanupOnly: ${cleanupOnly}`);
    
    // Handle cleanup-only mode
    if (cleanupOnly) {
      console.log('[advanced-recommendations] Running cleanup only');
      const cleanupResult = await cleanupOldRecommendations(supabase, orgId);
      console.log(`[advanced-recommendations] Cleanup completed: deleted ${cleanupResult.deleted}`);
      
      return new Response(JSON.stringify({
        success: true,
        deleted: cleanupResult.deleted
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // Generate enhanced recommendations
    const result = await generateEnhancedRecommendations(orgId, supabase);
    
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error generating recommendations:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message,
      created: 0
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function generateEnhancedRecommendations(orgId: string, supabase: any) {
  try {
    const sinceIso = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // Fetch org, prompts, and recent responses in parallel
    const [orgRes, promptsRes, responsesRes] = await Promise.all([
      supabase
        .from('organizations')
        .select('id, name, business_description, target_audience, keywords')
        .eq('id', orgId)
        .single(),
      supabase
        .from('prompts')
        .select('id, text')
        .eq('org_id', orgId),
      supabase
        .from('prompt_provider_responses')
        .select('id, prompt_id, run_at, score, org_brand_present, org_brand_prominence, competitors_count, brands_json, competitors_json, metadata, status')
        .eq('org_id', orgId)
        .eq('status', 'success')
        .gte('run_at', sinceIso)
        .order('run_at', { ascending: false })
        .limit(1000)
    ]);

    const org = orgRes.data;
    const prompts = promptsRes.data || [];
    const responses = responsesRes.data || [];

    if (!org) {
      return { success: false, error: 'Organization not found' };
    }

    if (responses.length === 0) {
      return { success: true, created: 0, message: 'No recent data to analyze' };
    }

    const promptMap = new Map<string, string>(prompts.map((p: any) => [p.id, p.text]));

    // Analyze data
    const analysisResults = analyzePPRData(responses, promptMap, org);

    // Build recommendations from analysis
    const recommendations = buildRecommendationsFromAnalysis(analysisResults, org, orgId);

    // Remove existing open/snoozed to avoid duplicates
    await supabase
      .from('recommendations')
      .delete()
      .eq('org_id', orgId)
      .in('status', ['open', 'snoozed']);

    // Insert new recommendations
    let created = 0;
    for (const rec of recommendations) {
      const { error } = await supabase.from('recommendations').insert(rec);
      if (error) {
        console.error('Error inserting recommendation:', error);
      } else {
        created++;
      }
    }

    const cleanupResult = await cleanupOldRecommendations(supabase, orgId);

    return {
      success: true,
      created,
      deleted: cleanupResult.deleted,
      analysisResults: {
        totalResults: responses.length,
        lowVisibilityPrompts: analysisResults.lowVisibilityPrompts.length,
        noMentionPrompts: analysisResults.noMentionPrompts.length,
        topCompetitors: analysisResults.topCompetitors.slice(0, 3).map((c: any) => c[0]),
        avgVisibilityScore: analysisResults.avgScore,
      },
    };
  } catch (error: any) {
    console.error('Error in generateEnhancedRecommendations:', error);
    return { success: false, error: error.message };
  }
}

function analyzePPRData(responses: any[], promptMap: Map<string, string>, org: any) {
  const lowVisibilityPrompts: any[] = [];
  const noMentionPrompts: any[] = [];
  const competitorCounts: Record<string, number> = {};
  let totalScore = 0;
  let scoreCount = 0;

  const groups: Record<string, { id: string, text: string, scores: number[], orgMentions: number, totalRuns: number, runIds: string[] }> = {};

  for (const r of responses) {
    const pid = r.prompt_id;
    if (!groups[pid]) {
      groups[pid] = { id: pid, text: promptMap.get(pid) || 'Untitled prompt', scores: [], orgMentions: 0, totalRuns: 0, runIds: [] };
    }
    groups[pid].scores.push(Number(r.score) || 0);
    groups[pid].totalRuns++;
    groups[pid].runIds.push(r.id);

    if (r.org_brand_present) groups[pid].orgMentions++;

    totalScore += Number(r.score) || 0;
    scoreCount++;

    const brands = Array.isArray(r.brands_json) ? r.brands_json : [];
    for (const brand of brands) {
      if (typeof brand !== 'string') continue;
      const normalized = brand.toLowerCase().trim();
      if (org?.name && normalized.includes(org.name.toLowerCase())) continue;
      const exclude = ['openai','claude','copilot','google','chatgpt','ai','microsoft'];
      if (exclude.some(t => normalized.includes(t))) continue;
      competitorCounts[brand] = (competitorCounts[brand] || 0) + 1;
    }
  }

  const thresholds = getScoreThresholds();
  for (const pid of Object.keys(groups)) {
    const g = groups[pid];
    const avgScore = g.scores.reduce((s, v) => s + v, 0) / g.scores.length;
    const orgMentionRate = g.orgMentions / g.totalRuns;

    const promptData = { id: g.id, text: g.text, avgScore, orgMentionRate, totalRuns: g.totalRuns, runIds: g.runIds };

    if (orgMentionRate === 0) noMentionPrompts.push(promptData);
    else if (avgScore < thresholds.fair) lowVisibilityPrompts.push(promptData);
  }

  const topCompetitors = Object.entries(competitorCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

  return {
    lowVisibilityPrompts: lowVisibilityPrompts.slice(0, 8),
    noMentionPrompts: noMentionPrompts.slice(0, 8),
    topCompetitors,
    avgScore: scoreCount > 0 ? totalScore / scoreCount : 0,
  };
}

function buildRecommendationsFromAnalysis(analysis: any, org: any, orgId: string) {
  const recs: any[] = [];

  // Content hub for no-mention prompts
  if (analysis.noMentionPrompts.length > 0) {
    const topic = extractMainTopic(analysis.noMentionPrompts.map((p: any) => p.text));
    recs.push({
      org_id: orgId,
      type: 'content',
      title: `Build a ${topic} content hub highlighting ${org.name}`,
      rationale: `${org.name} is absent in ${analysis.noMentionPrompts.length} high-intent queries. A focused hub will establish topical authority and capture missed demand.`,
      status: 'open',
      metadata: {
        steps: [
          `Create a pillar page covering ${topic} end‑to‑end with expert POV`,
          'Produce 8–12 clustered articles targeting adjacent long‑tails',
          'Add FAQs and schema to improve semantic understanding',
          'Include case studies and proof points to build trust',
          'Launch social and email to seed engagement',
        ],
        estLift: 0.18,
        sourcePromptIds: analysis.noMentionPrompts.slice(0, 5).map((p: any) => p.id),
        sourceRunIds: [],
        cooldownDays: 14,
        impact: 'high',
        category: 'content_hub',
      },
    });
  }

  // Competitive comparison against top competitor
  if (analysis.topCompetitors.length > 0) {
    const [competitorName] = analysis.topCompetitors[0];
    recs.push({
      org_id: orgId,
      type: 'content',
      title: `${org.name} vs ${competitorName}: evidence‑based comparison`,
      rationale: `${competitorName} dominates conversations across multiple prompts. A transparent comparison captures high‑intent demand and reframes evaluation criteria in your favor.`,
      status: 'open',
      metadata: {
        steps: [
          `Map ${competitorName}'s messaging and differentiators`,
          `Create a structured, scannable comparison page`,
          'Include pricing/ROI and migration guidance',
          'Collect testimonials from recent competitive wins',
          'Retarget visitors with a demo CTA sequence',
        ],
        estLift: 0.15,
        sourcePromptIds: analysis.lowVisibilityPrompts.slice(0, 5).map((p: any) => p.id),
        sourceRunIds: [],
        cooldownDays: 14,
        impact: 'high',
        category: 'competitive_analysis',
      },
    });
  }

  // Visibility optimization for low‑performing prompts
  if (analysis.lowVisibilityPrompts.length > 0) {
    const avgScore = (
      analysis.lowVisibilityPrompts.reduce((s: number, p: any) => s + p.avgScore, 0) /
      analysis.lowVisibilityPrompts.length
    ) || 0;

    recs.push({
      org_id: orgId,
      type: 'site',
      title: `Raise visibility signals on key pages (avg score ${avgScore.toFixed(1)}/10)`,
      rationale: `${org.name} is present but underweighted by AI models. Improve authority, structure, and internal signals on affected pages.`,
      status: 'open',
      metadata: {
        steps: [
          'Add structured data and FAQs to key pages',
          'Strengthen topical clusters with internal links',
          'Enrich E‑E‑A‑T with author bios and citations',
          'Publish linkable assets to earn quality references',
          'Monitor AI mentions and iterate monthly',
        ],
        estLift: 0.22,
        sourcePromptIds: analysis.lowVisibilityPrompts.map((p: any) => p.id),
        sourceRunIds: [],
        cooldownDays: 14,
        impact: 'high',
        category: 'visibility_optimization',
      },
    });
  }

  return recs;
}

function extractMainTopic(promptTexts: string[]): string {
  // Simple topic extraction - look for common terms
  const commonWords = new Map();
  
  for (const text of promptTexts) {
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 3 && !['what', 'best', 'good', 'help', 'find', 'need', 'want', 'most', 'like'].includes(w));
    
    for (const word of words) {
      commonWords.set(word, (commonWords.get(word) || 0) + 1);
    }
  }

  // Get most frequent meaningful word
  const sortedWords = Array.from(commonWords.entries())
    .sort(([,a], [,b]) => b - a);
  
  return sortedWords.length > 0 ? sortedWords[0][0] : 'industry expertise';
}

async function cleanupOldRecommendations(supabase: any, orgId: string) {
  try {
    console.log(`[cleanup] Starting cleanup for org: ${orgId}`);
    
    // Get all recommendations for org, ordered by created_at DESC
    const { data: allRecs, error: fetchError } = await supabase
      .from('recommendations')
      .select('id, created_at')
      .eq('org_id', orgId)
      .in('status', ['open', 'snoozed'])
      .order('created_at', { ascending: false });

    if (fetchError) {
      console.error('[cleanup] Error fetching recommendations:', fetchError);
      return { deleted: 0 };
    }

    // If we have more than 20, delete the oldest ones
    if (allRecs && allRecs.length > 20) {
      const toDelete = allRecs.slice(20); // Keep first 20, delete the rest
      const idsToDelete = toDelete.map(r => r.id);
      
      console.log(`[cleanup] Deleting ${idsToDelete.length} old recommendations`);
      
      const { error: deleteError } = await supabase
        .from('recommendations')
        .delete()
        .in('id', idsToDelete);

      if (deleteError) {
        console.error('[cleanup] Error deleting recommendations:', deleteError);
        return { deleted: 0 };
      }
      
      console.log(`[cleanup] Successfully deleted ${idsToDelete.length} recommendations`);
      return { deleted: idsToDelete.length };
    }
    
    console.log(`[cleanup] No cleanup needed, only ${allRecs?.length || 0} recommendations`);
    return { deleted: 0 };
  } catch (error) {
    console.error('[cleanup] Cleanup error:', error);
    return { deleted: 0 };
  }
}