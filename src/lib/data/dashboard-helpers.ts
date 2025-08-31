/**
 * Helper functions for processing unified dashboard data
 * Extracted to reduce complexity and improve testability
 */

import { supabase } from "@/integrations/supabase/client";
import { UnifiedDashboardData, ProviderResponseData } from "./unified-fetcher";

export async function getProviders() {
  const { data: providers } = await supabase
    .from("llm_providers")  
    .select("id, name, enabled");
  return providers || [];
}

export function processUnifiedData(
  prompts: any[],
  validResponses: any[],
  responsesByPrompt: Map<string, any[]>,
  statsByPrompt: Map<string, any>
): UnifiedDashboardData {
  // Calculate all metrics in one pass
  const now = new Date();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

  // Last 7 days scores for avgScore
  const last7DaysForAvg = validResponses.filter(r => new Date(r.run_at) >= sevenDaysAgo);
  const avgScoreValues = last7DaysForAvg.map(r => r.score);

  const avgScore = avgScoreValues.length > 0 
    ? avgScoreValues.reduce((sum, s) => sum + s, 0) / avgScoreValues.length 
    : 0;

  // Last 7 days for overallScore
  const last7DaysResponses = validResponses.filter(r => new Date(r.run_at) >= sevenDaysAgo);
  const last7DaysScores = last7DaysResponses.map(r => r.score);
  
  const overallScore = last7DaysScores.length > 0
    ? last7DaysScores.reduce((sum, s) => sum + s, 0) / last7DaysScores.length
    : 0;

  // Previous 7 days for trend calculation
  const prev7DaysScores = validResponses
    .filter(r => {
      const date = new Date(r.run_at);
      return date >= fourteenDaysAgo && date < sevenDaysAgo;
    })
    .map(r => r.score);

  const prevAvg = prev7DaysScores.length > 0
    ? prev7DaysScores.reduce((sum, s) => sum + s, 0) / prev7DaysScores.length
    : 0;

  const trend = prevAvg > 0 ? ((overallScore - prevAvg) / prevAvg) * 100 : 0;

  // Chart data - group by day
  const dailyScores = new Map<string, number[]>();
  validResponses.forEach(response => {
    const date = response.run_at.split('T')[0];
    if (!dailyScores.has(date)) {
      dailyScores.set(date, []);
    }
    dailyScores.get(date)!.push(response.score);
  });

  const chartData = Array.from(dailyScores.entries())
    .map(([date, scores]) => ({
      date,
      score: Math.round((scores.reduce((sum, s) => sum + s, 0) / scores.length) * 10) / 10,
      runs: scores.length
    }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Process prompt summaries using pre-grouped data (O(1) lookup)
  const promptSummaries = prompts.map(prompt => {
    const promptResponsesFromValidSet = validResponses.filter(r => r.prompt_id === prompt.id);
    const sevenDayResponses = promptResponsesFromValidSet.filter(
      r => new Date(r.run_at) >= sevenDaysAgo
    );
    
    const latestScore = promptResponsesFromValidSet.length > 0 
      ? promptResponsesFromValidSet[promptResponsesFromValidSet.length - 1].score 
      : 0;

    // Use pre-grouped latest responses (O(1) lookup)
    const promptLatestResponses = responsesByPrompt.get(prompt.id) || [];
    const latestResponsesByProvider = getLatestResponsePerProvider(promptLatestResponses);
    const latestResponseValues = Object.values(latestResponsesByProvider);

    // Calculate metrics from latest responses
    const brandVisibleCount = latestResponseValues.filter((r: any) => r.org_brand_present).length;
    const competitorCount = latestResponseValues.reduce((sum: number, r: any) => sum + (r.competitors_count || 0), 0);
    const brandPresenceRate = latestResponseValues.length > 0 
      ? (brandVisibleCount / latestResponseValues.length) * 100 
      : 0;

    // Use pre-grouped stats (O(1) lookup)
    const promptStats = statsByPrompt.get(prompt.id);

    return {
      id: prompt.id,
      text: prompt.text,
      active: prompt.active,
      created_at: prompt.created_at,
      latestScore: Math.round(latestScore * 10) / 10,
      hasData: promptResponsesFromValidSet.length > 0,
      org_id: prompt.org_id,
      runs7d: promptStats?.runs_7d || sevenDayResponses.length,
      avgScore7d: promptStats?.avg_score_7d || (sevenDayResponses.length > 0
        ? sevenDayResponses.reduce((sum, r) => sum + r.score, 0) / sevenDayResponses.length
        : 0),
      brandVisibleCount,
      competitorCount,
      brandPresenceRate: Math.round(brandPresenceRate * 10) / 10,
      latestResponses: latestResponsesByProvider
    };
  });

  return {
    avgScore: Math.round(avgScore * 10) / 10,
    overallScore: Math.round(overallScore * 10) / 10,
    trend: Math.round(trend * 10) / 10,
    promptCount: prompts.length,
    totalRuns: validResponses.length,
    recentRunsCount: last7DaysResponses.length,
    chartData,
    providers: await getProviders(),
    prompts: promptSummaries
  };
}

// Helper function to get latest response per provider
function getLatestResponsePerProvider(responses: any[]) {
  const byProvider: { [provider: string]: any } = {};
  responses.forEach(response => {
    if (!byProvider[response.provider] || 
        new Date(response.run_at) > new Date(byProvider[response.provider].run_at)) {
      byProvider[response.provider] = response;
    }
  });
  return byProvider;
}