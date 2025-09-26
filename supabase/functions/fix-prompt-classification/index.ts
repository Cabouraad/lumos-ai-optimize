import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";

const ORIGIN = Deno.env.get("APP_ORIGIN") ?? "https://llumos.app";

const corsHeaders = {
  'Access-Control-Allow-Origin': ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { responseId, setOrgBrandPresent, removeCompetitors = [], addOrgBrands = [] } = await req.json();
    
    console.log('=== FIX PROMPT CLASSIFICATION START ===');
    console.log('Response ID:', responseId);
    console.log('Set org brand present:', setOrgBrandPresent);
    console.log('Remove competitors:', removeCompetitors);
    console.log('Add org brands:', addOrgBrands);

    if (!responseId) {
      return new Response(
        JSON.stringify({ error: 'Missing responseId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase with service role to bypass RLS
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the response first
    const { data: response, error: fetchError } = await supabase
      .from('prompt_provider_responses')
      .select('*')
      .eq('id', responseId)
      .single();

    if (fetchError || !response) {
      console.error('Error fetching response:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Response not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the prompt to verify org access
    const { data: prompt, error: promptError } = await supabase
      .from('prompts')
      .select('org_id')
      .eq('id', response.prompt_id)
      .single();

    if (promptError || !prompt) {
      console.error('Error fetching prompt:', promptError);
      return new Response(
        JSON.stringify({ error: 'Prompt not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user belongs to the same org
    const authHeader = req.headers.get('authorization');
    if (authHeader) {
      const userSupabase = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
        global: { headers: { authorization: authHeader } }
      });
      
      const { data: { user } } = await userSupabase.auth.getUser();
      if (user) {
        const { data: userData } = await supabase
          .from('users')
          .select('org_id')
          .eq('id', user.id)
          .single();
        
        if (!userData || userData.org_id !== prompt.org_id) {
          return new Response(
            JSON.stringify({ error: 'Access denied' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    // Fetch organization info
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('name, domain')
      .eq('id', prompt.org_id)
      .single();
    if (orgError) {
      console.error('Error fetching organization:', orgError);
    }

    // Apply fixes
    let updatedCompetitors = response.competitors_json || [];
    let updatedBrands = response.brands_json || [];
    let orgBrandPresent = response.org_brand_present;
    let orgBrandProminence = response.org_brand_prominence;
    let newScore = response.score;

    // Remove specified competitors
    if (removeCompetitors.length > 0) {
      updatedCompetitors = updatedCompetitors.filter((competitor: string) => 
        !removeCompetitors.some((toRemove: string) => 
          competitor.toLowerCase().includes(toRemove.toLowerCase())
        )
      );
    }

    // Add org brands
    if (addOrgBrands.length > 0) {
      updatedBrands = [...new Set([...updatedBrands, ...addOrgBrands])];
    }

    // Set org brand presence
    if (setOrgBrandPresent !== undefined) {
      orgBrandPresent = setOrgBrandPresent;
      if (setOrgBrandPresent && !orgBrandProminence) {
        orgBrandProminence = 1; // Default to first position
      }
    }

    // Ensure org brand is present in brands list when marked present
    if (orgBrandPresent && org) {
      const candidates: string[] = [];
      if (org.name) candidates.push(String(org.name));
      if (org.domain) {
        const domainBase = String(org.domain).replace(/\..*$/, '');
        candidates.push(domainBase, String(org.domain));
      }
      if (candidates.length > 0) {
        updatedBrands = [...new Set([...updatedBrands, ...candidates])];
      }
    }

    // Recalculate score
    if (orgBrandPresent) {
      newScore = 6.0; // Base score for brand presence
      
      // Position bonus
      if (orgBrandProminence === 1) newScore += 1.5;
      else if (orgBrandProminence === 2) newScore += 1.0;
      else if (orgBrandProminence === 3) newScore += 0.5;
      
      // Competition penalty (max -2.0)
      const competitorPenalty = Math.min(2.0, updatedCompetitors.length * 0.3);
      newScore = Math.max(3.0, newScore - competitorPenalty);
    } else {
      newScore = Math.max(0, Math.min(2.0, 5.0 - (updatedCompetitors.length * 0.2)));
    }

    // Ensure score is within bounds
    newScore = Math.max(0, Math.min(10, newScore));

    // Update the response
    const { error: updateError } = await supabase
      .from('prompt_provider_responses')
      .update({
        org_brand_present: orgBrandPresent,
        org_brand_prominence: orgBrandProminence,
        competitors_json: updatedCompetitors,
        competitors_count: updatedCompetitors.length,
        brands_json: updatedBrands,
        score: Math.round(newScore * 10) / 10,
        metadata: {
          ...response.metadata,
          manual_fix_applied: true,
          original_score: response.score,
          original_competitors_count: response.competitors_count,
          original_org_brand_present: response.org_brand_present,
          fix_applied_at: new Date().toISOString(),
          fix_changes: {
            competitors_removed: removeCompetitors,
            org_brands_added: addOrgBrands,
            org_brand_set: setOrgBrandPresent
          }
        }
      })
      .eq('id', responseId);

    if (updateError) {
      console.error('Error updating response:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update response' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Classification fix applied successfully');
    
    return new Response(
      JSON.stringify({
        success: true,
        changes: {
          scoreChange: `${response.score} → ${Math.round(newScore * 10) / 10}`,
          competitorsRemoved: removeCompetitors.length,
          orgBrandsAdded: addOrgBrands.length,
          orgBrandPresent,
          newCompetitorCount: updatedCompetitors.length
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('=== FIX CLASSIFICATION ERROR ===', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});