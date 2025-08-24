
// DEPRECATED: Use unified-fetcher.ts instead  
// This file is kept for backward compatibility only

import { getUnifiedDashboardData } from "@/lib/data/unified-fetcher";

export interface PromptWithScore {
  id: string;
  text: string;
  active: boolean;
  created_at: string;
  visibilityScore: number;
  brandPct: number;
  competitorPct: number;
  hasData: boolean;
}

export async function getPromptsWithScores(): Promise<PromptWithScore[]> {
  console.warn("getPromptsWithScores is deprecated. Use getUnifiedDashboardData instead.");
  
  const data = await getUnifiedDashboardData();
  return data.prompts.map(prompt => ({
    id: prompt.id,
    text: prompt.text,
    active: prompt.active,
    created_at: prompt.created_at,
    visibilityScore: prompt.latestScore,
    brandPct: 0, // TODO: Calculate if needed
    competitorPct: 0, // TODO: Calculate if needed  
    hasData: prompt.hasData
  }));
}
