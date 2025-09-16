/**
 * Weekly report data collection module
 * Collects and aggregates data for weekly visibility reports
 */

export interface WeeklyReportData {
  header: {
    orgId: string;
    periodStart: string;
    periodEnd: string;
    generatedAt: string;
  };
  kpis: {
    avgVisibilityScore: number;
    totalRuns: number;
    brandPresentRate: number;
    avgCompetitors: number;
    deltaVsPriorWeek?: {
      avgVisibilityScore: number;
      totalRuns: number;
      brandPresentRate: number;
    };
  };
  prompts: {
    totalActive: number;
    topPerformers: Array<{
      id: string;
      text: string;
      avgScore: number;
      totalRuns: number;
      brandPresentRate: number;
    }>;
    poorPerformers: Array<{
      id: string;
      text: string;
      avgScore: number;
      totalRuns: number;
      brandPresentRate: number;
    }>;
    zeroPresence: Array<{
      id: string;
      text: string;
      totalRuns: number;
    }>;
  };
  competitors: {
    totalDetected: number;
    topCompetitors: Array<{
      name: string;
      appearances: number;
      sharePercent: number;
      deltaVsPriorWeek?: number;
    }>;
    avgCompetitorsPerResponse: number;
  };
  recommendations: {
    totalCount: number;
    byType: Record<string, number>;
    byStatus: Record<string, number>;
    highlights: Array<{
      id: string;
      type: string;
      title: string;
      status: string;
    }>;
  };
  volume: {
    totalResponsesAnalyzed: number;
    providersUsed: Array<{
      provider: string;
      responseCount: number;
      avgScore: number;
    }>;
    dailyBreakdown: Array<{
      date: string;
      responses: number;
      avgScore: number;
    }>;
  };
}

