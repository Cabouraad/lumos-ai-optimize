// Centralized report types to prevent type drift across the codebase

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
    overallScore: number;
    scoreTrend: number;
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
    // Backward compatibility aliases (will be set at runtime)
    brandPresenceRate?: number;        // alias for brandPresentRate
    presenceTrend?: number;           // alias for deltaVsPriorWeek?.brandPresentRate
    totalPrompts?: number;            // alias for prompts.totalActive
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