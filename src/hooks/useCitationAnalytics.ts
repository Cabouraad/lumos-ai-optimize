import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getOrgIdSafe } from '@/lib/org-id';
import { format, subDays, parseISO } from 'date-fns';

interface CitationAnalytics {
  summary: {
    totalCitations: number;
    uniquePages: number;
    avgPerResponse: number;
    topDomain: string;
  };
  trendsOverTime: Array<{
    date: string;
    citations: number;
    uniquePages: number;
  }>;
  topModels: Array<{
    model: string;
    citations: number;
  }>;
  citationsByProvider: Array<{
    provider: string;
    citations: number;
  }>;
  topPages: Array<{
    url: string;
    title: string;
    domain: string;
    citations: number;
  }>;
  topPrompts: Array<{
    promptId: string;
    promptText: string;
    totalCitations: number;
    responses: number;
    avgCitationsPerResponse: number;
  }>;
}

export function useCitationAnalytics(timeRange: '7d' | '30d' | '90d' = '30d') {
  // Get orgId using the same pattern as useLlumosScore
  const { data: orgId } = useQuery({
    queryKey: ['org-id'],
    queryFn: getOrgIdSafe,
    staleTime: 5 * 60 * 1000,
  });

  return useQuery({
    queryKey: ['citation-analytics', orgId, timeRange],
    queryFn: async (): Promise<CitationAnalytics> => {
      if (!orgId) throw new Error('No organization ID');

      const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
      const startDate = subDays(new Date(), days);

      // Fetch all responses with citations in the time range
      const { data: responses, error } = await supabase
        .from('prompt_provider_responses')
        .select('id, prompt_id, provider, model, citations_json, run_at, prompts(text)')
        .eq('org_id', orgId)
        .eq('status', 'completed')
        .gte('run_at', startDate.toISOString())
        .not('citations_json', 'is', null);

      if (error) throw error;
      if (!responses || responses.length === 0) {
        return {
          summary: { totalCitations: 0, uniquePages: 0, avgPerResponse: 0, topDomain: 'N/A' },
          trendsOverTime: [],
          topModels: [],
          citationsByProvider: [],
          topPages: [],
          topPrompts: [],
        };
      }

      // Process all citations
      const citationCounts = new Map<string, { url: string; title: string; domain: string; count: number }>();
      const modelCitations = new Map<string, number>();
      const providerCitations = new Map<string, number>();
      const dailyCitations = new Map<string, { citations: number; pages: Set<string> }>();
      const promptCitations = new Map<string, { text: string; citations: number; responses: number }>();

      let totalCitations = 0;

      responses.forEach((response: any) => {
        const citationsData = response.citations_json as any;
        const citations = citationsData?.citations || [];
        const dateKey = format(parseISO(response.run_at), 'MMM dd');

        // Initialize daily stats
        if (!dailyCitations.has(dateKey)) {
          dailyCitations.set(dateKey, { citations: 0, pages: new Set() });
        }

        citations.forEach((citation: any) => {
          const url = citation.url;
          if (!url) return;

          totalCitations++;

          // Track page citations
          const existing = citationCounts.get(url);
          if (existing) {
            existing.count++;
          } else {
            citationCounts.set(url, {
              url,
              title: citation.title || url,
              domain: citation.domain || new URL(url).hostname,
              count: 1
            });
          }

          // Track daily citations
          const dailyStats = dailyCitations.get(dateKey)!;
          dailyStats.citations++;
          dailyStats.pages.add(url);
        });

        // Track model citations
        if (response.model) {
          modelCitations.set(
            response.model,
            (modelCitations.get(response.model) || 0) + citations.length
          );
        }

        // Track provider citations
        if (response.provider) {
          providerCitations.set(
            response.provider,
            (providerCitations.get(response.provider) || 0) + citations.length
          );
        }

        // Track prompt citations
        const promptText = response.prompts?.text || 'Unknown Prompt';
        if (response.prompt_id) {
          const existing = promptCitations.get(response.prompt_id);
          if (existing) {
            existing.citations += citations.length;
            existing.responses++;
          } else {
            promptCitations.set(response.prompt_id, {
              text: promptText,
              citations: citations.length,
              responses: 1
            });
          }
        }
      });

      // Convert maps to sorted arrays
      const topPages = Array.from(citationCounts.values())
        .sort((a, b) => b.count - a.count);

      const topModels = Array.from(modelCitations.entries())
        .map(([model, citations]) => ({ model, citations }))
        .sort((a, b) => b.citations - a.citations)
        .slice(0, 10);

      const citationsByProvider = Array.from(providerCitations.entries())
        .map(([provider, citations]) => ({ provider, citations }))
        .sort((a, b) => b.citations - a.citations);

      const topPrompts = Array.from(promptCitations.entries())
        .map(([promptId, data]) => ({
          promptId,
          promptText: data.text,
          totalCitations: data.citations,
          responses: data.responses,
          avgCitationsPerResponse: data.citations / data.responses
        }))
        .sort((a, b) => b.totalCitations - a.totalCitations);

      // Build trends over time
      const trendsOverTime = Array.from(dailyCitations.entries())
        .map(([date, stats]) => ({
          date,
          citations: stats.citations,
          uniquePages: stats.pages.size
        }))
        .sort((a, b) => {
          // Sort by date
          const dateA = new Date(a.date + ' ' + new Date().getFullYear());
          const dateB = new Date(b.date + ' ' + new Date().getFullYear());
          return dateA.getTime() - dateB.getTime();
        });

      // Get top domain
      const domainCounts = new Map<string, number>();
      topPages.forEach(page => {
        domainCounts.set(page.domain, (domainCounts.get(page.domain) || 0) + page.count);
      });
      const topDomain = Array.from(domainCounts.entries())
        .sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';

      return {
        summary: {
          totalCitations,
          uniquePages: citationCounts.size,
          avgPerResponse: responses.length > 0 ? totalCitations / responses.length : 0,
          topDomain
        },
        trendsOverTime,
        topModels,
        citationsByProvider,
        topPages: topPages.slice(0, 20).map(page => ({
          ...page,
          citations: page.count
        })),
        topPrompts: topPrompts.slice(0, 20)
      };
    },
    enabled: !!orgId
  });
}