export async function collectWeeklyData(
  supabase: any, 
  orgId: string, 
  periodStart: string, 
  periodEnd: string
): Promise<WeeklyReportData> {
  const startDate = new Date(periodStart);
  const endDate = new Date(periodEnd);
  const priorWeekStart = new Date(startDate);
  priorWeekStart.setDate(startDate.getDate() - 7);
  const priorWeekEnd = new Date(endDate);
  priorWeekEnd.setDate(endDate.getDate() - 7);

  console.log(`[COLLECT] Starting data collection for org ${orgId}, period ${periodStart} to ${periodEnd}`);

  // 1. Get all prompt responses for the current week
  const { data: currentWeekResponses, error: responsesError } = await supabase
    .from('prompt_provider_responses')
    .select(`
      id,
      prompt_id,
      provider,
      score,
      org_brand_present,
      competitors_count,
      competitors_json,
      brands_json,
      run_at
    `)
    .eq('org_id', orgId)
    .gte('run_at', periodStart)
    .lt('run_at', periodEnd)
    .eq('status', 'success');

  if (responsesError) {
    console.error(`[COLLECT] Failed to fetch current week responses:`, responsesError);
    throw new Error(`Failed to fetch current week responses: ${responsesError.message}`);
  }

  console.log(`[COLLECT] Fetched ${currentWeekResponses?.length || 0} responses for current week`);

  // 1a. Get all prompts for the organization to join with responses
  const { data: orgPrompts, error: promptsError } = await supabase
    .from('prompts')
    .select('id, text')
    .eq('org_id', orgId);

  if (promptsError) {
    console.error(`[COLLECT] Failed to fetch org prompts:`, promptsError);
    throw new Error(`Failed to fetch org prompts: ${promptsError.message}`);
  }

  // Create a map of prompt_id -> prompt_text for efficient lookups
  const promptsMap = new Map();
  orgPrompts?.forEach(prompt => {
    promptsMap.set(prompt.id, prompt.text);
  });

  console.log(`[COLLECT] Fetched ${orgPrompts?.length || 0} prompts for organization`);

  // 2. Get prior week responses for delta calculations
  const { data: priorWeekResponses } = await supabase
    .from('prompt_provider_responses')
    .select(`
      score,
      org_brand_present,
      competitors_count,
      run_at
    `)
    .eq('org_id', orgId)
    .gte('run_at', priorWeekStart.toISOString())
    .lt('run_at', priorWeekEnd.toISOString())
    .eq('status', 'success');

  // 3. Calculate KPIs for current week
  const totalRuns = currentWeekResponses?.length || 0;
  const avgScore = totalRuns > 0 
    ? currentWeekResponses.reduce((sum, r) => sum + (r.score || 0), 0) / totalRuns 
    : 0;
  const brandPresentCount = currentWeekResponses?.filter(r => r.org_brand_present).length || 0;
  const brandPresentRate = totalRuns > 0 ? (brandPresentCount / totalRuns) * 100 : 0;
  const avgCompetitors = totalRuns > 0 
    ? currentWeekResponses.reduce((sum, r) => sum + (r.competitors_count || 0), 0) / totalRuns 
    : 0;

  // 4. Calculate prior week KPIs for deltas
  let deltaVsPriorWeek;
  if (priorWeekResponses && priorWeekResponses.length > 0) {
    const priorTotalRuns = priorWeekResponses.length;
    const priorAvgScore = priorWeekResponses.reduce((sum, r) => sum + (r.score || 0), 0) / priorTotalRuns;
    const priorBrandPresentCount = priorWeekResponses.filter(r => r.org_brand_present).length;
    const priorBrandPresentRate = (priorBrandPresentCount / priorTotalRuns) * 100;

    deltaVsPriorWeek = {
      avgVisibilityScore: avgScore - priorAvgScore,
      totalRuns: totalRuns - priorTotalRuns,
      brandPresentRate: brandPresentRate - priorBrandPresentRate,
    };
  }

  // 5. Aggregate prompt-level data
  const promptMap = new Map();
  currentWeekResponses?.forEach(response => {
    const promptId = response.prompt_id;
    const promptText = promptsMap.get(promptId);
    
    // Skip responses for prompts we couldn't find (shouldn't happen but safety check)
    if (!promptText) {
      console.warn(`[COLLECT] Warning: Could not find prompt text for prompt_id ${promptId}`);
      return;
    }
    
    if (!promptMap.has(promptId)) {
      promptMap.set(promptId, {
        id: promptId,
        text: promptText,
        responses: [],
        brandPresentCount: 0,
      });
    }
    
    const promptData = promptMap.get(promptId);
    promptData.responses.push(response);
    if (response.org_brand_present) {
      promptData.brandPresentCount++;
    }
  });

  // Calculate prompt metrics and sort
  const promptMetrics = Array.from(promptMap.values()).map(prompt => {
    const scores = prompt.responses.map(r => r.score);
    return {
      id: prompt.id,
      text: prompt.text,
      avgScore: scores.reduce((a, b) => a + b, 0) / scores.length,
      totalRuns: prompt.responses.length,
      brandPresentRate: (prompt.brandPresentCount / prompt.responses.length) * 100,
    };
  });

  const sortedByScore = [...promptMetrics].sort((a, b) => b.avgScore - a.avgScore);
  const topPerformers = sortedByScore.slice(0, 5);
  const poorPerformers = sortedByScore.slice(-3).reverse();
  const zeroPresence = promptMetrics
    .filter(p => p.brandPresentRate === 0)
    .slice(0, 5)
    .map(p => ({ id: p.id, text: p.text, totalRuns: p.totalRuns }));

  // 6. Analyze competitors
  const competitorCounts = new Map();
  currentWeekResponses?.forEach(response => {
    if (response.competitors_json && Array.isArray(response.competitors_json)) {
      response.competitors_json.forEach((competitor: string) => {
        const count = competitorCounts.get(competitor) || 0;
        competitorCounts.set(competitor, count + 1);
      });
    }
  });

  const totalCompetitorAppearances = Array.from(competitorCounts.values()).reduce((a, b) => a + b, 0);
  const topCompetitors = Array.from(competitorCounts.entries())
    .map(([name, appearances]) => ({
      name,
      appearances,
      sharePercent: totalCompetitorAppearances > 0 ? (appearances / totalCompetitorAppearances) * 100 : 0,
    }))
    .sort((a, b) => b.appearances - a.appearances)
    .slice(0, 10);

  // 7. Get recommendations data
  const { data: recommendations } = await supabase
    .from('recommendations')
    .select('id, type, title, status')
    .eq('org_id', orgId)
    .gte('created_at', periodStart)
    .lt('created_at', periodEnd);

  const recosByType = {};
  const recosByStatus = {};
  recommendations?.forEach(reco => {
    recosByType[reco.type] = (recosByType[reco.type] || 0) + 1;
    recosByStatus[reco.status] = (recosByStatus[reco.status] || 0) + 1;
  });

  const recoHighlights = recommendations?.slice(0, 5).map(reco => ({
    id: reco.id,
    type: reco.type,
    title: reco.title,
    status: reco.status,
  })) || [];

  // 8. Calculate provider metrics
  const providerCounts = new Map();
  currentWeekResponses?.forEach(response => {
    const provider = response.provider;
    if (!providerCounts.has(provider)) {
      providerCounts.set(provider, { count: 0, totalScore: 0 });
    }
    const data = providerCounts.get(provider);
    data.count++;
    data.totalScore += response.score || 0;
  });

  const providersUsed = Array.from(providerCounts.entries()).map(([provider, data]) => ({
    provider,
    responseCount: data.count,
    avgScore: data.count > 0 ? data.totalScore / data.count : 0,
  }));

  // 9. Daily breakdown
  const dailyMap = new Map();
  currentWeekResponses?.forEach(response => {
    const date = response.run_at.split('T')[0];
    if (!dailyMap.has(date)) {
      dailyMap.set(date, { count: 0, totalScore: 0 });
    }
    const data = dailyMap.get(date);
    data.count++;
    data.totalScore += response.score || 0;
  });

  const dailyBreakdown = Array.from(dailyMap.entries())
    .map(([date, data]) => ({
      date,
      responses: data.count,
      avgScore: data.count > 0 ? data.totalScore / data.count : 0,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  console.log(`[COLLECT] Data collection completed. Processed ${totalRuns} responses, ${promptMetrics.length} prompts`);

  return {
    header: {
      orgId,
      periodStart,
      periodEnd,
      generatedAt: new Date().toISOString(),
    },
    kpis: {
      avgVisibilityScore: Math.round(avgScore * 10) / 10,
      totalRuns,
      brandPresentRate: Math.round(brandPresentRate * 10) / 10,
      avgCompetitors: Math.round(avgCompetitors * 10) / 10,
      deltaVsPriorWeek,
    },
    prompts: {
      totalActive: promptMetrics.length,
      topPerformers: topPerformers.map(p => ({
        ...p,
        avgScore: Math.round(p.avgScore * 10) / 10,
        brandPresentRate: Math.round(p.brandPresentRate * 10) / 10,
      })),
      poorPerformers: poorPerformers.map(p => ({
        ...p,
        avgScore: Math.round(p.avgScore * 10) / 10,
        brandPresentRate: Math.round(p.brandPresentRate * 10) / 10,
      })),
      zeroPresence,
    },
    competitors: {
      totalDetected: competitorCounts.size,
      topCompetitors: topCompetitors.map(c => ({
        ...c,
        sharePercent: Math.round(c.sharePercent * 10) / 10,
      })),
      avgCompetitorsPerResponse: Math.round(avgCompetitors * 10) / 10,
    },
    recommendations: {
      totalCount: recommendations?.length || 0,
      byType: recosByType,
      byStatus: recosByStatus,
      highlights: recoHighlights,
    },
    volume: {
      totalResponsesAnalyzed: totalRuns,
      providersUsed: providersUsed.map(p => ({
        ...p,
        avgScore: Math.round(p.avgScore * 10) / 10,
      })),
      dailyBreakdown: dailyBreakdown.map(d => ({
        ...d,
        avgScore: Math.round(d.avgScore * 10) / 10,
      })),
    },
  };
}