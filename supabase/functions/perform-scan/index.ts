import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface KeywordToScan {
  keyword_id: string;
  keyword: string;
  platform: string;
  user_id: string;
  org_id: string;
  subscription_tier: string;
  last_scanned_at: string | null;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[perform-scan] Starting smart scan process...');
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Step 1: Get keywords due for scanning using the RPC function
    const { data: keywordsDue, error: rpcError } = await supabase
      .rpc('get_keywords_due_for_scan', { p_limit: 50 });

    if (rpcError) {
      console.error('[perform-scan] RPC error:', rpcError);
      throw new Error(`Failed to get keywords: ${rpcError.message}`);
    }

    const keywords = keywordsDue as KeywordToScan[];
    console.log(`[perform-scan] Found ${keywords.length} keywords due for scanning`);

    if (keywords.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No keywords due for scanning',
          scanned: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 2: Process each keyword
    const results = {
      scanned: 0,
      failed: 0,
      errors: [] as string[]
    };

    for (const kw of keywords) {
      try {
        console.log(`[perform-scan] Scanning keyword: "${kw.keyword}" (tier: ${kw.subscription_tier})`);

        // Perform the actual scan (placeholder - integrate with your LLM scanning logic)
        const scanResult = await performKeywordScan(kw);

        // Step 3: Record scan result in scan_history
        const { error: insertError } = await supabase
          .from('scan_history')
          .insert({
            keyword_id: kw.keyword_id,
            org_id: kw.org_id,
            score: scanResult.score,
            rank: scanResult.rank,
            competitor_name: scanResult.competitorName,
            raw_response: scanResult.rawResponse,
            metadata: {
              platform: kw.platform,
              subscription_tier: kw.subscription_tier,
              scanned_at: new Date().toISOString()
            }
          });

        if (insertError) {
          console.error(`[perform-scan] Failed to insert scan history:`, insertError);
          results.errors.push(`Insert error for ${kw.keyword}: ${insertError.message}`);
          results.failed++;
          continue;
        }

        // Step 4: CRUCIAL - Update last_scanned_at timestamp
        const { error: updateError } = await supabase
          .from('tracked_keywords')
          .update({ last_scanned_at: new Date().toISOString() })
          .eq('id', kw.keyword_id);

        if (updateError) {
          console.error(`[perform-scan] Failed to update last_scanned_at:`, updateError);
          results.errors.push(`Update error for ${kw.keyword}: ${updateError.message}`);
        }

        results.scanned++;
        console.log(`[perform-scan] Successfully scanned "${kw.keyword}" - Score: ${scanResult.score}`);

      } catch (scanError) {
        console.error(`[perform-scan] Error scanning "${kw.keyword}":`, scanError);
        results.errors.push(`Scan error for ${kw.keyword}: ${String(scanError)}`);
        results.failed++;
      }
    }

    console.log(`[perform-scan] Complete. Scanned: ${results.scanned}, Failed: ${results.failed}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${keywords.length} keywords`,
        results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[perform-scan] Critical error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: String(error) 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

/**
 * Placeholder function for actual keyword scanning logic
 * Replace this with your LLM API calls (ChatGPT, Perplexity, etc.)
 */
async function performKeywordScan(keyword: KeywordToScan): Promise<{
  score: number;
  rank: number | null;
  competitorName: string | null;
  rawResponse: string | null;
}> {
  // TODO: Integrate with your actual LLM scanning logic
  // This is a placeholder that returns mock data
  
  // In production, this would:
  // 1. Call the LLM API with the keyword
  // 2. Parse the response for brand mentions
  // 3. Calculate visibility score
  // 4. Identify top competitor if any
  
  console.log(`[performKeywordScan] Scanning "${keyword.keyword}" on ${keyword.platform}`);
  
  // Simulated delay for API call
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Return placeholder results
  return {
    score: Math.random() * 100, // 0-100 score
    rank: Math.floor(Math.random() * 5) + 1, // 1-5 rank
    competitorName: null,
    rawResponse: null
  };
}
