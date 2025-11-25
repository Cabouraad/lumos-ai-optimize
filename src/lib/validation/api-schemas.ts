/**
 * Zod schemas for API response validation
 * Provides runtime type checking for critical API responses
 */

import { z } from 'zod';

// Dashboard Metrics Schema
export const DashboardMetricsSchema = z.object({
  totalPrompts: z.number().int().nonnegative(),
  avgVisibility: z.number().min(0).max(100),
  promptsRun: z.number().int().nonnegative(),
  citationsTracked: z.number().int().nonnegative().optional(),
  weekOverWeekChange: z.number().optional(),
});

// Citation Data Schema
export const CitationDataSchema = z.object({
  url: z.string().url(),
  title: z.string().optional(),
  domain: z.string().optional(),
  snippet: z.string().optional(),
  position: z.number().int().positive().optional(),
});

// Dashboard Response Schema
export const DashboardResponseSchema = z.object({
  id: z.string().uuid(),
  prompt_id: z.string().uuid(),
  provider: z.string(),
  model: z.string().nullable(),
  status: z.enum(['success', 'completed', 'failed', 'pending']),
  org_brand_present: z.boolean(),
  org_brand_prominence: z.number().min(0).max(100).nullable(),
  score: z.number().min(0).max(100),
  run_at: z.string(),
  created_at: z.string(),
  brands_json: z.union([z.array(z.string()), z.record(z.string(), z.any())]),
  competitors_json: z.union([z.array(z.string()), z.record(z.string(), z.any())]),
  citations_json: z.array(CitationDataSchema).nullable().optional(),
  raw_ai_response: z.string().nullable().optional(),
  error: z.string().nullable().optional(),
});

// Prompt Data Schema
export const PromptDataSchema = z.object({
  id: z.string().uuid(),
  text: z.string().min(1),
  org_id: z.string().uuid(),
  brand_id: z.string().uuid().nullable(),
  active: z.boolean(),
  created_at: z.string(),
  cluster_tag: z.string().nullable().optional(),
});

// Chart Data Point Schema
export const ChartDataPointSchema = z.object({
  date: z.string(),
  score: z.number().min(0).max(100),
  orgPresence: z.number().min(0).max(100).optional(),
}).catchall(z.number()); // Allow competitor0, competitor1, etc.

// Competitor Data Schema
export const CompetitorDataSchema = z.object({
  competitor_name: z.string().min(1),
  total_appearances: z.number().int().nonnegative(),
  average_score: z.number().min(0).max(100),
  first_detected_at: z.string(),
  last_seen_at: z.string(),
  competitor_strength: z.enum(['strong', 'moderate', 'weak']).optional(),
  recently_active: z.boolean().optional(),
});

// Dashboard Data Schema (main response)
export const DashboardDataSchema = z.object({
  success: z.boolean(),
  metrics: DashboardMetricsSchema,
  prompts: z.array(PromptDataSchema),
  responses: z.array(DashboardResponseSchema),
  chartData: z.array(ChartDataPointSchema),
  noOrg: z.boolean().optional(),
  error: z.string().optional(),
});

// Optimization Data Schema
export const OptimizationDataSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  description: z.string(),
  content_type: z.string(),
  priority_score: z.number().min(0).max(100),
  difficulty_level: z.enum(['easy', 'medium', 'hard']),
  status: z.enum(['pending', 'in_progress', 'completed', 'dismissed']),
  created_at: z.string(),
  updated_at: z.string(),
  org_id: z.string().uuid(),
  prompt_id: z.string().uuid().nullable().optional(),
  brand_id: z.string().uuid().nullable().optional(),
});

// Weekly Report Schema
export const WeeklyReportSchema = z.object({
  id: z.string().uuid(),
  org_id: z.string().uuid(),
  week_key: z.string(),
  period_start: z.string(),
  period_end: z.string(),
  storage_path: z.string(),
  byte_size: z.number().int().nonnegative().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

/**
 * Safe parse with fallback
 */
export function safeParseWithFallback<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  fallback: T
): T {
  const result = schema.safeParse(data);
  
  if (!result.success) {
    console.warn('[API Validation] Parse failed:', result.error.format());
    return fallback;
  }
  
  return result.data;
}

/**
 * Validate with error logging
 */
export function validateApiResponse<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  context: string
): T | null {
  const result = schema.safeParse(data);
  
  if (!result.success) {
    console.error(`[API Validation] ${context} failed:`, result.error.format());
    return null;
  }
  
  return result.data;
}
