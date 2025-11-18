import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';
// Removed requireOwnerRole import as we'll validate differently
import { getScoreThresholds } from '../_shared/scoring.ts';
import { toCanonical, cleanCompetitorList, type BrandCatalogEntry } from '../_shared/brand-matching.ts';
import { buildRecommendations } from '../_shared/reco/engine.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  
  // Admin client for writes/deletes
  const supabase = createClient(supabaseUrl, supabaseKey);
  // User-scoped client for reads/RPCs (ensures auth.uid() works in SECURITY DEFINER functions)
  const supabaseUser = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') || '' } },
  });

  try {
    // Safe body parsing and robust org resolution
    let body: any = {};
    try {
      body = await req.json();
    } catch (_: unknown) {
      body = {};
    }

    const url = new URL(req.url);
    const qp = url.searchParams;

    // Allow flags via body, headers, or query params
    const headerOrgId = req.headers.get('x-org-id');
    const headerCleanup = req.headers.get('x-cleanup-only') ?? req.headers.get('x-cleanup');
    const headerHardReset = req.headers.get('x-hard-reset');
    const headerForceNew = req.headers.get('x-force-new');

    console.log('[advanced-recommendations] raw body', body);

    const requestedOrgId = body.orgId || body.accountId || headerOrgId || qp.get('orgId') || qp.get('accountId') || null;

    const coRaw: any = (body.cleanupOnly ?? headerCleanup ?? qp.get('cleanupOnly') ?? qp.get('cleanup'));
    const hrRaw: any = (body.hardReset ?? headerHardReset ?? qp.get('hardReset'));
    const fnRaw: any = (body.forceNew ?? headerForceNew ?? qp.get('forceNew'));

    const cleanupOnly = coRaw === true || coRaw === 'true' || coRaw === '1';
    const forceNew = fnRaw === true || fnRaw === 'true' || fnRaw === '1';
    const hardReset = hrRaw === true || hrRaw === 'true' || hrRaw === '1';

    const queryParams = Object.fromEntries(qp.entries());
    console.log('[advanced-recommendations] parsed flags', { requestedOrgId, cleanupOnly, forceNew, hardReset, queryParams });
    let orgId = requestedOrgId as string | null;

    // If orgId not provided, try to resolve from caller JWT via anon client
    if (!orgId) {
      try {
        const supabaseAnon = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
          global: { headers: { Authorization: req.headers.get('Authorization') || '' } },
        });
        const { data: resolvedOrgId } = await (supabaseAnon as any).rpc('get_current_user_org_id');
        if (resolvedOrgId) orgId = resolvedOrgId as string;
      } catch (e: unknown) {
        console.warn('[advanced-recommendations] Could not resolve org from JWT:', e?.message || e);
      }
    }
    
    if (!orgId) {
      return new Response(JSON.stringify({ error: 'Organization ID is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    console.log(`[advanced-recommendations] Processing for org: ${orgId}, cleanupOnly: ${cleanupOnly}, forceNew: ${forceNew}`);
    
    // Handle cleanup-only mode
    if (cleanupOnly) {
      console.log('[advanced-recommendations] Running cleanup only', { hardReset });
      const cleanupResult = await cleanupOldRecommendations(supabase, orgId, hardReset);
      console.log(`[advanced-recommendations] Cleanup completed: deleted ${cleanupResult.deleted}`);
      
      return new Response(JSON.stringify({
        success: true,
        deleted: cleanupResult.deleted
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // Generate enhanced recommendations (reads via user client, writes via admin)
    const result = await generateEnhancedRecommendations(orgId, supabase, supabaseUser, forceNew);
    
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
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

async function generateEnhancedRecommendations(orgId: string, adminSupabase: any, userSupabase: any, forceNew: boolean = false) {
  try {
    // Use the enhanced recommendation engine with novelty support
    console.log(`[generateEnhancedRecommendations] Using enhanced engine for org ${orgId}, forceNew: ${forceNew}`);
    
    // Read with user-scoped client so RPCs honor auth.uid()
    const recommendations = await buildRecommendations(userSupabase, orgId, forceNew);
    
    if (!recommendations || recommendations.length === 0) {
      console.log(`[generateEnhancedRecommendations] No new recommendations generated`);
      return { success: true, created: 0, message: 'No new actionable insights found. Try again later or run cleanup to refresh suggestions.' };
    }

    // NEW STRATEGY: No wholesale deletion - insert only new topics
    let created = 0;
    let skipped = 0;

    for (const reco of recommendations) {
      try {
        const { error } = await adminSupabase
          .from('recommendations')
          .insert({
            org_id: orgId,
            type: reco.kind,
            title: reco.title,
            rationale: reco.rationale,
            status: 'open',
            metadata: {
              steps: reco.steps,
              estLift: reco.estLift,
              sourcePromptIds: reco.sourcePromptIds,
              sourceRunIds: reco.sourceRunIds,
              citations: reco.citations,
              cooldownDays: reco.cooldownDays || 14,
              timeline: reco.timeline,
              resources: reco.resources,
              expectedImpact: reco.expectedImpact,
              kpis: reco.kpis,
              topic_key: reco.topic_key,
              batch_id: reco.batch_id
            }
          });

        if (error) {
          console.error('Error inserting enhanced recommendation:', error);
          skipped++;
        } else {
          created++;
          console.log(`Created enhanced recommendation: ${reco.title}`);
        }
      } catch (error: unknown) {
        console.error('Error processing enhanced recommendation:', error);
        skipped++;
      }
    }

    // Capacity management: keep only newest 30 open/snoozed recommendations
    const { data: allRecommendations } = await adminSupabase
      .from('recommendations')
      .select('id, created_at')
      .eq('org_id', orgId)
      .in('status', ['open', 'snoozed'])
      .order('created_at', { ascending: false });

    if (allRecommendations && allRecommendations.length > 30) {
      const toDelete = allRecommendations.slice(30).map((r: any) => r.id);
      await adminSupabase
        .from('recommendations')
        .delete()
        .in('id', toDelete);
      console.log(`Cleaned up ${toDelete.length} old recommendations to maintain capacity`);
    }

    console.log(`[generateEnhancedRecommendations] Created ${created}, skipped ${skipped} for org ${orgId}`);

    // Enhanced messaging based on diversity and novelty
    let message: string;
    if (created >= 8) {
      message = `Generated ${created} fresh, diverse recommendations (balanced across content/SEO/social/prompts)!`;
    } else if (created >= 4) {
      message = `Generated ${created} new recommendations. Click again for more diverse suggestions across categories.`;
    } else if (created > 0) {
      message = `Generated ${created} new recommendations. Most topics recently covered - try cleanup or wait for fresh data.`;
    } else {
      message = 'All recent topics covered. Try cleanup to refresh or wait for new prompt data.';
    }

    return {
      success: true,
      created,
      skipped,
      message,
      categories_covered: [...new Set(recommendations.map(r => r.kind))]
    };
  } catch (error: unknown) {
    console.error('Error in generateEnhancedRecommendations:', error);
    return { success: false, error: error.message };
  }
}

function analyzePPRData(responses: any[], promptMap: Map<string, string>, org: any, brandCatalog: BrandCatalogEntry[]) {
  const lowVisibilityPrompts: any[] = [];
  const noMentionPrompts: any[] = [];
  let totalScore = 0;
  let scoreCount = 0;

  // Create canonical brand mapping
  const canonicalMap = toCanonical(brandCatalog);
  console.log(`[analyzePPRData] Created canonical map with ${canonicalMap.size} brand entries`);

  const groups: Record<string, { id: string, text: string, scores: number[], orgMentions: number, totalRuns: number, runIds: string[] }> = {};
  const allCompetitorBrands: string[] = [];

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

    // Collect all competitor brands for canonicalization
    const competitors = Array.isArray(r.competitors_json) ? r.competitors_json : [];
    allCompetitorBrands.push(...competitors);
  }

  // Clean and canonicalize competitors
  const cleanedCompetitors = cleanCompetitorList(allCompetitorBrands, canonicalMap);
  console.log(`[analyzePPRData] Found ${cleanedCompetitors.length} unique canonical competitors`);

  const thresholds = getScoreThresholds();
  for (const pid of Object.keys(groups)) {
    const g = groups[pid];
    const avgScore = g.scores.reduce((s, v) => s + v, 0) / g.scores.length;
    const orgMentionRate = g.orgMentions / g.totalRuns;

    const promptData = { id: g.id, text: g.text, avgScore, orgMentionRate, totalRuns: g.totalRuns, runIds: g.runIds };

    // Apply quality thresholds - only generate recommendations for significant data
    if (g.totalRuns < 3) continue; // Skip prompts with insufficient data
    
    if (orgMentionRate === 0 && g.totalRuns >= 5) {
      noMentionPrompts.push(promptData);
    } else if (avgScore < thresholds.fair && orgMentionRate > 0) {
      lowVisibilityPrompts.push(promptData);
    }
  }

  // Filter top competitors by mention threshold
  const qualifiedCompetitors = cleanedCompetitors.filter(c => c.mentions >= 3);

  return {
    lowVisibilityPrompts: lowVisibilityPrompts.slice(0, 8),
    noMentionPrompts: noMentionPrompts.slice(0, 8),
    topCompetitors: qualifiedCompetitors,
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
      title: `Build a comprehensive ${topic} content hub featuring ${org.name}`,
      rationale: `${org.name} is completely absent from ${analysis.noMentionPrompts.length} high-intent queries in your space. A strategic content hub will establish topical authority and capture this missed demand with targeted, expert-level content.`,
      status: 'open',
      metadata: {
        timeline: '3-4 weeks implementation',
        resources: 'Content strategist, SEO specialist, subject matter expert',
        expectedImpact: '18-25% visibility increase in target queries',
        wordCount: '8,000-12,000 words across hub sections',
        publishChannels: ['Company blog', 'LinkedIn articles', 'Industry publications'],
        contentFormat: 'Long-form pillar page with supporting cluster content',
        steps: [
          `Research and map ${topic} keyword clusters (150+ related terms)`,
          `Create 6,000-word comprehensive pillar page with expert insights and ${org.name} case studies`,
          `Develop 8-10 supporting articles (800-1,200 words each) targeting specific long-tail queries`,
          `Add interactive elements: comparison tables, ROI calculators, decision frameworks`,
          `Implement structured data markup and FAQ schema for AI optimization`,
          `Create downloadable resources: templates, checklists, implementation guides`,
          `Launch coordinated social campaign across LinkedIn, Twitter, and industry forums`,
          `Set up email nurture sequence for content hub visitors`,
        ],
        kpis: ['Organic traffic to hub pages', 'Time on page (target: 4+ min)', 'Lead conversion rate', 'AI platform mentions'],
        distributionPlan: {
          week1: 'Publish pillar page, share on LinkedIn with thought leadership angle',
          week2: 'Release 2-3 cluster articles, engage in relevant industry discussions',
          week3: 'Publish remaining cluster content, email campaign to subscriber list',
          week4: 'Guest posting and PR outreach, influencer engagement'
        },
        estLift: 0.22,
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
    const topCompetitor = analysis.topCompetitors[0];
    const competitorName = topCompetitor.canonical;
    const mentions = topCompetitor.mentions;
    
    recs.push({
      org_id: orgId,
      type: 'content',
      title: `Create definitive "${org.name} vs ${competitorName}" comparison page`,
      rationale: `${competitorName} appears in ${mentions} AI responses across recent queries, showing strong competitive presence. Create an evidence-based comparison page to capture high-intent prospects evaluating alternatives.`,
      status: 'open',
      metadata: {
        timeline: '2-3 weeks development + ongoing optimization',
        resources: 'Product marketing manager, sales team input, customer success stories',
        expectedImpact: '15-20% increase in competitive win rate',
        wordCount: '3,500-4,500 words with visual comparisons',
        publishChannels: ['Dedicated landing page', 'LinkedIn Sponsored Content', 'Sales enablement'],
        contentFormat: 'Interactive comparison with filtering and customization',
        steps: [
          `Competitive intelligence: audit ${competitorName}'s messaging, pricing, and positioning`,
          `Interview 5-8 customers who evaluated ${competitorName} to understand decision factors`,
          `Create detailed feature comparison matrix with clear advantage messaging`,
          `Develop ROI calculator showing cost savings vs ${competitorName}`,
          `Add migration guide with timeline and support resources`,
          `Include video testimonials from competitive wins (2-3 minutes each)`,
          `Build retargeting sequences for page visitors with demo CTAs`,
          `Create sales battlecard and training materials for competitive deals`,
        ],
        kpis: ['Page engagement rate', 'Demo conversion rate', 'Competitive win rate', 'Sales cycle reduction'],
        seoStrategy: {
          primaryKeywords: [`${org.name} vs ${competitorName}`, `${competitorName} alternative`, `${org.name} comparison`],
          contentGaps: 'Target specific comparison queries where competitor dominates',
          linkBuilding: 'Outreach to review sites and industry publications'
        },
        estLift: 0.18,
        sourcePromptIds: analysis.lowVisibilityPrompts.slice(0, 5).map((p: any) => p.id),
        sourceRunIds: [],
        cooldownDays: 21, // Longer cooldown for competitive content
        impact: 'high',
        category: 'competitive_analysis',
        competitorMentions: mentions,
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
      title: `AI visibility optimization for underperforming pages (score: ${avgScore.toFixed(1)}/10)`,
      rationale: `${org.name} appears in responses but ranks poorly (avg ${avgScore.toFixed(1)}/10). Strategic on-page optimization and authority building will improve AI model weighting and increase favorable mentions.`,
      status: 'open',
      metadata: {
        timeline: '4-6 weeks implementation with monthly iterations',
        resources: 'Technical SEO specialist, content optimization team, developer support',
        expectedImpact: '25-35% improvement in AI mention quality and frequency',
        wordCount: 'Expand target pages by 40-60% (add 1,000-2,000 words per page)',
        publishChannels: ['Existing website pages', 'Knowledge base expansion', 'FAQ sections'],
        contentFormat: 'Enhanced existing pages with authority signals and structured data',
        steps: [
          `Audit current pages: identify content gaps and weak authority signals`,
          `Add comprehensive FAQ sections with schema markup to target pages`,
          `Enrich author bios with credentials, expertise indicators, and social proof`,
          `Create citation-worthy statistics and original research sections`,
          `Implement Review/Rating schema and customer testimonial integration`,
          `Build internal link networks between related pages and resources`,
          `Develop linkable assets: industry reports, benchmark data, tools`,
          `Monthly AI mention monitoring and content iteration based on results`,
        ],
        kpis: ['AI mention frequency', 'Average mention score', 'Organic click-through rate', 'Page authority metrics'],
        technicalRequirements: {
          schemaTypes: ['FAQ', 'Review', 'Organization', 'Article'],
          pageSpeed: 'Target Core Web Vitals scores above 90',
          mobileOptimization: 'Ensure mobile-first indexing compatibility'
        },
        estLift: 0.28,
        sourcePromptIds: analysis.lowVisibilityPrompts.map((p: any) => p.id),
        sourceRunIds: [],
        cooldownDays: 14,
        impact: 'high',
        category: 'visibility_optimization',
      },
    });
  }

  // Social media amplification strategy
  if (analysis.topCompetitors.length > 0 || analysis.avgScore < 5.0) {
    recs.push({
      org_id: orgId,
      type: 'social',
      title: `Strategic social media amplification to boost AI training data`,
      rationale: `Current AI model performance suggests insufficient social proof and thought leadership signals. A targeted social strategy will create training data that improves future AI responses about ${org.name}.`,
      status: 'open',
      metadata: {
        timeline: '2-3 weeks setup + 8-week execution',
        resources: 'Social media manager, video production team, employee advocates',
        expectedImpact: '12-18% increase in social mention quality and reach',
        wordCount: 'Varied: 280 chars (Twitter), 1,300 chars (LinkedIn), 2,000+ (articles)',
        publishChannels: ['LinkedIn (primary)', 'Twitter/X', 'Industry Slack communities', 'Reddit relevant subreddits'],
        contentFormat: 'Multi-format: thought leadership posts, video testimonials, live discussions',
        steps: [
          `Develop 12-week editorial calendar focused on industry expertise and insights`,
          `Create weekly LinkedIn articles (1,200-1,500 words) on industry trends and ${org.name} perspective`,
          `Launch bi-weekly Twitter Spaces or LinkedIn Live sessions with industry experts`,
          `Coordinate employee advocacy program: 15-20 team members sharing curated content`,
          `Engage authentically in 5-8 industry Slack communities and Reddit discussions`,
          `Partner with industry influencers for co-created content and cross-promotion`,
          `Document and share customer success stories with specific metrics and outcomes`,
          `Track social signals and mentions across platforms for AI training impact`,
        ],
        kpis: ['Social mention sentiment', 'Engagement rate by platform', 'Share of voice vs competitors', 'Inbound demo requests from social'],
        contentPillars: {
          thoughtLeadership: '40% - Industry insights and trend analysis',
          customerSuccess: '30% - Case studies and testimonials',
          companyUpdates: '20% - Product updates and team highlights',
          communityEngagement: '10% - Responses and discussions'
        },
        estLift: 0.15,
        sourcePromptIds: analysis.noMentionPrompts.slice(0, 3).map((p: any) => p.id),
        sourceRunIds: [],
        cooldownDays: 21,
        impact: 'medium',
        category: 'social_amplification',
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

async function cleanupOldRecommendations(supabase: any, orgId: string, hardReset: boolean = false) {
  try {
    console.log(`[cleanup] Starting cleanup for org: ${orgId} (hardReset=${hardReset})`);

    if (hardReset) {
      const { error } = await supabase
        .from('recommendations')
        .delete()
        .eq('org_id', orgId)
        .in('status', ['open', 'snoozed']);
      if (error) {
        console.error('[cleanup] Hard reset failed:', error);
        return { deleted: 0 };
      }
      console.log('[cleanup] Hard reset completed for open/snoozed recommendations');
      return { deleted: -1 }; // sentinel for full reset
    }
    
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
  } catch (error: unknown) {
    console.error('[cleanup] Cleanup error:', error);
    return { deleted: 0 };
  }
}