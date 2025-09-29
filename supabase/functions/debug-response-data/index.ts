import "https://deno.land/x/xhr@0.1.0/mod.ts";
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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Get user from auth header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      throw new Error('Invalid user token');
    }

    const { data: userData } = await supabase
      .from('users')
      .select('org_id')
      .eq('id', user.id)
      .single();

    const userOrgId = userData?.org_id;

    console.log(`🔍 Debugging response data for org: ${userOrgId}`);

    // Get recent responses
    const { data: responses } = await supabase
      .from('prompt_provider_responses')
      .select('id, provider, org_brand_present, org_brand_prominence, score, citations_json, competitors_json, brands_json, metadata, run_at')
      .eq('org_id', userOrgId)
      .order('run_at', { ascending: false })
      .limit(10);

    const debugInfo = {
      total_responses: responses?.length || 0,
      responses: responses?.map(r => ({
        id: r.id,
        provider: r.provider,
        run_at: r.run_at,
        org_brand_present: r.org_brand_present,
        org_brand_prominence: r.org_brand_prominence,
        prominence_label: getProminenceLabel(r.org_brand_prominence),
        score: r.score,
        has_citations: !!r.citations_json,
        citation_count: r.citations_json?.citations?.length || 0,
        competitors_count: r.competitors_json?.length || 0,
        brands_count: r.brands_json?.length || 0,
        analysis_method: r.metadata?.analysis_method,
        processing_time: r.metadata?.processing_time_ms
      })) || [],
      feature_flags: {
        prominence_fix: Deno.env.get('FEATURE_PROMINENCE_FIX'),
        analyzer_v2: Deno.env.get('FEATURE_ANALYZER_V2')
      }
    };

    return new Response(
      JSON.stringify(debugInfo, null, 2),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Debug error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

function getProminenceLabel(prominence: number | null): string {
  if (prominence === null) return 'Not Found';
  if (prominence === 1) return 'Very Early';
  if (prominence === 2) return 'Early';
  if (prominence <= 4) return 'Middle';
  if (prominence <= 7) return 'Late';
  return 'Very Late';
}