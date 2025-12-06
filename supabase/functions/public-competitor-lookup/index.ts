import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rate limit: 1 request per IP per day
const RATE_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get client IP for rate limiting
    const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() 
      || req.headers.get('cf-connecting-ip') 
      || req.headers.get('x-real-ip')
      || 'unknown';

    console.log(`[public-competitor-lookup] Request from IP: ${clientIP}`);

    // Check rate limit using analytics_events table
    const rateLimitKey = `competitor_lookup_${clientIP}`;
    const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
    
    const { data: recentRequests, error: rateLimitError } = await supabase
      .from('analytics_events')
      .select('id')
      .eq('event_name', 'competitor_lookup_request')
      .eq('ip_address', clientIP)
      .gte('created_at', windowStart)
      .limit(1);

    if (rateLimitError) {
      console.error('Rate limit check error:', rateLimitError);
    }

    if (recentRequests && recentRequests.length > 0) {
      console.log(`[Rate Limited] IP ${clientIP} already made a request in the last 24 hours`);
      return new Response(
        JSON.stringify({ 
          error: 'Rate limit exceeded',
          message: 'You can only use this tool once per day. Sign up for unlimited competitor tracking!',
          retryAfter: '24 hours'
        }),
        { 
          status: 429, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Parse request body
    const { url } = await req.json();
    
    if (!url || typeof url !== 'string') {
      return new Response(
        JSON.stringify({ error: 'URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract domain from URL
    let domain: string;
    try {
      const parsedUrl = new URL(url.startsWith('http') ? url : `https://${url}`);
      domain = parsedUrl.hostname.replace(/^www\./, '');
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid URL format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[public-competitor-lookup] Analyzing domain: ${domain}`);

    // Record the request for rate limiting
    await supabase.from('analytics_events').insert({
      event_name: 'competitor_lookup_request',
      ip_address: clientIP,
      event_properties: { domain },
      page_url: url
    });

    // Use Lovable AI to find competitors
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const prompt = `Analyze the website/brand "${domain}" and identify the top 3 direct competitors in their industry.

Return ONLY a JSON object with this exact structure:
{
  "brandName": "The brand name for ${domain}",
  "industry": "Brief industry description (2-3 words)",
  "competitors": [
    { "name": "Competitor 1 Name", "reason": "Brief 10-word reason why they compete" },
    { "name": "Competitor 2 Name", "reason": "Brief 10-word reason why they compete" },
    { "name": "Competitor 3 Name", "reason": "Brief 10-word reason why they compete" }
  ]
}

Only return real, well-known competitor brands. No generic terms. Be specific.`;

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'You are a business intelligence expert. Return only valid JSON, no markdown or explanation.' },
          { role: 'user', content: prompt }
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI Gateway error:', aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Service temporarily busy. Please try again in a moment.' }),
          { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`AI Gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No response from AI');
    }

    // Parse the JSON response
    let competitorData;
    try {
      // Clean up potential markdown code blocks
      const cleanedContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      competitorData = JSON.parse(cleanedContent);
    } catch (parseError) {
      console.error('Failed to parse AI response:', content);
      throw new Error('Failed to parse competitor data');
    }

    // Validate and sanitize the response
    if (!competitorData.competitors || !Array.isArray(competitorData.competitors)) {
      throw new Error('Invalid competitor data structure');
    }

    // Limit to top 3
    const topCompetitors = competitorData.competitors.slice(0, 3).map((c: any) => ({
      name: String(c.name || '').slice(0, 100),
      reason: String(c.reason || '').slice(0, 150)
    }));

    const result = {
      success: true,
      domain,
      brandName: String(competitorData.brandName || domain).slice(0, 100),
      industry: String(competitorData.industry || 'Unknown').slice(0, 50),
      competitors: topCompetitors,
      timestamp: new Date().toISOString()
    };

    console.log(`[public-competitor-lookup] Found ${topCompetitors.length} competitors for ${domain}`);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('[public-competitor-lookup] Error:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Failed to analyze competitors',
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
