// DEPRECATED: Use unified-fetcher.ts instead
// This file is kept for backward compatibility only

import { getUnifiedPromptData, getPromptProviderHistory } from "@/lib/data/unified-fetcher";

console.warn("prompts/provider-data.ts is deprecated. Use unified-fetcher.ts instead.");

export { getPromptProviderHistory } from "@/lib/data/unified-fetcher";

export async function getPromptsWithProviderData() {
  console.warn("getPromptsWithProviderData is deprecated. Use getUnifiedPromptData instead.");
  const data = await getUnifiedPromptData();
  return data.promptDetails;
}

export async function getOrgCompetitorSummary() {
  console.warn("getOrgCompetitorSummary is deprecated. Data is now included in getUnifiedPromptData.");
  const data = await getUnifiedPromptData();
  
  // Aggregate competitors across all prompts
  const competitorMap = new Map();
  data.promptDetails.forEach(prompt => {
    prompt.competitors.forEach(comp => {
      const existing = competitorMap.get(comp.name);
      if (existing) {
        existing.totalMentions += comp.count;
        existing.promptCount += 1;
      } else {
        competitorMap.set(comp.name, {
          name: comp.name,
          totalMentions: comp.count,
          promptCount: 1,
          avgPosition: 0, // TODO: Calculate if needed
          recentMentions: comp.count
        });
      }
    });
  });
  
  return Array.from(competitorMap.values())
    .sort((a, b) => b.totalMentions - a.totalMentions);
}