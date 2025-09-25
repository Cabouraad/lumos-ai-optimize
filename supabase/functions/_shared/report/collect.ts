/**
 * Weekly report data collection module
 * Collects and aggregates data for weekly visibility reports
 */

export interface WeeklyReportData {
  header: {
    orgId: string;
    orgName: string;
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
    trendProjection: {
      brandPresenceNext4Weeks: number;
      confidenceLevel: 'high' | 'medium' | 'low';
    };
  };
  historicalTrend: {
    weeklyScores: Array<{
      weekStart: string;
      avgScore: number;
      brandPresentRate: number;
      totalRuns: number;
    }>;
  };
  prompts: {
    totalActive: number;
    categories: {
      crm: Array<{
        id: string;
        text: string;
        avgScore: number;
        totalRuns: number;
        brandPresentRate: number;
      }>;
      competitorTools: Array<{
        id: string;
        text: string;
        avgScore: number;
        totalRuns: number;
        brandPresentRate: number;
      }>;
      aiFeatures: Array<{
        id: string;
        text: string;
        avgScore: number;
        totalRuns: number;
        brandPresentRate: number;
      }>;
      other: Array<{
        id: string;
        text: string;
        avgScore: number;
        totalRuns: number;
        brandPresentRate: number;
      }>;
    };
    topPerformers: Array<{
      id: string;
      text: string;
      avgScore: number;
      totalRuns: number;
      brandPresentRate: number;
      category: string;
    }>;
    zeroPresence: Array<{
      id: string;
      text: string;
      totalRuns: number;
      category: string;
    }>;
  };
  competitors: {
    totalDetected: number;
    newThisWeek: Array<{
      name: string;
      appearances: number;
      sharePercent: number;
    }>;
    topCompetitors: Array<{
      name: string;
      appearances: number;
      sharePercent: number;
      deltaVsPriorWeek?: number;
      isNew: boolean;
    }>;
    avgCompetitorsPerResponse: number;
    byProvider: Array<{
      provider: string;
      totalMentions: number;
      uniqueCompetitors: number;
      avgScore: number;
    }>;
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
    fallbackMessage?: string;
  };
  volume: {
    totalResponsesAnalyzed: number;
    providersUsed: Array<{
      provider: string;
      responseCount: number;
      avgScore: number;
      brandMentions: number;
    }>;
    dailyBreakdown: Array<{
      date: string;
      responses: number;
      avgScore: number;
    }>;
  };
  insights: {
    highlights: string[];
    keyFindings: string[];
    recommendations: string[];
  };
}

function categorizePrompt(text: string): string {
  const lowerText = text.toLowerCase();
  
  // CRM-related keywords
  if (lowerText.includes('crm') || lowerText.includes('salesforce') || lowerText.includes('hubspot') || 
      lowerText.includes('customer relationship') || lowerText.includes('pipeline') || lowerText.includes('leads')) {
    return 'crm';
  }
  
  // Competitor analysis tools
  if (lowerText.includes('competitor') || lowerText.includes('analysis tool') || lowerText.includes('market research') ||
      lowerText.includes('competitive analysis') || lowerText.includes('business intelligence')) {
    return 'competitorTools';
  }
  
  // AI features
  if (lowerText.includes('ai') || lowerText.includes('artificial intelligence') || lowerText.includes('machine learning') ||
      lowerText.includes('automation') || lowerText.includes('chatbot') || lowerText.includes('nlp')) {
    return 'aiFeatures';
  }
  
  return 'other';
}

