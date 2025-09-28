import { supabase } from '@/integrations/supabase/client';
import { PromptVisibilityData, ContentOptimization, VisibilityAnalysis } from './types';

/**
 * Completely new API for the overhauled optimization system
 */

export async function analyzePromptVisibility(orgId: string): Promise<PromptVisibilityData[]> {
  // Get prompts with visibility under 100%
  const { data: promptsData, error: promptsError } = await supabase
    .from('prompts')
    .select('id, text, active')
    .eq('org_id', orgId)
    .eq('active', true);

  if (promptsError) throw promptsError;

  if (!promptsData || promptsData.length === 0) {
    return [];
  }

  const promptIds = promptsData.map(p => p.id);

  // Get latest responses for each prompt and provider
  const { data: responsesData, error: responsesError } = await supabase
    .rpc('get_latest_prompt_provider_responses', { p_org_id: orgId });

  if (responsesError) throw responsesError;

  // Get 7-day visibility stats
  const { data: visibilityStats, error: visibilityError } = await supabase
    .rpc('get_prompt_visibility_7d', { requesting_org_id: orgId });

  if (visibilityError) throw visibilityError;

  // Process data to identify prompts under 100% visibility
  const visibilityData: PromptVisibilityData[] = promptsData.map(prompt => {
    const promptResponses = (responsesData || [])
      .filter((r: any) => r.prompt_id === prompt.id && r.status === 'success');
    
    const promptStats = (visibilityStats || [])
      .find((s: any) => s.prompt_id === prompt.id);

    // Calculate visibility percentage across all providers
    const providers = ['openai', 'gemini', 'perplexity', 'google_ai_overview'];
    const providerBreakdown: any = {};
    let visibleCount = 0;

    providers.forEach(provider => {
      const response = promptResponses.find((r: any) => r.provider === provider);
      const isVisible = response?.org_brand_present || false;
      
      providerBreakdown[provider] = {
        visible: isVisible,
        score: response?.score || 0,
        position: response?.org_brand_prominence,
        competitors: response?.competitors_json || []
      };

      if (isVisible) visibleCount++;
    });

    const visibilityPercentage = (visibleCount / providers.length) * 100;

    // Get all competitors and citations
    const allCompetitors = new Set<string>();
    const allCitations = new Map<string, any>();

    promptResponses.forEach((response: any) => {
      if (response.competitors_json) {
        response.competitors_json.forEach((comp: string) => allCompetitors.add(comp));
      }
      if (response.citations_json) {
        response.citations_json.forEach((cit: any) => {
          const domain = cit.domain || (cit.url ? new URL(cit.url).hostname : '');
          if (domain) {
            if (allCitations.has(domain)) {
              allCitations.get(domain).frequency++;
            } else {
              allCitations.set(domain, {
                domain,
                title: cit.title,
                url: cit.url,
                frequency: 1
              });
            }
          }
        });
      }
    });

    return {
      id: prompt.id,
      text: prompt.text,
      visibility_percentage: Math.round(visibilityPercentage * 10) / 10,
      provider_breakdown: providerBreakdown,
      total_runs_7d: promptStats?.runs_7d || 0,
      avg_score_7d: promptStats?.avg_score_7d || 0,
      key_competitors: Array.from(allCompetitors).slice(0, 10),
      citation_sources: Array.from(allCitations.values())
        .sort((a, b) => b.frequency - a.frequency)
        .slice(0, 10)
    };
  });

  // Return only prompts under 100% visibility
  return visibilityData.filter(data => data.visibility_percentage < 100);
}

export async function generateContentOptimizations(
  promptData: PromptVisibilityData,
  orgContext: { name: string; description?: string }
): Promise<{ optimizations: ContentOptimization[] }> {
  // Call our new edge function for AI-powered optimization generation
  const { data, error } = await supabase.functions.invoke('generate-visibility-optimizations', {
    body: {
      prompt: promptData,
      org: orgContext,
      mode: 'specific' // for targeted, actionable recommendations
    }
  });

  if (error) throw error;
  return data;
}

