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
    // Parse request body to get orgId and mode
    const { orgId, cleanupOnly } = await req.json();
    
    if (!orgId) {
      console.log('[advanced-recommendations] Missing orgId in request');
      throw new Error('Organization ID is required');
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
    // Get comprehensive data for analysis
    const [orgData, visibilityData, recentRunsData] = await Promise.all([
      // Organization info
      supabase
        .from('organizations')
        .select('name, business_description, target_audience, products_services, keywords')
        .eq('id', orgId)
        .single(),
      
      // Recent visibility performance with detailed context
      supabase
        .from('visibility_results')
        .select(`
          *,
          prompt_runs!inner (
            id,
            prompt_id,
            run_at,
            raw_ai_response,
            citations,
            prompts!inner (
              text,
              org_id
            ),
            llm_providers!inner (
              name
            )
          )
        `)
        .eq('prompt_runs.prompts.org_id', orgId)
        .gte('prompt_runs.run_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .order('prompt_runs.run_at', { ascending: false })
        .limit(50),
      
      // Recent prompt performance summary using secure function
      supabase.rpc('get_prompt_visibility_7d', {
        requesting_org_id: orgId
      })
    ]);

    const org = orgData.data;
    const detailedResults = visibilityData.data || [];
    const promptSummary = recentRunsData.data || [];

    if (!org) {
      return { success: false, error: 'Organization not found' };
    }

    if (detailedResults.length === 0) {
      return { success: true, created: 0, message: 'No recent data to analyze' };
    }

    console.log(`Analyzing ${detailedResults.length} detailed results for ${org.name}`);

    // Analyze data and generate strategic recommendations
    const analysisResults = analyzeVisibilityData(detailedResults, promptSummary, org);
    const recommendations = generateDetailedRecommendations(analysisResults, org, orgId);

    // Remove existing auto-generated recommendations
    await supabase
      .from('recommendations')
      .delete()
      .eq('org_id', orgId)
      .in('status', ['open', 'snoozed']);

    // Insert new recommendations
    let created = 0;
    for (const recommendation of recommendations) {
      const { error } = await supabase
        .from('recommendations')
        .insert(recommendation);

      if (error) {
        console.error('Error inserting recommendation:', error);
      } else {
        created++;
        console.log(`✓ Created: ${recommendation.title.substring(0, 60)}...`);
      }
    }

    // Cleanup old recommendations to maintain max 20
    const cleanupResult = await cleanupOldRecommendations(supabase, orgId);
    console.log(`[generateEnhanced] Cleanup: deleted ${cleanupResult.deleted} old recommendations`);

    return {
      success: true,
      created,
      deleted: cleanupResult.deleted,
      analysisResults: {
        totalResults: detailedResults.length,
        visibilityPromptsAnalyzed: analysisResults.lowVisibilityPrompts.length + analysisResults.noMentionPrompts.length,
        organizationName: org.name,
        avgVisibilityScore: analysisResults.avgScore
      }
    };

  } catch (error: any) {
    console.error('Error in generateEnhancedRecommendations:', error);
    return { success: false, error: error.message };
  }
}