function generateInsights(data: any): { highlights: string[]; keyFindings: string[]; recommendations: string[] } {
  const highlights = [];
  const keyFindings = [];
  const recommendations = [];
  
  // Generate highlights based on data
  if (data.kpis.avgVisibilityScore >= 7) {
    highlights.push(`Excellent brand visibility with ${data.kpis.avgVisibilityScore.toFixed(1)}/10 average score`);
  } else if (data.kpis.avgVisibilityScore >= 5) {
    highlights.push(`Good brand visibility at ${data.kpis.avgVisibilityScore.toFixed(1)}/10 average score`);
  } else {
    highlights.push(`Brand visibility needs improvement at ${data.kpis.avgVisibilityScore.toFixed(1)}/10 average score`);
  }
  
  if (data.kpis.deltaVsPriorWeek?.avgVisibilityScore > 0) {
    highlights.push(`Visibility improved by ${data.kpis.deltaVsPriorWeek.avgVisibilityScore.toFixed(1)} points vs last week`);
  } else if (data.kpis.deltaVsPriorWeek?.avgVisibilityScore < 0) {
    highlights.push(`Visibility declined by ${Math.abs(data.kpis.deltaVsPriorWeek.avgVisibilityScore).toFixed(1)} points vs last week`);
  }
  
  if (data.competitors.newThisWeek?.length > 0) {
    highlights.push(`${data.competitors.newThisWeek.length} new competitors detected this week`);
  }
  
  // Key findings
  keyFindings.push(`Brand present in ${data.kpis.brandPresentRate.toFixed(1)}% of responses`);
  keyFindings.push(`Average of ${data.kpis.avgCompetitors.toFixed(1)} competitors per response`);
  keyFindings.push(`${data.volume.providersUsed.length} AI providers analyzed`);
  
  // Recommendations
  if (data.prompts.zeroPresence.length > 0) {
    recommendations.push(`Review ${data.prompts.zeroPresence.length} prompts with zero brand presence`);
  }
  
  if (data.kpis.avgVisibilityScore < 6) {
    recommendations.push('Focus on improving prompt effectiveness to increase brand visibility');
  }
  
  if (data.competitors.newThisWeek?.length > 0) {
    recommendations.push('Monitor new competitors and adjust positioning strategy');
  }
  
  return { highlights, keyFindings, recommendations };
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

  console.log(`[COLLECT] Starting enhanced data collection for org ${orgId}, period ${periodStart} to ${periodEnd}`);

  // Get organization name
  const { data: orgData } = await supabase
    .from('organizations')
    .select('name')
    .eq('id', orgId)
    .single();
  
  const orgName = orgData?.name || 'Organization';

  // 1. Get historical data for trend analysis (last 4 weeks including current)
  const fourWeeksAgo = new Date(startDate);
  fourWeeksAgo.setDate(startDate.getDate() - 21); // 3 weeks before current week
  
  const { data: historicalResponses, error: historicalError } = await supabase
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
    .gte('run_at', fourWeeksAgo.toISOString())
    .lt('run_at', periodEnd)
    .eq('status', 'success')
    .order('run_at');

  if (historicalError) {
    console.error(`[COLLECT] Failed to fetch historical responses:`, historicalError);
    throw new Error(`Failed to fetch historical responses: ${historicalError.message}`);
  }

  // Separate current week and prior week data
  const currentWeekResponses = historicalResponses?.filter((r: any) => 
    r.run_at >= periodStart && r.run_at < periodEnd
  ) || [];
  
  const priorWeekResponses = historicalResponses?.filter((r: any) => 
    r.run_at >= priorWeekStart.toISOString() && r.run_at < priorWeekEnd.toISOString()
  ) || [];
  
  // Get all responses for the 2 weeks before prior week (for new competitor detection)
  const twoWeeksBeforePrior = new Date(priorWeekStart);
  twoWeeksBeforePrior.setDate(priorWeekStart.getDate() - 14);
  const historicalCompetitorResponses = historicalResponses?.filter((r: any) => 
    r.run_at >= twoWeeksBeforePrior.toISOString() && r.run_at < priorWeekStart.toISOString()
  ) || [];

  console.log(`[COLLECT] Historical data: ${historicalResponses?.length || 0} total, ${currentWeekResponses.length} current week, ${priorWeekResponses.length} prior week`);

  // 1a. Get all prompt responses for the current week (existing code)
  const { error: responsesError } = await supabase
    .from('prompt_provider_responses')
    .select('id')
    .limit(1);

  if (responsesError) {
    console.error(`[COLLECT] Database connection test failed:`, responsesError);
    throw new Error(`Database connection failed: ${responsesError.message}`);
  }

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
  orgPrompts?.forEach((prompt: any) => {
    promptsMap.set(prompt.id, prompt.text);
  });

  console.log(`[COLLECT] Fetched ${orgPrompts?.length || 0} prompts for organization`);

  // 2. Build historical trend data (4 weeks)
  const weeklyTrends = [];
  for (let weekOffset = 3; weekOffset >= 0; weekOffset--) {
    const weekStart = new Date(startDate);
    weekStart.setDate(startDate.getDate() - (weekOffset * 7));
    const weekEnd = new Date(endDate);
    weekEnd.setDate(endDate.getDate() - (weekOffset * 7));
    
    const weekResponses = historicalResponses?.filter((r: any) => 
      r.run_at >= weekStart.toISOString() && r.run_at < weekEnd.toISOString()
    ) || [];
    
    const weekAvgScore = weekResponses.length > 0 
      ? weekResponses.reduce((sum: number, r: any) => sum + (r.score || 0), 0) / weekResponses.length 
      : 0;
    const weekBrandPresent = weekResponses.filter((r: any) => r.org_brand_present).length;
    const weekBrandPresentRate = weekResponses.length > 0 ? (weekBrandPresent / weekResponses.length) * 100 : 0;
    
    weeklyTrends.push({
      weekStart: weekStart.toISOString().split('T')[0],
      avgScore: Math.round(weekAvgScore * 10) / 10,
      brandPresentRate: Math.round(weekBrandPresentRate * 10) / 10,
      totalRuns: weekResponses.length
    });
  }

  // 3. Calculate KPIs for current week
  const totalRuns = currentWeekResponses?.length || 0;
  const avgScore = totalRuns > 0 
    ? currentWeekResponses.reduce((sum: number, r: any) => sum + (r.score || 0), 0) / totalRuns 
    : 0;
  const brandPresentCount = currentWeekResponses?.filter((r: any) => r.org_brand_present).length || 0;
  const brandPresentRate = totalRuns > 0 ? (brandPresentCount / totalRuns) * 100 : 0;
  const avgCompetitors = totalRuns > 0 
    ? currentWeekResponses.reduce((sum: number, r: any) => sum + (r.competitors_count || 0), 0) / totalRuns 
    : 0;

  // 4. Calculate prior week KPIs for deltas
  let deltaVsPriorWeek;
  if (priorWeekResponses && priorWeekResponses.length > 0) {
    const priorTotalRuns = priorWeekResponses.length;
    const priorAvgScore = priorWeekResponses.reduce((sum: number, r: any) => sum + (r.score || 0), 0) / priorTotalRuns;
    const priorBrandPresentCount = priorWeekResponses.filter((r: any) => r.org_brand_present).length;
    const priorBrandPresentRate = (priorBrandPresentCount / priorTotalRuns) * 100;

    deltaVsPriorWeek = {
      avgVisibilityScore: avgScore - priorAvgScore,
      totalRuns: totalRuns - priorTotalRuns,
      brandPresentRate: brandPresentRate - priorBrandPresentRate,
    };
  }

  // 5. Aggregate prompt-level data with categorization
  const promptMap = new Map();
  currentWeekResponses?.forEach((response: any) => {
    const promptId = response.prompt_id;
    const promptText = promptsMap.get(promptId);
    
    if (!promptText) {
      console.warn(`[COLLECT] Warning: Could not find prompt text for prompt_id ${promptId}`);
      return;
    }
    
    if (!promptMap.has(promptId)) {
      promptMap.set(promptId, {
        id: promptId,
        text: promptText,
        category: categorizePrompt(promptText),
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

  // Calculate prompt metrics with categories
  const promptMetrics = Array.from(promptMap.values()).map((prompt: any) => {
    const scores = prompt.responses.map((r: any) => r.score);
    return {
      id: prompt.id,
      text: prompt.text,
      category: prompt.category,
      avgScore: scores.reduce((a: number, b: number) => a + b, 0) / scores.length,
      totalRuns: prompt.responses.length,
      brandPresentRate: (prompt.brandPresentCount / prompt.responses.length) * 100,
    };
  });

  // Group by categories
  const categories = {
    crm: promptMetrics.filter((p: any) => p.category === 'crm'),
    competitorTools: promptMetrics.filter((p: any) => p.category === 'competitorTools'),
    aiFeatures: promptMetrics.filter((p: any) => p.category === 'aiFeatures'),
    other: promptMetrics.filter((p: any) => p.category === 'other')
  };

  const sortedByScore = [...promptMetrics].sort((a, b) => b.avgScore - a.avgScore);
  const topPerformers = sortedByScore.slice(0, 5).map((p: any) => ({
    id: p.id,
    text: p.text,
    avgScore: p.avgScore,
    totalRuns: p.totalRuns,
    brandPresentRate: p.brandPresentRate,
    category: p.category
  }));
  
  const zeroPresence = promptMetrics
    .filter((p: any) => p.brandPresentRate === 0)
    .slice(0, 5)
    .map((p: any) => ({ id: p.id, text: p.text, totalRuns: p.totalRuns, category: p.category }));

  // 6. Enhanced competitor analysis with new competitor detection
  const competitorCounts = new Map();
  const priorCompetitorCounts = new Map();
  const historicalCompetitorCounts = new Map();
  
  // Current week competitors
  currentWeekResponses?.forEach((response: any) => {
    if (response.competitors_json && Array.isArray(response.competitors_json)) {
      response.competitors_json.forEach((competitor: string) => {
        const count = competitorCounts.get(competitor) || 0;
        competitorCounts.set(competitor, count + 1);
      });
    }
  });

  // Prior week competitors
  priorWeekResponses?.forEach((response: any) => {
    if (response.competitors_json && Array.isArray(response.competitors_json)) {
      response.competitors_json.forEach((competitor: string) => {
        const count = priorCompetitorCounts.get(competitor) || 0;
        priorCompetitorCounts.set(competitor, count + 1);
      });
    }
  });

  // Historical competitors (2 weeks before prior)
  historicalCompetitorResponses?.forEach((response: any) => {
    if (response.competitors_json && Array.isArray(response.competitors_json)) {
      response.competitors_json.forEach((competitor: string) => {
        const count = historicalCompetitorCounts.get(competitor) || 0;
        historicalCompetitorCounts.set(competitor, count + 1);
      });
    }
  });

  // Identify new competitors (appeared this week but not in prior 2 weeks)
  const newCompetitors = [];
  for (const [competitor, count] of competitorCounts.entries()) {
    if (!priorCompetitorCounts.has(competitor) && !historicalCompetitorCounts.has(competitor)) {
      newCompetitors.push({
        name: competitor,
        appearances: count,
        sharePercent: (count / Math.max(1, Array.from(competitorCounts.values()).reduce((a, b) => a + b, 0))) * 100
      });
    }
  }

  const totalCompetitorAppearances = Array.from(competitorCounts.values()).reduce((a, b) => a + b, 0);
  const topCompetitors = Array.from(competitorCounts.entries())
    .map(([name, appearances]) => {
      const priorAppearances = priorCompetitorCounts.get(name) || 0;
      const isNew = !priorCompetitorCounts.has(name) && !historicalCompetitorCounts.has(name);
      return {
        name,
        appearances,
        sharePercent: totalCompetitorAppearances > 0 ? (appearances / totalCompetitorAppearances) * 100 : 0,
        deltaVsPriorWeek: appearances - priorAppearances,
        isNew
      };
    })
    .sort((a, b) => b.appearances - a.appearances)
    .slice(0, 10);

  // Competitor analysis by provider
  const providerCompetitorMap = new Map();
  currentWeekResponses?.forEach((response: any) => {
    const provider = response.provider;
    if (!providerCompetitorMap.has(provider)) {
      providerCompetitorMap.set(provider, {
        totalMentions: 0,
        uniqueCompetitors: new Set(),
        totalScore: 0,
        responseCount: 0
      });
    }
    
    const providerData = providerCompetitorMap.get(provider);
    providerData.responseCount++;
    providerData.totalScore += response.score || 0;
    
    if (response.competitors_json && Array.isArray(response.competitors_json)) {
      response.competitors_json.forEach((competitor: string) => {
        providerData.totalMentions++;
        providerData.uniqueCompetitors.add(competitor);
      });
    }
  });

  const competitorsByProvider = Array.from(providerCompetitorMap.entries()).map(([provider, data]: [any, any]) => ({
    provider,
    totalMentions: data.totalMentions,
    uniqueCompetitors: data.uniqueCompetitors.size,
    avgScore: data.responseCount > 0 ? data.totalScore / data.responseCount : 0
  }));

  // 7. Get recommendations data
  const { data: recommendations } = await supabase
    .from('recommendations')
    .select('id, type, title, status')
    .eq('org_id', orgId)
    .gte('created_at', periodStart)
    .lt('created_at', periodEnd);

  const recosByType: Record<string, number> = {};
  const recosByStatus: Record<string, number> = {};
  recommendations?.forEach((reco: any) => {
    recosByType[reco.type] = (recosByType[reco.type] || 0) + 1;
    recosByStatus[reco.status] = (recosByStatus[reco.status] || 0) + 1;
  });

  const recoHighlights = recommendations?.slice(0, 5).map((reco: any) => ({
    id: reco.id,
    type: reco.type,
    title: reco.title,
    status: reco.status,
  })) || [];

  // 8. Enhanced provider metrics with brand mention tracking
  const providerCounts = new Map();
  currentWeekResponses?.forEach((response: any) => {
    const provider = response.provider;
    if (!providerCounts.has(provider)) {
      providerCounts.set(provider, { 
        count: 0, 
        totalScore: 0, 
        brandMentions: 0 
      });
    }
    const data = providerCounts.get(provider);
    data.count++;
    data.totalScore += response.score || 0;
    if (response.org_brand_present) {
      data.brandMentions++;
    }
  });

  const providersUsed = Array.from(providerCounts.entries()).map(([provider, data]: [any, any]) => ({
    provider,
    responseCount: data.count,
    avgScore: data.count > 0 ? data.totalScore / data.count : 0,
    brandMentions: data.brandMentions
  }));

  // Calculate trend projection for brand presence
  const recentTrends = weeklyTrends.slice(-2); // Last 2 weeks
  let trendProjection = {
    brandPresenceNext4Weeks: 0,
    confidenceLevel: 'low' as 'high' | 'medium' | 'low'
  };
  
  if (recentTrends.length >= 2) {
    const trendSlope = recentTrends[1].brandPresentRate - recentTrends[0].brandPresentRate;
    trendProjection.brandPresenceNext4Weeks = Math.max(0, Math.min(100, 
      recentTrends[1].brandPresentRate + (trendSlope * 4)
    ));
    
    // Determine confidence based on data consistency
    const totalResponses = recentTrends.reduce((sum: number, week: any) => sum + week.totalRuns, 0);
    if (totalResponses > 50) {
      trendProjection.confidenceLevel = 'high';
    } else if (totalResponses > 20) {
      trendProjection.confidenceLevel = 'medium';
    }
  }

  // 9. Daily breakdown
  const dailyMap = new Map();
  currentWeekResponses?.forEach((response: any) => {
    const date = response.run_at.split('T')[0];
    if (!dailyMap.has(date)) {
      dailyMap.set(date, { count: 0, totalScore: 0 });
    }
    const data = dailyMap.get(date);
    data.count++;
    data.totalScore += response.score || 0;
  });

  const dailyBreakdown = Array.from(dailyMap.entries())
    .map(([date, data]: [string, any]) => ({
      date,
      responses: data.count,
      avgScore: data.count > 0 ? data.totalScore / data.count : 0,
    }))
    .sort((a: any, b: any) => a.date.localeCompare(b.date));

  console.log(`[COLLECT] Enhanced data collection completed. Processed ${totalRuns} responses, ${promptMetrics.length} prompts, ${newCompetitors.length} new competitors`);

  // Generate insights
  const insights = generateInsights({
    kpis: { avgVisibilityScore: avgScore, brandPresentRate, deltaVsPriorWeek },
    competitors: { newThisWeek: newCompetitors },
    prompts: { zeroPresence }
  });

  return {
    header: {
      orgId,
      orgName,
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
      trendProjection: {
        brandPresenceNext4Weeks: Math.round(trendProjection.brandPresenceNext4Weeks * 10) / 10,
        confidenceLevel: trendProjection.confidenceLevel
      }
    },
    historicalTrend: {
      weeklyScores: weeklyTrends
    },
    prompts: {
      totalActive: promptMetrics.length,
      categories: {
        crm: categories.crm.map((p: any) => ({
          id: p.id,
          text: p.text,
          avgScore: Math.round(p.avgScore * 10) / 10,
          totalRuns: p.totalRuns,
          brandPresentRate: Math.round(p.brandPresentRate * 10) / 10
        })),
        competitorTools: categories.competitorTools.map((p: any) => ({
          id: p.id,
          text: p.text,
          avgScore: Math.round(p.avgScore * 10) / 10,
          totalRuns: p.totalRuns,
          brandPresentRate: Math.round(p.brandPresentRate * 10) / 10
        })),
        aiFeatures: categories.aiFeatures.map((p: any) => ({
          id: p.id,
          text: p.text,
          avgScore: Math.round(p.avgScore * 10) / 10,
          totalRuns: p.totalRuns,
          brandPresentRate: Math.round(p.brandPresentRate * 10) / 10
        })),
        other: categories.other.map((p: any) => ({
          id: p.id,
          text: p.text,
          avgScore: Math.round(p.avgScore * 10) / 10,
          totalRuns: p.totalRuns,
          brandPresentRate: Math.round(p.brandPresentRate * 10) / 10
        }))
      },
      topPerformers: topPerformers.map((p: any) => ({
        ...p,
        avgScore: Math.round(p.avgScore * 10) / 10,
        brandPresentRate: Math.round(p.brandPresentRate * 10) / 10,
      })),
      zeroPresence,
    },
    competitors: {
      totalDetected: competitorCounts.size,
      newThisWeek: newCompetitors.map((c: any) => ({
        ...c,
        sharePercent: Math.round(c.sharePercent * 10) / 10
      })),
      topCompetitors: topCompetitors.map((c: any) => ({
        ...c,
        sharePercent: Math.round(c.sharePercent * 10) / 10,
      })),
      avgCompetitorsPerResponse: Math.round(avgCompetitors * 10) / 10,
      byProvider: competitorsByProvider.map((p: any) => ({
        ...p,
        avgScore: Math.round(p.avgScore * 10) / 10
      }))
    },
    recommendations: {
      totalCount: recommendations?.length || 0,
      byType: recosByType,
      byStatus: recosByStatus,
      highlights: recoHighlights,
      fallbackMessage: recommendations?.length === 0 ? 
        "No urgent fixes needed—keep up the good performance!" : undefined
    },
    volume: {
      totalResponsesAnalyzed: totalRuns,
      providersUsed: providersUsed.map((p: any) => ({
        ...p,
        avgScore: Math.round(p.avgScore * 10) / 10,
      })),
      dailyBreakdown: dailyBreakdown.map((d: any) => ({
        ...d,
        avgScore: Math.round(d.avgScore * 10) / 10,
      })),
    },
    insights
  };
}