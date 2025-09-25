/**
 * Google AI Overviews provider integration for edge functions
 */

export interface GoogleAioResult {
  summary: string;
  citations: Array<{
    title?: string;
    link: string;
    domain?: string;
  }>;
  follow_up_questions?: string[];
  raw?: unknown;
}

/**
 * Execute Google AI Overview query using the fetch-google-aio edge function
 */
export async function executeGoogleAio(
  query: string,
  accessToken: string,
  opts: { gl?: string; hl?: string } = {}
): Promise<GoogleAioResult | null> {
  const ENABLE_GOOGLE_AIO = Deno.env.get('ENABLE_GOOGLE_AIO') === 'true';
  const SERPAPI_KEY = Deno.env.get('SERPAPI_KEY');
  
  if (!ENABLE_GOOGLE_AIO || !SERPAPI_KEY) {
    console.log('Google AIO disabled or not configured');
    return null;
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const response = await fetch(`${supabaseUrl}/functions/v1/fetch-google-aio`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query,
        gl: opts.gl || 'us',
        hl: opts.hl || 'en'
      })
    });

    if (response.status === 204) {
      console.log('Google AIO is disabled');
      return null;
    }

    if (!response.ok) {
      console.error('Google AIO function failed:', response.status);
      return null;
    }

    const result = await response.json();
    return result as GoogleAioResult;
    
  } catch (error: unknown) {
    console.error('Error executing Google AIO:', error);
    return null;
  }
}

/**
 * Extract brand citations from Google AIO result
 */
export function extractAioCitations(aioResult: GoogleAioResult) {
  return aioResult.citations.map((citation: any) => ({
    type: 'url' as const,
    value: citation.link,
    hostname: citation.domain,
    title: citation.title,
    source_provider: 'google_ai_overview' as const
  }));
}

/**
 * Normalize Google AIO result for brand analysis
 */
export function normalizeAioForAnalysis(aioResult: GoogleAioResult) {
  return {
    responseText: aioResult.summary,
    citations: extractAioCitations(aioResult),
    metadata: {
      follow_up_questions: aioResult.follow_up_questions,
      provider: 'google_ai_overview',
      source: 'serp_api'
    }
  };
}