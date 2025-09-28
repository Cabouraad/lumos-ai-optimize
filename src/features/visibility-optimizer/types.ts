/**
 * Complete overhaul of optimization system
 * Focus on specific, actionable recommendations for prompts under 100% visibility
 */

export interface PromptVisibilityData {
  id: string;
  text: string;
  visibility_percentage: number;
  provider_breakdown: {
    [provider: string]: {
      visible: boolean;
      score: number;
      position?: number;
      competitors: string[];
    };
  };
  total_runs_7d: number;
  avg_score_7d: number;
  key_competitors: string[];
  citation_sources: Array<{
    domain: string;
    title?: string;
    url: string;
    frequency: number;
  }>;
}

export interface ContentOptimization {
  id: string;
  prompt_id: string;
  type: 'blog_post' | 'social_post' | 'video_content' | 'press_release' | 'case_study' | 'whitepaper' | 'podcast_appearance' | 'community_answer';
  title: string;
  description: string;
  
  // Specific implementation details
  content_specifications: {
    word_count: number;
    key_sections: string[];
    required_keywords: string[];
    target_audience: string;
    tone: string;
  };
  
  // Distribution strategy
  distribution: {
    primary_channel: string;
    additional_channels: string[];
    posting_schedule: string;
    optimal_timing: string;
  };
  
  // Implementation details
  implementation: {
    research_hours: number;
    writing_hours: number;
    review_hours: number;
    total_timeline_days: number;
    required_resources: string[];
    content_brief: string;
  };
  
  // Impact estimation
  impact_assessment: {
    estimated_visibility_increase: number; // percentage points
    target_prompts: string[]; // prompt IDs this will help with
    confidence_level: 'low' | 'medium' | 'high';
    expected_timeline_weeks: number;
    success_metrics: string[];
  };
  
  // Content strategy
  content_strategy: {
    main_angle: string;
    unique_value_proposition: string;
    competitor_differentiation: string;
    supporting_data_points: string[];
  };
  
  priority_score: number; // 1-100
  difficulty_level: 'easy' | 'medium' | 'hard';
  created_at: string;
}

export interface VisibilityAnalysis {
  org_id: string;
  total_prompts: number;
  prompts_under_100_visibility: number;
  average_visibility: number;
  biggest_gaps: Array<{
    prompt_id: string;
    prompt_text: string;
    visibility_gap: number;
    missed_opportunities: string[];
  }>;
  competitor_dominance: Array<{
    competitor: string;
    dominance_score: number;
    prompts_affected: string[];
  }>;
  content_opportunities: Array<{
    content_type: string;
    potential_impact: number;
    affected_prompts: number;
  }>;
}