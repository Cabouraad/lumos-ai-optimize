/**
 * Simplified data fetching for visibility results
 */

import { supabase } from '@/integrations/supabase/client';
import { getOrgId } from '@/lib/auth';

export interface VisibilityMetrics {
  avgScore: number;
  overallScore: number;
  trend: number;
  totalRuns: number;
  chartData: Array<{ date: string; score: number; runs: number }>;
}

export interface PromptWithVisibility {
  id: string;
  text: string;
  active: boolean;
  created_at: string;
  visibilityScore: number;
  brandPct: number;
  competitorPct: number;
  hasData: boolean;
}

/**
 * Get dashboard visibility metrics
 */
export async function getDashboardMetrics(): Promise<VisibilityMetrics> {
  try {
    const orgId = await getOrgId();

    // Get prompts for this org
    const { data: prompts } = await supabase
      .from('prompts')
      .select('id')
      .eq('org_id', orgId);

    const promptIds = (prompts || []).map(p => p.id);

    if (promptIds.length === 0) {
      return {
        avgScore: 0,
        overallScore: 0,
        trend: 0,
        totalRuns: 0,
        chartData: []
      };
    }

    // Get successful runs for these prompts (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    const { data: runs } = await supabase
      .from('prompt_runs')
      .select('id, run_at, prompt_id')
      .in('prompt_id', promptIds)
      .eq('status', 'success')
      .gte('run_at', thirtyDaysAgo.toISOString())
      .order('run_at', { ascending: true });

    if (!runs || runs.length === 0) {
      return {
        avgScore: 0,
        overallScore: 0,
        trend: 0,
        totalRuns: 0,
        chartData: []
      };
    }

    // Get visibility results for these runs
    const runIds = runs.map(r => r.id);
    const { data: results } = await supabase
      .from('visibility_results')
      .select('prompt_run_id, score')
      .in('prompt_run_id', runIds);

    const resultsByRun = new Map();
    (results || []).forEach(r => {
      resultsByRun.set(r.prompt_run_id, r.score);
    });

    // Calculate metrics
    const today = new Date().toISOString().split('T')[0];
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

    // Today's scores
    const todayScores = runs
      .filter(r => r.run_at.startsWith(today))
      .map(r => resultsByRun.get(r.id))
      .filter(s => typeof s === 'number');

    const avgScore = todayScores.length > 0 
      ? todayScores.reduce((sum, s) => sum + s, 0) / todayScores.length 
      : 0;

    // Last 7 days scores
    const last7DaysScores = runs
      .filter(r => new Date(r.run_at) >= sevenDaysAgo)
      .map(r => resultsByRun.get(r.id))
      .filter(s => typeof s === 'number');

    const overallScore = last7DaysScores.length > 0
      ? last7DaysScores.reduce((sum, s) => sum + s, 0) / last7DaysScores.length
      : 0;

    // Previous 7 days for trend
    const prev7DaysScores = runs
      .filter(r => {
        const date = new Date(r.run_at);
        return date >= fourteenDaysAgo && date < sevenDaysAgo;
      })
      .map(r => resultsByRun.get(r.id))
      .filter(s => typeof s === 'number');

    const prevAvg = prev7DaysScores.length > 0
      ? prev7DaysScores.reduce((sum, s) => sum + s, 0) / prev7DaysScores.length
      : 0;

    const trend = prevAvg > 0 ? ((overallScore - prevAvg) / prevAvg) * 100 : 0;

    // Chart data - group by day
    const dailyScores = new Map<string, number[]>();
    runs.forEach(run => {
      const score = resultsByRun.get(run.id);
      if (typeof score === 'number') {
        const date = run.run_at.split('T')[0];
        if (!dailyScores.has(date)) {
          dailyScores.set(date, []);
        }
        dailyScores.get(date)!.push(score);
      }
    });

    const chartData = Array.from(dailyScores.entries())
      .map(([date, scores]) => ({
        date,
        score: Math.round((scores.reduce((sum, s) => sum + s, 0) / scores.length) * 10) / 10,
        runs: scores.length
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return {
      avgScore: Math.round(avgScore * 10) / 10,
      overallScore: Math.round(overallScore * 10) / 10,
      trend: Math.round(trend * 10) / 10,
      totalRuns: runs.length,
      chartData
    };

  } catch (error) {
    console.error('Error getting dashboard metrics:', error);
    throw error;
  }
}

/**
 * Get prompts with their visibility data
 */
export async function getPromptsWithVisibility(): Promise<PromptWithVisibility[]> {
  try {
    const orgId = await getOrgId();

    // Get prompts
    const { data: prompts } = await supabase
      .from('prompts')
      .select('id, text, active, created_at')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });

    if (!prompts || prompts.length === 0) {
      return [];
    }

    // Get recent runs for these prompts
    const promptIds = prompts.map(p => p.id);
    const { data: runs } = await supabase
      .from('prompt_runs')
      .select('id, prompt_id')
      .in('prompt_id', promptIds)
      .eq('status', 'success')
      .order('run_at', { ascending: false })
      .limit(500); // Get recent runs

    // Get visibility results for these runs
    const runIds = (runs || []).map(r => r.id);
    let visibilityResults: any[] = [];
    
    if (runIds.length > 0) {
      const { data: results } = await supabase
        .from('visibility_results')
        .select('prompt_run_id, score, org_brand_present, competitors_count')
        .in('prompt_run_id', runIds);
      
      visibilityResults = results || [];
    }

    // Map results by run, then by prompt
    const resultsByRun = new Map();
    visibilityResults.forEach(r => {
      resultsByRun.set(r.prompt_run_id, r);
    });

    const resultsByPrompt = new Map<string, any[]>();
    (runs || []).forEach(run => {
      const result = resultsByRun.get(run.id);
      if (result) {
        if (!resultsByPrompt.has(run.prompt_id)) {
          resultsByPrompt.set(run.prompt_id, []);
        }
        resultsByPrompt.get(run.prompt_id)!.push(result);
      }
    });

    // Build prompt data with visibility metrics
    return prompts.map(prompt => {
      const promptResults = resultsByPrompt.get(prompt.id) || [];
      const hasData = promptResults.length > 0;

      let visibilityScore = 0;
      let brandPct = 0;
      let competitorPct = 0;

      if (hasData) {
        // Calculate averages
        const scores = promptResults.map(r => r.score);
        visibilityScore = scores.reduce((sum, s) => sum + s, 0) / scores.length;

        const brandPresentCount = promptResults.filter(r => r.org_brand_present).length;
        brandPct = (brandPresentCount / promptResults.length) * 100;

        const totalCompetitors = promptResults.reduce((sum, r) => sum + (r.competitors_count || 0), 0);
        competitorPct = totalCompetitors / promptResults.length;
      }

      return {
        id: prompt.id,
        text: prompt.text,
        active: prompt.active,
        created_at: prompt.created_at,
        visibilityScore: Math.round(visibilityScore * 10) / 10,
        brandPct: Math.round(brandPct),
        competitorPct: Math.round(competitorPct),
        hasData
      };
    });

  } catch (error) {
    console.error('Error getting prompts with visibility:', error);
    throw error;
  }
}