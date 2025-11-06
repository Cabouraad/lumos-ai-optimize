import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";
import { corsHeaders } from '../_shared/cors.ts';

/**
 * Diagnostic tool to analyze citation extraction
 * Helps identify why citations aren't being captured
 */

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get org_id from auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (!user) {
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user's org
    const { data: membership } = await supabase
      .from('org_members')
      .select('org_id')
      .eq('user_id', user.id)
      .single();

    if (!membership) {
      return new Response(
        JSON.stringify({ error: 'Organization not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const orgId = membership.org_id;

    // Analyze recent responses
    const { data: responses } = await supabase
      .from('prompt_provider_responses')
      .select('id, provider, status, citations_json, raw_ai_response, run_at')
      .eq('org_id', orgId)
      .gte('run_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('run_at', { ascending: false })
      .limit(100);

    if (!responses || responses.length === 0) {
      return new Response(
        JSON.stringify({ 
          error: 'No recent responses found',
          suggestion: 'Run some prompts first to analyze citation extraction'
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Analyze citation data
    const analysis = {
      total_responses: responses.length,
      by_provider: {} as Record<string, any>,
      by_status: {} as Record<string, number>,
      citation_stats: {
        responses_with_citations: 0,
        responses_with_empty_citations: 0,
        responses_with_null_citations: 0,
        total_citations: 0,
        avg_citations_per_response: 0
      },
      sample_responses: [] as any[]
    };

    // Group by provider and status
    responses.forEach(r => {
      // Status
      analysis.by_status[r.status] = (analysis.by_status[r.status] || 0) + 1;

      // Provider stats
      if (!analysis.by_provider[r.provider]) {
        analysis.by_provider[r.provider] = {
          count: 0,
          with_citations: 0,
          empty_citations: 0,
          null_citations: 0,
          total_citations: 0,
          has_response_text: 0
        };
      }

      const providerStats = analysis.by_provider[r.provider];
      providerStats.count++;

      // Check response text
      if (r.raw_ai_response && r.raw_ai_response.length > 0) {
        providerStats.has_response_text++;
      }

      // Citation analysis
      if (r.citations_json === null) {
        providerStats.null_citations++;
        analysis.citation_stats.responses_with_null_citations++;
      } else {
        const citations = typeof r.citations_json === 'string' 
          ? JSON.parse(r.citations_json) 
          : r.citations_json;

        const citationArray = Array.isArray(citations) 
          ? citations 
          : citations?.citations || [];

        if (citationArray.length === 0) {
          providerStats.empty_citations++;
          analysis.citation_stats.responses_with_empty_citations++;
        } else {
          providerStats.with_citations++;
          providerStats.total_citations += citationArray.length;
          analysis.citation_stats.responses_with_citations++;
          analysis.citation_stats.total_citations += citationArray.length;
        }
      }
    });

    // Calculate average
    if (analysis.citation_stats.responses_with_citations > 0) {
      analysis.citation_stats.avg_citations_per_response = 
        analysis.citation_stats.total_citations / analysis.citation_stats.responses_with_citations;
    }

    // Add sample responses with citations
    const samplesWithCitations = responses
      .filter(r => {
        if (!r.citations_json) return false;
        const citations = typeof r.citations_json === 'string' 
          ? JSON.parse(r.citations_json) 
          : r.citations_json;
        const citationArray = Array.isArray(citations) ? citations : citations?.citations || [];
        return citationArray.length > 0;
      })
      .slice(0, 3)
      .map(r => ({
        provider: r.provider,
        status: r.status,
        run_at: r.run_at,
        response_length: r.raw_ai_response?.length || 0,
        citations: typeof r.citations_json === 'string' 
          ? JSON.parse(r.citations_json) 
          : r.citations_json
      }));

    analysis.sample_responses = samplesWithCitations;

    // Generate recommendations
    const recommendations = [];

    if (analysis.citation_stats.responses_with_citations === 0) {
      recommendations.push({
        issue: 'No citations found in any responses',
        reasons: [
          'Google AI Overview may not be appearing for these prompts',
          'Other providers might not be returning source citations',
          'Citation extraction logic may need adjustment'
        ],
        solutions: [
          'Try more specific, informational prompts that trigger AI Overviews',
          'Enable additional providers (Perplexity, Gemini) that include citations',
          'Check edge function logs for citation extraction errors'
        ]
      });
    }

    // Check Google AIO specifically
    const googleStats = analysis.by_provider['google_ai_overview'];
    if (googleStats && googleStats.has_response_text === 0) {
      recommendations.push({
        issue: 'Google AI Overview returning empty responses',
        reasons: [
          'AI Overview not appearing in Google Search for these queries',
          'Prompts may be too broad, specific, or niche',
          'Geographic location (US) may not have AI Overview for these topics'
        ],
        solutions: [
          'Test with prompts known to trigger AI Overviews (e.g., "best laptops 2024")',
          'Try different query formulations',
          'Consider using other providers that always return citations (Perplexity)'
        ]
      });
    }

    return new Response(
      JSON.stringify({
        analysis,
        recommendations,
        raw_sample_count: responses.length
      }, null, 2),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('[Diagnose Citations] Error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
