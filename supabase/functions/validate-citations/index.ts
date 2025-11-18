import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { responseId } = await req.json();

    if (!responseId) {
      throw new Error('responseId is required');
    }

    console.log(`[Citation Validation] Starting for response: ${responseId}`);

    // Fetch the response with citations
    const { data: response, error: fetchError } = await supabaseClient
      .from('prompt_provider_responses')
      .select('id, citations_json, org_id')
      .eq('id', responseId)
      .single();

    if (fetchError || !response) {
      throw new Error(`Failed to fetch response: ${fetchError?.message}`);
    }

    if (!response.citations_json || !response.citations_json.citations) {
      console.log('[Citation Validation] No citations to validate');
      return new Response(
        JSON.stringify({ message: 'No citations to validate', validated: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update status to validating
    await supabaseClient
      .from('prompt_provider_responses')
      .update({ citations_validation_status: 'validating' })
      .eq('id', responseId);

    const citations = response.citations_json.citations;
    console.log(`[Citation Validation] Validating ${citations.length} citations`);

    // Validate each citation URL
    const validatedCitations = await Promise.all(
      citations.map(async (citation: any) => {
        try {
          // Attempt HEAD request to check if URL is accessible
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

          const urlResponse = await fetch(citation.url, {
            method: 'HEAD',
            signal: controller.signal,
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; CitationValidator/1.0)',
            },
          });

          clearTimeout(timeoutId);

          const isAccessible = urlResponse.status >= 200 && urlResponse.status < 400;
          
          console.log(`[Citation Validation] ${citation.url} - Status: ${urlResponse.status}, Accessible: ${isAccessible}`);

          return {
            ...citation,
            is_accessible: isAccessible,
            validation_status_code: urlResponse.status,
            validated_at: new Date().toISOString(),
          };
        } catch (error) {
          console.warn(`[Citation Validation] Failed to validate ${citation.url}:`, error.message);
          return {
            ...citation,
            is_accessible: false,
            validation_status_code: 0,
            validation_error: error.message,
            validated_at: new Date().toISOString(),
          };
        }
      })
    );

    // Filter out inaccessible citations
    const accessibleCount = validatedCitations.filter(c => c.is_accessible).length;
    const filteredCitations = validatedCitations.filter(c => c.is_accessible);

    console.log(`[Citation Validation] Accessible: ${accessibleCount}/${citations.length}`);

    // Update citations with validation data
    const updatedCitationsJson = {
      ...response.citations_json,
      citations: filteredCitations,
      validation_metadata: {
        original_count: citations.length,
        validated_count: validatedCitations.length,
        accessible_count: accessibleCount,
        filtered_count: citations.length - accessibleCount,
        validated_at: new Date().toISOString(),
      },
    };

    // Update response with validated citations
    const { error: updateError } = await supabaseClient
      .from('prompt_provider_responses')
      .update({
        citations_json: updatedCitationsJson,
        citations_validation_status: 'completed',
        citations_validated_at: new Date().toISOString(),
      })
      .eq('id', responseId);

    if (updateError) {
      throw new Error(`Failed to update response: ${updateError.message}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        validated: validatedCitations.length,
        accessible: accessibleCount,
        filtered: citations.length - accessibleCount,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[Citation Validation] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