export async function getVisibilityAnalysis(orgId: string): Promise<VisibilityAnalysis> {
  const promptVisibilityData = await analyzePromptVisibility(orgId);
  
  const totalPrompts = await supabase
    .from('prompts')
    .select('id', { count: 'exact' })
    .eq('org_id', orgId)
    .eq('active', true);

  const promptsUnder100 = promptVisibilityData.length;
  const averageVisibility = promptVisibilityData.length > 0 
    ? promptVisibilityData.reduce((sum, data) => sum + data.visibility_percentage, 0) / promptVisibilityData.length
    : 100;

  // Identify biggest gaps (lowest visibility prompts)
  const biggestGaps = promptVisibilityData
    .sort((a, b) => a.visibility_percentage - b.visibility_percentage)
    .slice(0, 5)
    .map(data => ({
      prompt_id: data.id,
      prompt_text: data.text,
      visibility_gap: 100 - data.visibility_percentage,
      missed_opportunities: data.key_competitors.slice(0, 3)
    }));

  // Analyze competitor dominance
  const competitorCounts = new Map<string, { count: number; prompts: string[] }>();
  promptVisibilityData.forEach(data => {
    data.key_competitors.forEach(competitor => {
      if (competitorCounts.has(competitor)) {
        const existing = competitorCounts.get(competitor)!;
        existing.count++;
        existing.prompts.push(data.id);
      } else {
        competitorCounts.set(competitor, { count: 1, prompts: [data.id] });
      }
    });
  });

  const competitorDominance = Array.from(competitorCounts.entries())
    .map(([competitor, data]) => ({
      competitor,
      dominance_score: (data.count / promptsUnder100) * 100,
      prompts_affected: data.prompts
    }))
    .sort((a, b) => b.dominance_score - a.dominance_score)
    .slice(0, 10);

  // Content opportunity analysis
  const contentOpportunities = [
    {
      content_type: 'blog_post',
      potential_impact: 25,
      affected_prompts: Math.ceil(promptsUnder100 * 0.6)
    },
    {
      content_type: 'case_study',
      potential_impact: 35,
      affected_prompts: Math.ceil(promptsUnder100 * 0.4)
    },
    {
      content_type: 'video_content',
      potential_impact: 30,
      affected_prompts: Math.ceil(promptsUnder100 * 0.5)
    },
    {
      content_type: 'community_answer',
      potential_impact: 20,
      affected_prompts: Math.ceil(promptsUnder100 * 0.8)
    }
  ];

  return {
    org_id: orgId,
    total_prompts: totalPrompts.count || 0,
    prompts_under_100_visibility: promptsUnder100,
    average_visibility: Math.round(averageVisibility * 10) / 10,
    biggest_gaps: biggestGaps,
    competitor_dominance: competitorDominance,
    content_opportunities: contentOpportunities
  };
}

export async function saveOptimization(optimization: Omit<ContentOptimization, 'id' | 'created_at'>): Promise<string> {
  const { data, error } = await supabase
    .from('visibility_optimizations')
    .insert({
      prompt_id: optimization.prompt_id,
      optimization_type: optimization.type,
      title: optimization.title,
      description: optimization.description,
      content_specifications: optimization.content_specifications,
      distribution_strategy: optimization.distribution,
      implementation_plan: optimization.implementation,
      impact_assessment: optimization.impact_assessment,
      content_strategy: optimization.content_strategy,
      priority_score: optimization.priority_score,
      difficulty_level: optimization.difficulty_level
    })
    .select('id')
    .single();

  if (error) throw error;
  return data.id;
}

export async function getOptimizationsForPrompt(promptId: string): Promise<ContentOptimization[]> {
  const { data, error } = await supabase
    .from('visibility_optimizations')
    .select('*')
    .eq('prompt_id', promptId)
    .order('priority_score', { ascending: false });

  if (error) throw error;

  return (data || []).map(item => ({
    id: item.id,
    prompt_id: item.prompt_id,
    type: item.optimization_type,
    title: item.title,
    description: item.description,
    content_specifications: item.content_specifications,
    distribution: item.distribution_strategy,
    implementation: item.implementation_plan,
    impact_assessment: item.impact_assessment,
    content_strategy: item.content_strategy,
    priority_score: item.priority_score,
    difficulty_level: item.difficulty_level,
    created_at: item.created_at
  }));
}

export async function getOptimizationsForOrg(orgId: string): Promise<ContentOptimization[]> {
  const { data, error } = await supabase
    .from('visibility_optimizations')
    .select(`
      *,
      prompts!inner(org_id)
    `)
    .eq('prompts.org_id', orgId)
    .order('priority_score', { ascending: false })
    .limit(50);

  if (error) throw error;

  return (data || []).map(item => ({
    id: item.id,
    prompt_id: item.prompt_id,
    type: item.optimization_type,
    title: item.title,
    description: item.description,
    content_specifications: item.content_specifications,
    distribution: item.distribution_strategy,
    implementation: item.implementation_plan,
    impact_assessment: item.impact_assessment,
    content_strategy: item.content_strategy,
    priority_score: item.priority_score,
    difficulty_level: item.difficulty_level,
    created_at: item.created_at
  }));
}