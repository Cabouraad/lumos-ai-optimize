/**
 * Type definitions for dashboard data structures
 * Provides type safety for dashboard metrics, charts, and API responses
 */

export interface DashboardMetrics {
  totalPrompts: number;
  avgVisibility: number;
  promptsRun: number;
  citationsTracked?: number;
  weekOverWeekChange?: number;
}

export interface DashboardResponse {
  id: string;
  prompt_id: string;
  provider: string;
  model: string | null;
  status: 'success' | 'completed' | 'failed' | 'pending';
  org_brand_present: boolean;
  org_brand_prominence: number | null;
  score: number;
  run_at: string;
  created_at: string;
  brands_json: string[] | Record<string, any>;
  competitors_json: string[] | Record<string, any>;
  citations_json?: CitationData[] | null;
  raw_ai_response?: string | null;
  error?: string | null;
}

export interface CitationData {
  url: string;
  title?: string;
  domain?: string;
  snippet?: string;
  position?: number;
}

export interface PromptData {
  id: string;
  text: string;
  org_id: string;
  brand_id: string | null;
  active: boolean;
  created_at: string;
  cluster_tag?: string | null;
}

export interface ChartDataPoint {
  date: string;
  score: number;
  orgPresence?: number;
  [key: `competitor${number}`]: number;
}

export interface CompetitorData {
  competitor_name: string;
  total_appearances: number;
  average_score: number;
  first_detected_at: string;
  last_seen_at: string;
  competitor_strength?: 'strong' | 'moderate' | 'weak';
  recently_active?: boolean;
}

export interface PresenceStats {
  rate: number;
  sparklineData: Array<{ value: number }>;
  totalCount: number;
  presenceCount: number;
  weekOverWeekChange?: number;
}

export interface DashboardData {
  success: boolean;
  metrics: DashboardMetrics;
  prompts: PromptData[];
  responses: DashboardResponse[];
  chartData: ChartDataPoint[];
  noOrg?: boolean;
  error?: string;
}

export interface OptimizationData {
  id: string;
  title: string;
  description: string;
  content_type: string;
  priority_score: number;
  difficulty_level: 'easy' | 'medium' | 'hard';
  status: 'pending' | 'in_progress' | 'completed' | 'dismissed';
  created_at: string;
  updated_at: string;
  org_id: string;
  prompt_id?: string | null;
  brand_id?: string | null;
}

export interface WeeklyReport {
  id: string;
  org_id: string;
  week_key: string;
  period_start: string;
  period_end: string;
  storage_path: string;
  byte_size: number | null;
  created_at: string;
  updated_at: string;
}
