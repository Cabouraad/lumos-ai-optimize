import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { corsHeaders } from '../_shared/cors.ts';

/**
 * Google AI Overview fetcher using SerpAPI
 * Two-step process:
 * 1. Call Google Search API to get ai_overview.page_token
 * 2. Call Google AI Overview API with the page_token to get full content
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

    console.log('[Google AIO] Step 1: Fetching Google Search to get page_token', { query, gl, hl });

    // STEP 1: Call Google Search API to get the ai_overview.page_token
    const googleSearchUrl = new URL('https://serpapi.com/search.json');
    googleSearchUrl.searchParams.set('engine', 'google');
    googleSearchUrl.searchParams.set('q', query);
    googleSearchUrl.searchParams.set('api_key', SERPAPI_KEY);
    googleSearchUrl.searchParams.set('gl', gl);
    googleSearchUrl.searchParams.set('hl', hl);

    const searchResponse = await fetch(googleSearchUrl.toString());

    if (!searchResponse.ok) {
      const errorText = await searchResponse.text();
      console.error('[Google AIO] Google Search API error:', {
        status: searchResponse.status,
        error: errorText
      });
      throw new Error(`SerpAPI Google Search error: ${searchResponse.status} - ${errorText}`);
    }

    const searchData = await searchResponse.json();
    
    console.log('[Google AIO] Google Search response keys:', Object.keys(searchData));
    
    // Check if ai_overview exists and has page_token
    const pageToken = searchData.ai_overview?.page_token;
    
    if (!pageToken) {
      console.log('[Google AIO] No page_token found in Google Search response', {
        hasAiOverview: !!searchData.ai_overview,
        aiOverviewKeys: searchData.ai_overview ? Object.keys(searchData.ai_overview) : []
      });
      
      // Return empty result if no AI Overview available for this query
      return new Response(
        JSON.stringify({ 
          summary: '',
          citations: [],
          raw: null,
          debug: {
            hasAiOverview: !!searchData.ai_overview,
            responseKeys: Object.keys(searchData)
          }
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('[Google AIO] Step 2: Fetching AI Overview with page_token');

    // STEP 2: Call Google AI Overview API with the page_token
    // page_token expires within 1 minute, so we call immediately
    const aioUrl = new URL('https://serpapi.com/search.json');
    aioUrl.searchParams.set('engine', 'google_ai_overview');
    aioUrl.searchParams.set('page_token', pageToken);
    aioUrl.searchParams.set('api_key', SERPAPI_KEY);

    const aioResponse = await fetch(aioUrl.toString());

    if (!aioResponse.ok) {
      const errorText = await aioResponse.text();
      console.error('[Google AIO] AI Overview API error:', {
        status: aioResponse.status,
        error: errorText
      });
      throw new Error(`SerpAPI AI Overview error: ${aioResponse.status} - ${errorText}`);
    }

    const aioData = await aioResponse.json();
    
    console.log('[Google AIO] AI Overview response keys:', Object.keys(aioData));

    // Extract AI Overview content from the response
    const aiOverview = aioData.ai_overview || aioData;
    
    console.log('[Google AIO] AI Overview content keys:', Object.keys(aiOverview));

    // Extract summary text - handle multiple formats
    let summary = '';
    
    // Format 1: text_blocks array
    if (aiOverview.text_blocks && Array.isArray(aiOverview.text_blocks)) {
      summary = aiOverview.text_blocks
        .map((block: any) => {
          if (block.type === 'paragraph' || block.type === 'heading') {
            return block.snippet || block.text || '';
          }
          if (block.type === 'list' && block.list) {
            return block.list.map((item: any) => item.snippet || item.text || '').join(' ');
          }
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

    // Format 3: answer field
    if (!summary && aiOverview.answer) {
      summary = aiOverview.answer;
    }

    // Extract references/citations
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

    // Extract follow-up questions from the search response
    const followUpQuestions = searchData.related_questions?.map((q: any) => q.question) || [];

    const result: AioResult = {
      summary,
      citations,
      follow_up_questions: followUpQuestions,
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
