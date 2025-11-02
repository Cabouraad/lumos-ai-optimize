import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { corsHeaders } from '../_shared/cors.ts';

/**
 * Google AI Overview fetcher using SerpAPI
 * Fetches AI Overview results from Google Search
 */

interface AioRequest {
  query: string;
  gl?: string;  // Geographic location (country code)
  hl?: string;  // Language
  dry_run?: boolean;  // Check if feature is enabled without making API call
}

interface AioResult {
  summary: string;
  references: Array<{
    title?: string;
    link: string;
    domain?: string;
    source?: string;
    index?: number;
  }>;
  follow_up_questions?: string[];
  raw?: any;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SERPAPI_KEY = Deno.env.get('SERPAPI_KEY');
    const ENABLE_GOOGLE_AIO = Deno.env.get('ENABLE_GOOGLE_AIO') === 'true';

    // Parse request
    const body: AioRequest = await req.json();
    
    // Handle dry run check (for availability testing)
    if (body.dry_run) {
      return new Response(
        JSON.stringify({ 
          enabled: ENABLE_GOOGLE_AIO && !!SERPAPI_KEY,
          configured: !!SERPAPI_KEY
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      );
    }

    // Check if feature is enabled and configured
    if (!ENABLE_GOOGLE_AIO || !SERPAPI_KEY) {
      console.log('Google AIO disabled or not configured', {
        enabled: ENABLE_GOOGLE_AIO,
        hasKey: !!SERPAPI_KEY
      });
      return new Response(null, { 
        status: 204,  // No content - feature disabled
        headers: corsHeaders 
      });
    }

    const { query, gl = 'us', hl = 'en' } = body;

    if (!query) {
      return new Response(
        JSON.stringify({ error: 'Query is required' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('[Google AIO] Fetching AI Overview', { query, gl, hl });

    // Call SerpAPI with Google Search engine
    const serpApiUrl = new URL('https://serpapi.com/search.json');
    serpApiUrl.searchParams.set('engine', 'google');
    serpApiUrl.searchParams.set('q', query);
    serpApiUrl.searchParams.set('api_key', SERPAPI_KEY);
    serpApiUrl.searchParams.set('gl', gl);
    serpApiUrl.searchParams.set('hl', hl);
    serpApiUrl.searchParams.set('no_cache', 'false'); // Use cache to save quota

    const response = await fetch(serpApiUrl.toString());

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Google AIO] SerpAPI error:', {
        status: response.status,
        error: errorText
      });
      throw new Error(`SerpAPI error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    // Check if AI Overview is present
    if (!data.ai_overview) {
      console.log('[Google AIO] No AI Overview in response');
      return new Response(
        JSON.stringify({ 
          summary: '',
          references: [],
          raw: data 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const aiOverview = data.ai_overview;
    
    // Extract summary text from text_blocks
    let summary = '';
    if (aiOverview.text_blocks && Array.isArray(aiOverview.text_blocks)) {
      summary = aiOverview.text_blocks
        .map((block: any) => {
          if (block.type === 'paragraph' || block.type === 'heading') {
            return block.snippet || '';
          }
          if (block.type === 'list' && block.list) {
            return block.list.map((item: any) => item.snippet || '').join(' ');
          }
          return '';
        })
        .filter(Boolean)
        .join(' ')
        .trim();
    }

    // Extract references
    const references = (aiOverview.references || []).map((ref: any) => ({
      title: ref.title,
      link: ref.link,
      source: ref.source,
      domain: extractDomain(ref.link),
      index: ref.index
    }));

    const result: AioResult = {
      summary,
      references,
      follow_up_questions: data.related_questions?.map((q: any) => q.question) || [],
      raw: aiOverview
    };

    console.log('[Google AIO] Success', {
      summaryLength: summary.length,
      referencesCount: references.length
    });

    return new Response(
      JSON.stringify(result),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('[Google AIO] Error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        summary: '',
        references: []
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

/**
 * Extract domain from URL
 */
function extractDomain(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return 'unknown';
  }
}
