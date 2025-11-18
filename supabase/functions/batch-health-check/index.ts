import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    // Check for stuck jobs (in_progress for more than 5 minutes without heartbeat)
    const fiveMinutesAgo = new Date(Date.now() - 300000).toISOString();
    const { data: stuckJobs } = await supabase
      .from('batch_jobs')
      .select('id, org_id, status, started_at, metadata')
      .eq('status', 'in_progress')
      .or(`metadata->>last_heartbeat.lt.${fiveMinutesAgo},metadata->>last_heartbeat.is.null`);

    // Check citation extraction rate for recent responses (last hour)
    const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
    const { data: recentResponses } = await supabase
      .from('prompt_provider_responses')
      .select('provider, citations_json, status')
      .gte('run_at', oneHourAgo)
      .eq('status', 'success')
      .limit(100);

    const citationStats = {
      total: recentResponses?.length || 0,
      withCitations: recentResponses?.filter(r => 
        r.citations_json?.citations?.length > 0
      ).length || 0,
      withValidUrls: recentResponses?.filter(r => 
        r.citations_json?.citations?.some((c: any) => c.url && c.url !== 'unknown' && c.url.startsWith('http'))
      ).length || 0,
      byProvider: {} as Record<string, { total: number; withCitations: number; withValidUrls: number }>
    };

    // Calculate per-provider stats with URL validation
    recentResponses?.forEach(r => {
      if (!citationStats.byProvider[r.provider]) {
        citationStats.byProvider[r.provider] = { total: 0, withCitations: 0, withValidUrls: 0 };
      }
      citationStats.byProvider[r.provider].total++;
      if (r.citations_json?.citations?.length > 0) {
        citationStats.byProvider[r.provider].withCitations++;
        const hasValidUrl = r.citations_json.citations.some((c: any) => 
          c.url && c.url !== 'unknown' && c.url.startsWith('http')
        );
        if (hasValidUrl) {
          citationStats.byProvider[r.provider].withValidUrls++;
        }
      }
    });

    const extractionRate = citationStats.total > 0 
      ? ((citationStats.withCitations / citationStats.total) * 100).toFixed(1) + '%'
      : 'N/A';
    
    const qualityRate = citationStats.total > 0
      ? ((citationStats.withValidUrls / citationStats.total) * 100).toFixed(1) + '%'
      : 'N/A';

    const healthStatus = {
      timestamp: new Date().toISOString(),
      stuckJobs: {
        count: stuckJobs?.length || 0,
        jobIds: stuckJobs?.map(j => j.id) || [],
        details: stuckJobs?.map(j => ({
          id: j.id,
          orgId: j.org_id,
          startedAt: j.started_at,
          lastHeartbeat: j.metadata?.last_heartbeat || 'never'
        })) || []
      },
      citations: {
        extractionRate,
        qualityRate,
        stats: citationStats,
        health: citationStats.total > 10 && citationStats.withValidUrls > citationStats.total * 0.5
          ? 'HEALTHY'
          : citationStats.total > 0 && citationStats.withValidUrls > citationStats.total * 0.3
          ? 'DEGRADED'
          : citationStats.total > 0
          ? 'NEEDS_ATTENTION'
          : 'NO_DATA',
        alert: citationStats.total > 10 && citationStats.withValidUrls < citationStats.total * 0.5
          ? `Citation quality below 50% (${qualityRate})`
          : null
      },
      overall: {
        status: (stuckJobs?.length || 0) === 0 && citationStats.withCitations > citationStats.total * 0.5
          ? 'HEALTHY'
          : 'NEEDS_ATTENTION'
      }
    };

    return new Response(JSON.stringify(healthStatus, null, 2), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('❌ Health check error:', error);
    return new Response(JSON.stringify({
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
