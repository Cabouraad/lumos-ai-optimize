import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Fetch Google Trends interest for a query via SerpAPI
async function getGoogleTrendsInterest(query: string, serpApiKey: string): Promise<number | null> {
  try {
    const params = new URLSearchParams({
      engine: 'google_trends',
      q: query,
      api_key: serpApiKey,
      data_type: 'TIMESERIES',
      date: 'today 3-m',
    });
    
    const response = await fetch(`https://serpapi.com/search.json?${params}`);
    if (!response.ok) {
      console.warn(`Google Trends API error for "${query}": ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    const timelineData = data.interest_over_time?.timeline_data || [];
    if (timelineData.length === 0) return null;
    
    const values = timelineData
      .map((item: any) => item.values?.[0]?.extracted_value)
      .filter((v: any) => typeof v === 'number');
    
    if (values.length === 0) return null;
    
    return Math.round(values.reduce((a: number, b: number) => a + b, 0) / values.length);
  } catch (error) {
    console.warn(`Failed to fetch Google Trends for "${query}":`, error);
    return null;
  }
}

// Batch fetch trends data with rate limiting
async function batchGetTrendsData(
  queries: { id: string; text: string }[], 
  serpApiKey: string
): Promise<Map<string, number | null>> {
  const results = new Map<string, number | null>();
  
  const batchSize = 5;
  for (let i = 0; i < queries.length; i += batchSize) {
    const batch = queries.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(q => getGoogleTrendsInterest(q.text, serpApiKey).then(v => ({ id: q.id, value: v })))
    );
    
    batchResults.forEach(({ id, value }) => results.set(id, value));
    
    if (i + batchSize < queries.length) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }
  
  return results;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Parse request body for brandId and limit
    let brandId: string | null = null;
    let limit = 20;
    try {
      const body = await req.json();
      brandId = body?.brandId || null;
      limit = body?.limit || 20;
      console.log('Backfill request - brandId:', brandId, 'limit:', limit);
    } catch (e) {
      console.log('No body provided or parsing failed');
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error('Auth error:', authError);
      throw new Error('Authentication failed');
    }

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('org_id')
      .eq('id', user.id)
      .single();

    if (userError || !userData) {
      console.error('User data error:', userError);
      throw new Error('Could not get user organization');
    }

    // Get suggestions with null search_volume
    let query = supabase
      .from('suggested_prompts')
      .select('id, text')
      .eq('org_id', userData.org_id)
      .is('search_volume', null)
      .limit(limit);
    
    if (brandId) {
      query = query.eq('brand_id', brandId);
    }

    const { data: suggestions, error: suggestionsError } = await query;

    if (suggestionsError) {
      console.error('Error fetching suggestions:', suggestionsError);
      throw new Error('Failed to fetch suggestions');
    }

    if (!suggestions || suggestions.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          updated: 0, 
          message: 'All suggestions already have search volume data' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${suggestions.length} suggestions without search volume`);

    // Fetch Google Trends data
    const serpApiKey = Deno.env.get('SERPAPI_KEY');
    if (!serpApiKey) {
      throw new Error('SERPAPI_KEY not configured');
    }

    console.log(`Fetching Google Trends data for ${suggestions.length} suggestions...`);
    const trendsData = await batchGetTrendsData(suggestions, serpApiKey);
    console.log(`Got trends data for ${trendsData.size} queries`);

    // Update suggestions with search volume
    let updatedCount = 0;
    let fetchedCount = 0;
    
    for (const [suggestionId, volume] of trendsData) {
      if (volume !== null) {
        fetchedCount++;
        const { error: updateError } = await supabase
          .from('suggested_prompts')
          .update({ search_volume: volume })
          .eq('id', suggestionId);

        if (!updateError) {
          updatedCount++;
        } else {
          console.warn(`Failed to update suggestion ${suggestionId}:`, updateError);
        }
      }
    }

    console.log(`Updated ${updatedCount} suggestions with search volume data`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        processed: suggestions.length,
        fetched: fetchedCount,
        updated: updatedCount,
        message: `Updated ${updatedCount} of ${suggestions.length} suggestions with search volume data`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in backfill-search-volume function:', error);
    return new Response(
      JSON.stringify({ 
        error: (error as Error).message || 'Internal server error',
        success: false 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
