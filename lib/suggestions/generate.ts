/**
 * Prompt suggestion generator
 */

import { supabase } from '@/integrations/supabase/client';

export interface SuggestionResult {
  success: boolean;
  error?: string;
  suggestionsCreated: number;
}

export async function generateSuggestions(orgId: string): Promise<SuggestionResult> {
  try {
    const suggestions: Array<{ text: string; source: string }> = [];

    // Get organization data (could use onboarding keywords/competitors from initial setup)
    const { data: org } = await supabase
      .from('organizations')
      .select('name, domain')
      .eq('id', orgId)
      .single();

    if (!org) {
      return { success: false, error: 'Organization not found' };
    }

    // Get recent gaps (prompts where org absent or score < 50)
    const { data: recentResults } = await supabase
      .from('visibility_results')
      .select(`
        score,
        org_brand_present,
        prompt_runs!inner (
          prompts!inner (
            text,
            org_id
          )
        )
      `)
      .eq('prompt_runs.prompts.org_id', orgId)
      .gte('prompt_runs.run_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .or('org_brand_present.eq.false,score.lt.50');

    // Industry-based suggestions
    const industrySuggestions = [
      `What are the best tools for ${org.domain} industry?`,
      `Top companies in ${org.domain} space`,
      `${org.domain} market leaders comparison`,
      `Best software for ${org.domain} businesses`,
      `${org.domain} industry trends and predictions`
    ];

    industrySuggestions.forEach(text => {
      suggestions.push({ text, source: 'industry' });
    });

    // Keyword-based suggestions (generic business terms)
    const keywordSuggestions = [
      'Best project management software',
      'Top CRM solutions for small business',
      'Business automation tools comparison',
      'Customer support software reviews',
      'Marketing analytics platforms'
    ];

    keywordSuggestions.forEach(text => {
      suggestions.push({ text, source: 'keywords' });
    });

    // Competitor-based suggestions
    const competitorSuggestions = [
      `Alternatives to popular ${org.domain} tools`,
      `${org.name} vs competitors comparison`,
      `Best alternatives in ${org.domain} market`,
      `${org.domain} software comparison guide`
    ];

    competitorSuggestions.forEach(text => {
      suggestions.push({ text, source: 'competitors' });
    });

    // Gap-based suggestions (from recent poor performance)
    if (recentResults && recentResults.length > 0) {
      const gapSuggestions = [
        `Why choose ${org.name} over alternatives?`,
        `${org.name} unique features and benefits`,
        `${org.name} customer success stories`,
        `How ${org.name} solves ${org.domain} challenges`
      ];

      gapSuggestions.forEach(text => {
        suggestions.push({ text, source: 'gap' });
      });
    }

    // Limit to 20 suggestions and insert
    const limitedSuggestions = suggestions.slice(0, 20);
    
    if (limitedSuggestions.length > 0) {
      const { data, error } = await supabase
        .from('suggested_prompts')
        .insert(
          limitedSuggestions.map(suggestion => ({
            org_id: orgId,
            text: suggestion.text,
            source: suggestion.source as any,
            accepted: false
          }))
        );

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, suggestionsCreated: limitedSuggestions.length };
    }

    return { success: true, suggestionsCreated: 0 };

  } catch (error: any) {
    return { success: false, error: error.message };
  }
}