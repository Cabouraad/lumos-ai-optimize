import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getOrgIdSafe } from "@/lib/org-id";

export interface BrandMentionSource {
  domain: string;
  url: string;
  title?: string;
  mentionsOrgBrand: boolean;
  mentionsCompetitor: boolean;
  brandNames: string[];
  competitorNames: string[];
  citationCount: number;
  lastSeen: string;
}

export interface BrandMentionAnalytics {
  totalSources: number;
  sourcesWithOrgBrand: number;
  sourcesWithCompetitors: number;
  sourcesWithBoth: number;
  sourcesWithNeither: number;
  orgBrandRate: number;
  competitorRate: number;
  sources: BrandMentionSource[];
  topOrgBrandSources: BrandMentionSource[];
  topCompetitorSources: BrandMentionSource[];
}

export function useBrandMentionAnalytics(timeRange: '7d' | '30d' | '90d' = '30d') {
  return useQuery({
    queryKey: ['brand-mention-analytics', timeRange],
    queryFn: async (): Promise<BrandMentionAnalytics> => {
      const orgId = await getOrgIdSafe();
      if (!orgId) throw new Error("Organization not found");

      const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // Fetch responses with citations
      const { data: responses, error } = await supabase
        .from('prompt_provider_responses')
        .select('citations_json, run_at')
        .eq('org_id', orgId)
        .not('citations_json', 'is', null)
        .gte('run_at', startDate.toISOString());

      if (error) throw error;

      // Process citations to build source analytics
      const sourceMap = new Map<string, BrandMentionSource>();

      responses?.forEach(response => {
        const citations = response.citations_json as any;
        if (!citations?.citations) return;

        citations.citations.forEach((citation: any) => {
          const domain = citation.domain || new URL(citation.url).hostname;
          const existing = sourceMap.get(domain);

          const orgBrandMentions = citation.brand_mentions?.org_brands || [];
          const competitorMentions = citation.brand_mentions?.competitors || [];

          if (existing) {
            existing.citationCount++;
            existing.brandNames = [...new Set([...existing.brandNames, ...orgBrandMentions])];
            existing.competitorNames = [...new Set([...existing.competitorNames, ...competitorMentions])];
            existing.mentionsOrgBrand = existing.mentionsOrgBrand || orgBrandMentions.length > 0;
            existing.mentionsCompetitor = existing.mentionsCompetitor || competitorMentions.length > 0;
            if (response.run_at > existing.lastSeen) {
              existing.lastSeen = response.run_at;
            }
          } else {
            sourceMap.set(domain, {
              domain,
              url: citation.url,
              title: citation.title,
              mentionsOrgBrand: orgBrandMentions.length > 0,
              mentionsCompetitor: competitorMentions.length > 0,
              brandNames: orgBrandMentions,
              competitorNames: competitorMentions,
              citationCount: 1,
              lastSeen: response.run_at,
            });
          }
        });
      });

      const sources = Array.from(sourceMap.values());
      
      const sourcesWithOrgBrand = sources.filter(s => s.mentionsOrgBrand).length;
      const sourcesWithCompetitors = sources.filter(s => s.mentionsCompetitor).length;
      const sourcesWithBoth = sources.filter(s => s.mentionsOrgBrand && s.mentionsCompetitor).length;
      const sourcesWithNeither = sources.filter(s => !s.mentionsOrgBrand && !s.mentionsCompetitor).length;

      return {
        totalSources: sources.length,
        sourcesWithOrgBrand,
        sourcesWithCompetitors,
        sourcesWithBoth,
        sourcesWithNeither,
        orgBrandRate: sources.length > 0 ? (sourcesWithOrgBrand / sources.length) * 100 : 0,
        competitorRate: sources.length > 0 ? (sourcesWithCompetitors / sources.length) * 100 : 0,
        sources,
        topOrgBrandSources: sources
          .filter(s => s.mentionsOrgBrand)
          .sort((a, b) => b.citationCount - a.citationCount)
          .slice(0, 20),
        topCompetitorSources: sources
          .filter(s => s.mentionsCompetitor)
          .sort((a, b) => b.citationCount - a.citationCount)
          .slice(0, 20),
      };
    },
  });
}
