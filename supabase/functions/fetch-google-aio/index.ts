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
  citations: Array<{
    title?: string;
    link: string;
    domain?: string;
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
    const ENABLE_GOOGLE_AIO = Deno.env.get('ENABLE_GOOGLE_AIO');

    console.log('[Google AIO] Config check:', {
      hasKey: !!SERPAPI_KEY,
      enabledRaw: ENABLE_GOOGLE_AIO,
      enabledParsed: ENABLE_GOOGLE_AIO === 'true'
    });

    // Parse request
    const body: AioRequest = await req.json();
    
    // Handle dry run check (for availability testing)
    if (body.dry_run) {
      return new Response(
        JSON.stringify({ 
          enabled: ENABLE_GOOGLE_AIO === 'true' && !!SERPAPI_KEY,
          configured: !!SERPAPI_KEY
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      );
    }

    // Check if feature is enabled and configured
    if (ENABLE_GOOGLE_AIO !== 'true' || !SERPAPI_KEY) {
      console.log('[Google AIO] Feature disabled or not configured', {
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
    
    // Log available keys in response for debugging
    console.log('[Google AIO] Response keys:', Object.keys(data));
    
    // Check for AI Overview in multiple possible locations
    // SerpAPI may use different field names depending on the query/response
    const aiOverview = data.ai_overview || data.ai_overviews || data.featured_snippet || data.answer_box;
    
    if (!aiOverview) {
      console.log('[Google AIO] No AI Overview found in response. Available keys:', Object.keys(data));
      
      // Log if we have organic results but no AIO
      if (data.organic_results?.length > 0) {
        console.log('[Google AIO] Has organic results but no AI Overview');
      }
      
      return new Response(
        JSON.stringify({ 
          summary: '',
          citations: [],
          raw: null,
          debug: {
            hasOrganicResults: !!data.organic_results?.length,
            responseKeys: Object.keys(data)
          }
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('[Google AIO] AI Overview found, keys:', Object.keys(aiOverview));
    
    // Extract summary text - handle multiple formats
    let summary = '';
    
    // Format 1: text_blocks array (newer format)
    if (aiOverview.text_blocks && Array.isArray(aiOverview.text_blocks)) {
      summary = aiOverview.text_blocks
        .map((block: any) => {
          if (block.type === 'paragraph' || block.type === 'heading') {
            return block.snippet || block.text || '';
          }
          if (block.type === 'list' && block.list) {
            return block.list.map((item: any) => item.snippet || item.text || '').join(' ');
          }
          // Handle generic blocks
          if (block.snippet || block.text) {
            return block.snippet || block.text;
          }
          return '';
        })
        .filter(Boolean)
        .join(' ')
        .trim();
    }
    
    // Format 2: Direct snippet/text field
    if (!summary && (aiOverview.snippet || aiOverview.text)) {
      summary = aiOverview.snippet || aiOverview.text || '';
    }
    
    // Format 3: Answer field (answer_box format)
    if (!summary && aiOverview.answer) {
      summary = aiOverview.answer;
    }
    
    // Format 4: Contents array
    if (!summary && aiOverview.contents && Array.isArray(aiOverview.contents)) {
      summary = aiOverview.contents
        .map((c: any) => c.text || c.snippet || '')
        .filter(Boolean)
        .join(' ')
        .trim();
    }

    // Extract references/citations - handle multiple formats
    let citations: Array<{title?: string; link: string; domain?: string; index?: number}> = [];
    
    // Format 1: references array
    if (aiOverview.references && Array.isArray(aiOverview.references)) {
      citations = aiOverview.references.map((ref: any) => ({
        title: ref.title,
        link: ref.link || ref.url,
        domain: extractDomain(ref.link || ref.url || ''),
        index: ref.index
      })).filter((c: any) => c.link);
    }
    
    // Format 2: sources array
    if (citations.length === 0 && aiOverview.sources && Array.isArray(aiOverview.sources)) {
      citations = aiOverview.sources.map((src: any, idx: number) => ({
        title: src.title || src.name,
        link: src.link || src.url,
        domain: extractDomain(src.link || src.url || ''),
        index: idx + 1
      })).filter((c: any) => c.link);
    }
    
    // Format 3: link field (answer_box format)
    if (citations.length === 0 && aiOverview.link) {
      citations = [{
        title: aiOverview.title,
        link: aiOverview.link,
        domain: extractDomain(aiOverview.link)
      }];
    }

    const result: AioResult = {
      summary,
      citations,
      follow_up_questions: data.related_questions?.map((q: any) => q.question) || [],
      raw: aiOverview
    };

    console.log('[Google AIO] Success', {
      summaryLength: summary.length,
      citationsCount: citations.length,
      hasSummary: !!summary
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
        citations: []
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
  if (!url) return 'unknown';
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return 'unknown';
  }
}
