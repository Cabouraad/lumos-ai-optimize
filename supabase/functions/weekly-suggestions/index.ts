import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CRON_SECRET = Deno.env.get('CRON_SECRET');

const ORIGIN = Deno.env.get("APP_ORIGIN") ?? "https://llumos.app";

const corsHeaders = {
  'Access-Control-Allow-Origin': ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Verify cron secret for security
  const authHeader = req.headers.get('Authorization');
  const cronSecret = req.headers.get('x-cron-secret');
  
  if (!authHeader && (!cronSecret || !CRON_SECRET || cronSecret !== CRON_SECRET)) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }), 
      { status: 401, headers: corsHeaders }
    );
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    console.log('Starting weekly suggestion generation...');

    // Get all organizations
    const { data: orgs } = await supabase
      .from('organizations')
      .select('id, name, domain');

    if (!orgs || orgs.length === 0) {
      console.log('No organizations found');
      return new Response(JSON.stringify({ message: 'No organizations to process' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let totalSuggestions = 0;

    for (const org of orgs) {
      try {
        const result = await generateSuggestions(org.id, org.name, org.domain, supabase);
        
        if (result.success) {
          totalSuggestions += result.suggestionsCreated;
          console.log(`Generated ${result.suggestionsCreated} suggestions for org ${org.id}`);
        } else {
          console.error(`Failed to generate suggestions for org ${org.id}: ${result.error}`);
        }

      } catch (orgError) {
        console.error(`Error processing org ${org.id}:`, orgError);
      }
    }

    console.log(`Weekly suggestion generation completed. Total suggestions: ${totalSuggestions}`);

    return new Response(JSON.stringify({ 
      success: true, 
      totalSuggestions,
      message: `Generated suggestions for ${orgs.length} organizations`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Weekly suggestions error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function generateSuggestions(orgId: string, orgName: string, domain: string, supabase: any) {
  try {
    const suggestions: Array<{ text: string; source: string }> = [];

    // Get recent gaps (prompts where org absent or score < 50)
    const { data: recentResults } = await supabase
      .from('visibility_results')
      .select(`
        score,
        org_brand_present,
        prompt_runs!inner (
          prompts!inner (
            text,
            org_id
          )
        )
      `)
      .eq('prompt_runs.prompts.org_id', orgId)
      .gte('prompt_runs.run_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .or('org_brand_present.eq.false,score.lt.50');

    // Industry-based suggestions
    const industrySuggestions = [
      `What are the best tools for ${domain} industry?`,
      `Top companies in ${domain} space`,
      `${domain} market leaders comparison`,
      `Best software for ${domain} businesses`,
      `${domain} industry trends and predictions`
    ];

    industrySuggestions.forEach((text: any) => {
      suggestions.push({ text, source: 'industry' });
    });

    // Keyword-based suggestions (generic business terms)
    const keywordSuggestions = [
      'Best project management software',
      'Top CRM solutions for small business',
      'Business automation tools comparison',
      'Customer support software reviews',
      'Marketing analytics platforms'
    ];

    keywordSuggestions.forEach((text: any) => {
      suggestions.push({ text, source: 'keywords' });
    });

    // Competitor-based suggestions
    const competitorSuggestions = [
      `Alternatives to popular ${domain} tools`,
      `${orgName} vs competitors comparison`,
      `Best alternatives in ${domain} market`,
      `${domain} software comparison guide`
    ];

    competitorSuggestions.forEach((text: any) => {
      suggestions.push({ text, source: 'competitors' });
    });

    // Gap-based suggestions (from recent poor performance)
    if (recentResults && recentResults.length > 0) {
      const gapSuggestions = [
        `Why choose ${orgName} over alternatives?`,
        `${orgName} unique features and benefits`,
        `${orgName} customer success stories`,
        `How ${orgName} solves ${domain} challenges`
      ];

      gapSuggestions.forEach((text: any) => {
        suggestions.push({ text, source: 'gap' });
      });
    }

    // Limit to 20 suggestions and insert
    const limitedSuggestions = suggestions.slice(0, 20);
    
    if (limitedSuggestions.length > 0) {
      const { error } = await supabase
        .from('suggested_prompts')
        .insert(
          limitedSuggestions.map(suggestion => ({
            org_id: orgId,
            text: suggestion.text,
            source: suggestion.source,
            accepted: false
          }))
        );

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, suggestionsCreated: limitedSuggestions.length };
    }

    return { success: true, suggestionsCreated: 0 };

  } catch (error: any) {
    return { success: false, error: error.message };
  }
}