function analyzeVisibilityData(results: any[], promptSummary: any[], org: any) {
  const lowVisibilityPrompts: any[] = [];
  const noMentionPrompts: any[] = [];
  const competitorMentions: Record<string, { count: number, citations: string[], prompts: any[] }> = {};
  const allCitations: string[] = [];
  let totalScore = 0;
  let scoreCount = 0;

  // Group results by prompt for better analysis
  const promptGroups = new Map();

  for (const result of results) {
    const promptId = result.prompt_runs.prompt_id;
    const promptText = result.prompt_runs.prompts.text;
    const score = result.score || 0;
    const orgPresent = result.org_brand_present;
    const prominence = result.org_brand_prominence;
    const citations = result.prompt_runs.citations || [];
    
    totalScore += score;
    scoreCount++;

    if (!promptGroups.has(promptId)) {
      promptGroups.set(promptId, {
        id: promptId,
        text: promptText,
        scores: [],
        citations: [],
        orgMentions: 0,
        totalRuns: 0,
        competitors: new Set(),
        runIds: []
      });
    }

    const group = promptGroups.get(promptId);
    group.scores.push(score);
    group.totalRuns++;
    group.runIds.push(result.prompt_runs.id);

    if (orgPresent) {
      group.orgMentions++;
    }

    // Collect citations
    for (const citation of citations) {
      if (citation.type === 'url' && citation.value) {
        allCitations.push(citation.value);
        group.citations.push(citation);
      }
    }

    // Track competitor mentions
    const brands = result.brands_json || [];
    for (const brand of brands) {
      if (typeof brand === 'string' && brand.length > 1) {
        const normalized = brand.toLowerCase().trim();
        
        // Skip if it's the org's brand
        if (org?.name && normalized.includes(org.name.toLowerCase())) {
          continue;
        }
        
        // Skip generic terms
        const excludeTerms = ['openai', 'claude', 'copilot', 'google', 'chatgpt', 'ai', 'artificial intelligence', 'microsoft'];
        if (excludeTerms.some(term => normalized.includes(term))) {
          continue;
        }

        if (!competitorMentions[brand]) {
          competitorMentions[brand] = { count: 0, citations: [], prompts: [] };
        }
        competitorMentions[brand].count++;
        group.competitors.add(brand);

        // Add citations for this competitor
        for (const citation of citations) {
          if (citation.type === 'url' && citation.value) {
            competitorMentions[brand].citations.push(citation.value);
          }
        }
        
        // Track which prompts this competitor appears in
        if (!competitorMentions[brand].prompts.find(p => p.id === promptId)) {
          competitorMentions[brand].prompts.push({
            id: promptId,
            text: promptText,
            score: score
          });
        }
      }
    }
  }

  // Analyze prompt groups
  for (const [promptId, group] of promptGroups) {
    const avgScore = group.scores.reduce((sum, s) => sum + s, 0) / group.scores.length;
    const orgMentionRate = group.orgMentions / group.totalRuns;

    const promptData = {
      id: promptId,
      text: group.text,
      avgScore,
      orgMentionRate,
      totalRuns: group.totalRuns,
      citations: [...new Set(group.citations)], // Remove duplicates
      competitors: Array.from(group.competitors),
      runIds: group.runIds
    };

    if (orgMentionRate === 0) {
      noMentionPrompts.push(promptData);
    } else if (avgScore < getScoreThresholds().fair) {
      lowVisibilityPrompts.push(promptData);
    }
  }

  // Get top competitors
  const topCompetitors = Object.entries(competitorMentions)
    .sort(([,a], [,b]) => b.count - a.count)
    .slice(0, 5);

  return {
    lowVisibilityPrompts: lowVisibilityPrompts.slice(0, 8),
    noMentionPrompts: noMentionPrompts.slice(0, 8),
    topCompetitors,
    allCitations: [...new Set(allCitations)],
    avgScore: scoreCount > 0 ? totalScore / scoreCount : 0,
    organizationContext: org
  };
}

