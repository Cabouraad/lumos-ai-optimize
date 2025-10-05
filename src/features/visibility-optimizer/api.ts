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
  // Call the correct edge function (generate-optimizations, not generate-visibility-optimizations)
  const { data, error } = await supabase.functions.invoke('generate-optimizations', {
    body: {
      promptId: promptData.id,
      batch: false,
      category: promptData.visibility_percentage < 50 ? 'low_visibility' : 'general'
    }
  });

  if (error) {
    console.error('Error calling generate-optimizations:', error);
    throw error;
  }
  
  // Transform the response to match our expected format
  const optimizations = (data?.optimizations || []).map((opt: any) => ({
    id: crypto.randomUUID(),
    type: opt.content_type || 'social_post',
    title: opt.title || 'Optimization',
    description: opt.body || '',
    content_specifications: opt.implementation_details || {},
    distribution_strategy: opt.resources || [],
    impact_assessment: opt.success_metrics || {},
    implementation_plan: {
      steps: opt.implementation_details?.steps || [],
      timeline: opt.timeline_weeks || 4,
      difficulty: opt.difficulty_level || 'medium'
    },
    content_strategy: opt.reddit_strategy || {},
    priority_score: opt.impact_score || 50,
    status: 'pending' as const,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }));

  return { optimizations };
}

export async function getVisibilityAnalysis(orgId: string): Promise<VisibilityAnalysis> {
  const promptVisibilityData = await analyzePromptVisibility(orgId);
  
  const { count: totalPrompts } = await supabase
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
    total_prompts: totalPrompts || 0,
    prompts_under_100_visibility: promptsUnder100,
    average_visibility: Math.round(averageVisibility * 10) / 10,
    biggest_gaps: biggestGaps,
    competitor_dominance: competitorDominance,
    content_opportunities: contentOpportunities
  };
}

export async function saveOptimization(optimization: Omit<ContentOptimization, 'id' | 'created_at'>): Promise<string> {
  // For now, we'll create a mock implementation since the edge function doesn't exist yet
  // In the future, this would call the database to save the optimization
  const mockId = `opt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  return mockId;
}

export async function getOptimizationsForPrompt(promptId: string): Promise<ContentOptimization[]> {
  // Mock implementation - in the future this would query the database
  return [];
}

export async function getOptimizationsForOrg(orgId: string): Promise<ContentOptimization[]> {
  const { data, error } = await supabase
    .from('ai_visibility_recommendations')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) throw error;

  // Map database fields to ContentOptimization format
  return (data || []).map(rec => ({
    id: rec.id,
    prompt_id: rec.prompt_id,
    type: (rec.channel === 'blog_post' ? 'blog_post' : 
           rec.channel === 'social_media' ? 'social_post' : 
           'community_answer') as ContentOptimization['type'],
    title: rec.title,
    description: rec.posting_instructions || rec.subtype || '',
    priority_score: rec.score_before ? Math.round(100 - (rec.score_before * 10)) : 50,
    difficulty_level: determineDifficulty(rec.channel),
    created_at: rec.created_at,
    content_specifications: {
      word_count: 1500,
      key_sections: (rec.outline as any)?.sections || [],
      required_keywords: (rec.must_include as string[]) || [],
      target_audience: 'Marketing professionals',
      tone: 'Professional and actionable'
    },
    distribution: {
      primary_channel: (rec.where_to_publish as any)?.[0] || 'Company blog',
      additional_channels: ((rec.where_to_publish as any[]) || []).slice(1),
      posting_schedule: 'As soon as ready',
      optimal_timing: 'Weekday morning'
    },
    implementation: {
      research_hours: 4,
      writing_hours: 6,
      review_hours: 2,
      total_timeline_days: 5,
      required_resources: ['Content writer', 'Subject matter expert'],
      content_brief: rec.posting_instructions || 'Follow outlined strategy'
    },
    impact_assessment: {
      estimated_visibility_increase: 20,
      target_prompts: [rec.prompt_id],
      confidence_level: 'medium',
      expected_timeline_weeks: 4,
      success_metrics: (rec.success_metrics as string[]) || []
    },
    content_strategy: {
      main_angle: rec.subtype || 'Thought leadership',
      unique_value_proposition: 'Direct response to AI query patterns',
      competitor_differentiation: 'Focus on specific use cases',
      supporting_data_points: []
    }
  }));
}

function determineDifficulty(channel: string): 'easy' | 'medium' | 'hard' {
  if (channel === 'social_media' || channel === 'reddit') return 'easy';
  if (channel === 'blog_post') return 'medium';
  return 'medium';
}