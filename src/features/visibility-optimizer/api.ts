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
  return data || { optimizations: [] };
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
  // Mock implementation - in the future this would query the database
  // For now, return some sample data to demonstrate the UI
  const mockOptimizations: ContentOptimization[] = [
    {
      id: 'opt_1',
      prompt_id: 'prompt_1',
      type: 'blog_post',
      title: 'Complete Guide to AI-Powered Marketing Analytics',
      description: 'Create a comprehensive blog post that positions your brand as the leading solution for AI marketing analytics, targeting the specific prompt about marketing measurement.',
      content_specifications: {
        word_count: 2500,
        key_sections: [
          'Introduction to AI Marketing Analytics',
          'Key Metrics and KPIs',
          'Implementation Strategies',
          'Case Studies and Results',
          'Future Trends'
        ],
        required_keywords: ['AI marketing', 'analytics', 'measurement', 'ROI', 'attribution'],
        target_audience: 'Marketing directors and CMOs',
        tone: 'Professional and authoritative'
      },
      distribution: {
        primary_channel: 'Company blog',
        additional_channels: ['LinkedIn', 'Medium', 'Industry newsletters'],
        posting_schedule: 'Publish Tuesday 9am EST',
        optimal_timing: 'Tuesday morning for maximum B2B engagement'
      },
      implementation: {
        research_hours: 8,
        writing_hours: 12,
        review_hours: 4,
        total_timeline_days: 7,
        required_resources: ['Content writer', 'Marketing analytics expert', 'SEO specialist'],
        content_brief: 'Focus on practical implementation with real-world examples. Include original research or data where possible. Ensure the content directly addresses the pain points mentioned in the target prompt.'
      },
      impact_assessment: {
        estimated_visibility_increase: 25,
        target_prompts: ['prompt_1'],
        confidence_level: 'high',
        expected_timeline_weeks: 4,
        success_metrics: [
          'Increase in branded search traffic',
          'Higher ranking for target keywords',
          'Improved AI model citations',
          'Lead generation from content'
        ]
      },
      content_strategy: {
        main_angle: 'Authority-building thought leadership',
        unique_value_proposition: 'Only platform combining real-time AI insights with predictive analytics',
        competitor_differentiation: 'Focus on implementation ease vs competitor complexity',
        supporting_data_points: [
          'Customer success metrics',
          'Industry benchmarks',
          'Original research findings'
        ]
      },
      priority_score: 85,
      difficulty_level: 'medium',
      created_at: new Date().toISOString()
    },
    {
      id: 'opt_2',
      prompt_id: 'prompt_2',
      type: 'case_study',
      title: 'How [Company X] Increased ROI by 340% with AI Marketing',
      description: 'Detailed case study showcasing measurable results achieved through AI marketing implementation, perfect for addressing customer success queries.',
      content_specifications: {
        word_count: 1800,
        key_sections: [
          'Challenge Overview',
          'Solution Implementation',
          'Results and Metrics',
          'Key Takeaways'
        ],
        required_keywords: ['ROI improvement', 'AI marketing results', 'customer success'],
        target_audience: 'Potential customers and decision makers',
        tone: 'Results-focused and credible'
      },
      distribution: {
        primary_channel: 'Website case studies section',
        additional_channels: ['Sales collateral', 'LinkedIn', 'Email campaigns'],
        posting_schedule: 'Immediate after completion',
        optimal_timing: 'Weekday morning for professional audience'
      },
      implementation: {
        research_hours: 6,
        writing_hours: 8,
        review_hours: 3,
        total_timeline_days: 5,
        required_resources: ['Case study writer', 'Customer success manager', 'Data analyst'],
        content_brief: 'Work directly with the customer to gather authentic data and quotes. Focus on specific, measurable outcomes that can be verified.'
      },
      impact_assessment: {
        estimated_visibility_increase: 35,
        target_prompts: ['prompt_2'],
        confidence_level: 'high',
        expected_timeline_weeks: 2,
        success_metrics: [
          'Increased case study page views',
          'Higher conversion rates',
          'More qualified leads',
          'Improved close rates'
        ]
      },
      content_strategy: {
        main_angle: 'Proof of concept through customer success',
        unique_value_proposition: 'Demonstrable ROI with specific metrics',
        competitor_differentiation: 'Real customer data vs theoretical benefits',
        supporting_data_points: [
          '340% ROI increase',
          'Implementation timeline',
          'Specific tool usage metrics'
        ]
      },
      priority_score: 92,
      difficulty_level: 'easy',
      created_at: new Date().toISOString()
    }
  ];

  return mockOptimizations;
}