function generateDetailedRecommendations(analysis: any, org: any, orgId: string) {
  const recommendations = [];

  // 1. Content Hub Strategy for No-Mention Prompts
  if (analysis.noMentionPrompts.length > 0) {
    const topPrompts = analysis.noMentionPrompts.slice(0, 5);
    const relatedCitations = topPrompts.flatMap(p => p.citations).slice(0, 8);
    const promptTexts = topPrompts.map(p => p.text);

    // Generate topic-specific content hub recommendation
    const mainTopic = extractMainTopic(promptTexts);
    
    recommendations.push({
      org_id: orgId,
      type: 'content',
      title: `Develop a comprehensive ${mainTopic} content hub featuring ${org.name} expertise`,
      rationale: `${org.name} is not being mentioned in ${analysis.noMentionPrompts.length} high-value search queries. A centralized content hub will establish thought leadership and capture this untapped visibility opportunity. Current competitors are dominating these conversations through authoritative content.`,
      status: 'open',
      metadata: {
        steps: [
          `Create a pillar page on ${org.business_description ? org.business_description.split(',')[0] : 'your domain'} that comprehensively addresses ${mainTopic}`,
          `Develop 8-12 supporting blog posts covering specific aspects of ${mainTopic}`,
          "Embed interactive tools like calculators, templates, or assessments",
          "Include customer success stories and case studies specific to this topic",
          "Create downloadable resources (guides, checklists, templates)",
          `Optimize for semantic search with FAQ sections addressing "${topPrompts[0].text}" and related queries`,
          "Implement internal linking strategy to boost page authority",
          "Launch targeted social media campaign to amplify the hub content"
        ],
        estLift: 0.18,
        sourcePromptIds: topPrompts.map(p => p.id),
        sourceRunIds: topPrompts.flatMap(p => p.runIds),
        citations: relatedCitations.map(c => ({ type: 'url', value: c.value })),
        impact: 'high',
        category: 'content_hub',
        relatedQueries: promptTexts
      }
    });
  }

  // 2. Competitive Analysis and Differentiation
  if (analysis.topCompetitors.length > 0) {
    const primaryCompetitor = analysis.topCompetitors[0];
    const competitorName = primaryCompetitor[0];
    const competitorData = primaryCompetitor[1];
    const competitorCitations = competitorData.citations.slice(0, 6);

    recommendations.push({
      org_id: orgId,
      type: 'content',
      title: `Create "${org.name} vs ${competitorName}" competitive analysis featuring hands-on comparison`,
      rationale: `${competitorName} appears in ${competitorData.count} queries where ${org.name} could be competitive. This represents a significant market share opportunity. Analysis shows ${competitorName} is being cited by authoritative sources, indicating strong content marketing presence.`,
      status: 'open',
      metadata: {
        steps: [
          `Research ${competitorName}'s content strategy and key messaging across cited sources`,
          `Create detailed feature-by-feature comparison highlighting ${org.name}'s advantages`,
          "Develop use-case scenarios where your solution outperforms the competitor",
          `Include pricing comparison and ROI analysis for ${org.name} vs ${competitorName}`,
          "Add customer testimonials from users who switched from the competitor",
          "Create interactive comparison tool for prospects to evaluate both options",
          `Optimize for comparison keywords like "${org.name} vs ${competitorName}" and "${competitorName} alternative"`,
          "Launch targeted ad campaign for competitor brand terms"
        ],
        estLift: 0.15,
        sourcePromptIds: competitorData.prompts.slice(0, 5).map(p => p.id),
        sourceRunIds: [],
        citations: competitorCitations.map(url => ({ type: 'url', value: url })),
        impact: 'high',
        category: 'competitive_analysis',
        targetCompetitor: competitorName,
        competitorMentions: competitorData.count
      }
    });
  }

  // 3. Visibility Optimization for Low-Performing Prompts
  if (analysis.lowVisibilityPrompts.length > 0) {
    const lowPrompts = analysis.lowVisibilityPrompts.slice(0, 6);
    const avgScore = lowPrompts.reduce((sum, p) => sum + p.avgScore, 0) / lowPrompts.length;
    const citations = lowPrompts.flatMap(p => p.citations).slice(0, 10);

    recommendations.push({
      org_id: orgId,
      type: 'site',
      title: `Implement AI-first SEO optimization strategy to improve ${org.name} prominence in search responses`,
      rationale: `${org.name} appears in responses but with low prominence (average score: ${avgScore.toFixed(1)}/10). This indicates content exists but lacks the authority signals that AI models prioritize. Competitors are outranking through better content structure and authority.`,
      status: 'open',
      metadata: {
        steps: [
          "Audit current content for E-A-T (Expertise, Authority, Trust) signals",
          "Add structured data markup to improve AI content understanding",
          "Create comprehensive FAQ sections addressing exact user queries",
          "Implement topic clustering with strong internal linking",
          "Optimize existing content with semantic keywords and entities",
          "Add author bios and expertise credentials to build authority",
          "Create linkable assets to earn high-quality backlinks",
          "Monitor and optimize for featured snippet opportunities",
          "Track AI response mentions and optimize based on patterns"
        ],
        estLift: 0.22,
        sourcePromptIds: lowPrompts.map(p => p.id),
        sourceRunIds: lowPrompts.flatMap(p => p.runIds),
        citations: citations.map(c => ({ type: 'url', value: c.value })),
        impact: 'high',
        category: 'visibility_optimization',
        currentAvgScore: avgScore,
        targetQueries: lowPrompts.map(p => p.text)
      }
    });
  }

  return recommendations;
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