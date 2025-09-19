import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const SERPAPI_KEY = Deno.env.get('SERPAPI_KEY');
const ENABLE_GOOGLE_AIO = Deno.env.get('ENABLE_GOOGLE_AIO') === 'true';
const CRON_SECRET = Deno.env.get('CRON_SECRET');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AioResult {
  summary: string;
  citations: Array<{
    title?: string;
    link: string;
    domain?: string;
  }>;
  follow_up_questions?: string[];
  raw?: unknown;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Check if Google AIO is enabled
    if (!ENABLE_GOOGLE_AIO || !SERPAPI_KEY) {
      console.log('Google AIO disabled or SERPAPI_KEY missing');
      return new Response(null, { 
        status: 204, 
        headers: corsHeaders 
      });
    }

    // Validate authorization
    const auth = req.headers.get('authorization') || '';
    const isCronRequest = auth === `Bearer ${CRON_SECRET}` && CRON_SECRET;
    
    if (!isCronRequest && !auth.startsWith('Bearer ')) {
      return new Response('Unauthorized', { 
        status: 401, 
        headers: corsHeaders 
      });
    }

    // For non-cron requests, validate user authentication
    if (!isCronRequest) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey, {
        global: { headers: { Authorization: auth } }
      });

      const { data: { user }, error } = await supabase.auth.getUser();
      if (error || !user) {
        return new Response('Unauthorized', { 
          status: 401, 
          headers: corsHeaders 
        });
      }
    }

    const { query, gl = 'us', hl = 'en' } = await req.json();
    
    if (!query || typeof query !== 'string') {
      return new Response('Missing or invalid query', { 
        status: 400, 
        headers: corsHeaders 
      });
    }

    console.log(`Fetching Google AIO for query: "${query.substring(0, 50)}..."`);

    // Call SerpApi for Google AI Overviews
    const url = new URL('https://serpapi.com/search');
    url.searchParams.set('engine', 'google');
    url.searchParams.set('q', query);
    url.searchParams.set('gl', gl);
    url.searchParams.set('hl', hl);
    url.searchParams.set('api_key', SERPAPI_KEY!);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'User-Agent': 'Llumos-AIO-Bot/1.0'
      }
    });

    if (!response.ok) {
      console.error(`SerpApi error: ${response.status} ${response.statusText}`);
      return new Response('AIO upstream error', { 
        status: 502, 
        headers: corsHeaders 
      });
    }

    const data = await response.json();
    console.log('SerpApi response received, processing...');

    // Extract AI Overview from response
    const aiOverview = data?.ai_overview;
    
    if (!aiOverview) {
      console.log('No AI Overview found in response');
      return new Response(JSON.stringify({
        summary: '',
        citations: [],
        follow_up_questions: [],
        raw: data
      }), {
        headers: { ...corsHeaders, 'content-type': 'application/json' }
      });
    }

    // Normalize citations
    const citations = (aiOverview.citations || []).map((c: any) => {
      const link = c.link || c.url || '';
      let domain = '';
      
      if (link) {
        try {
          const urlObj = new URL(link);
          domain = urlObj.hostname.replace(/^www\./, '');
        } catch {
          domain = link.replace(/^https?:\/\/(www\.)?/, '').split('/')[0];
        }
      }
      
      return {
        title: c.title || c.snippet || '',
        link,
        domain
      };
    }).filter((c: any) => c.link); // Only include citations with valid links

    // Build result payload
    const payload: AioResult = {
      summary: aiOverview.text || aiOverview.answer || aiOverview.snippet || '',
      citations,
      follow_up_questions: aiOverview.follow_up_questions || aiOverview.related_questions || [],
      raw: data
    };

    console.log(`AIO result: ${payload.citations.length} citations, summary length: ${payload.summary.length}`);

    return new Response(JSON.stringify(payload), {
      headers: { ...corsHeaders, 'content-type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in fetch-google-aio function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      summary: '',
      citations: [],
      follow_up_questions: []
    }), {
      status: 500,
      headers: { ...corsHeaders, 'content-type': 'application/json' }
    });
  }
});