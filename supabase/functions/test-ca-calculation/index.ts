import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { org_id } = await req.json();
    
    if (!org_id) {
      return new Response(JSON.stringify({ error: 'org_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log(`Testing CA calculation for org: ${org_id}`);

    // Get sample responses with citations
    const { data: responses, error } = await supabase
      .from('prompt_provider_responses')
      .select('id, provider, citations_json, run_at')
      .eq('org_id', org_id)
      .not('citations_json', 'is', null)
      .order('run_at', { ascending: false })
      .limit(10);

    if (error) throw error;

    // Test calculate_ca_submetric
    const windowEnd = new Date();
    const windowStart = new Date(windowEnd);
    windowStart.setDate(windowStart.getDate() - 28);

    const { data: caScore, error: caError } = await supabase.rpc('calculate_ca_submetric', {
      p_org_id: org_id,
      p_prompt_id: null,
      p_window_start: windowStart.toISOString(),
      p_window_end: windowEnd.toISOString()
    });

    if (caError) throw caError;

    // Test individual response scoring
    const testResults = [];
    for (const response of responses || []) {
      const { data: orgDomains } = await supabase.rpc('org_domain_set', { p_org_id: org_id });
      
      const { data: responseScore } = await supabase.rpc('calculate_citation_authority_score', {
        p_citations_json: response.citations_json,
        p_org_domains: orgDomains || []
      });

      testResults.push({
        response_id: response.id,
        provider: response.provider,
        citation_count: response.citations_json?.citations?.length || 0,
        ca_score: responseScore,
        run_at: response.run_at
      });
    }

    // Get domain authority sample
    const { data: domainSamples } = await supabase
      .from('domain_authority_reference')
      .select('domain, authority_score, category, tier')
      .order('authority_score', { ascending: false })
      .limit(5);

    return new Response(JSON.stringify({
      success: true,
      org_id,
      overall_ca_score: caScore,
      sample_responses: testResults,
      domain_authority_samples: domainSamples,
      message: 'CA calculation tested successfully. Ready for Phase 2 integration.',
      phase_1_complete: true
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Test CA calculation error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
