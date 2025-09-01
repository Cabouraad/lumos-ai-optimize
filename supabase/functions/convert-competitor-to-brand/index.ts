import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { competitorName, orgId } = await req.json();

    if (!competitorName || !orgId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: competitorName, orgId' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Converting competitor to org brand:', { competitorName, orgId });

    // Get organization details to validate brand name similarity
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('name, domain')
      .eq('id', orgId)
      .single();

    if (orgError || !org) {
      console.error('Organization not found:', orgError);
      return new Response(
        JSON.stringify({ error: 'Organization not found' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Check if competitor name has some similarity to org name or domain
    const orgName = org.name.toLowerCase();
    const orgDomain = org.domain.toLowerCase().replace(/\.(com|org|net|io|co).*$/, '');
    const competitorLower = competitorName.toLowerCase();

    const hasNameSimilarity = competitorLower.includes(orgName.split(' ')[0]) || 
                             orgName.includes(competitorLower.split(' ')[0]) ||
                             competitorLower.includes(orgDomain) ||
                             orgDomain.includes(competitorLower);

    if (!hasNameSimilarity && competitorName.length > 3) {
      // Allow manual override but warn
      console.warn('Competitor name may not match organization:', { competitorName, orgName, orgDomain });
    }

    // Check if this competitor already exists as org brand
    const { data: existingBrand, error: checkError } = await supabase
      .from('brand_catalog')
      .select('id, is_org_brand')
      .eq('org_id', orgId)
      .ilike('name', competitorName)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('Error checking existing brand:', checkError);
      return new Response(
        JSON.stringify({ error: 'Failed to check existing brand' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (existingBrand) {
      if (existingBrand.is_org_brand) {
        return new Response(
          JSON.stringify({ success: true, message: 'Already marked as organization brand' }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      } else {
        // Update existing competitor to be org brand
        const { error: updateError } = await supabase
          .from('brand_catalog')
          .update({ 
            is_org_brand: true,
            last_seen_at: new Date().toISOString()
          })
          .eq('id', existingBrand.id);

        if (updateError) {
          console.error('Error updating brand:', updateError);
          return new Response(
            JSON.stringify({ error: 'Failed to update brand' }),
            { 
              status: 500, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        }
      }
    } else {
      // Create new org brand entry
      const { error: insertError } = await supabase
        .from('brand_catalog')
        .insert({
          org_id: orgId,
          name: competitorName,
          is_org_brand: true,
          variants_json: [],
          first_detected_at: new Date().toISOString(),
          last_seen_at: new Date().toISOString(),
          total_appearances: 1,
          average_score: 8.0 // High score for org brand
        });

      if (insertError) {
        console.error('Error creating org brand:', insertError);
        return new Response(
          JSON.stringify({ error: 'Failed to create organization brand' }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
    }

    // Update recent prompt responses to fix classification
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: responses, error: responseError } = await supabase
      .from('prompt_provider_responses')
      .select('id, competitors_json, brands_json, competitors_count, score, org_brand_present')
      .eq('org_id', orgId)
      .gte('run_at', thirtyDaysAgo.toISOString())
      .eq('status', 'success');

    if (responseError) {
      console.error('Error fetching responses:', responseError);
    } else {
      let updatedCount = 0;
      
      for (const response of responses || []) {
        const competitors = response.competitors_json || [];
        const brands = response.brands_json || [];
        
        // Check if this competitor is in the list
        const competitorIndex = competitors.findIndex((comp: string) => 
          comp.toLowerCase() === competitorName.toLowerCase()
        );

        if (competitorIndex !== -1) {
          // Remove from competitors, add to brands if not already there
          const updatedCompetitors = competitors.filter((_: any, idx: number) => idx !== competitorIndex);
          const updatedBrands = brands.includes(competitorName) ? brands : [...brands, competitorName];
          
          // Calculate new score (higher because org brand found)
          const newScore = response.org_brand_present ? response.score : Math.min(10, response.score + 3);
          
          const { error: updateResponseError } = await supabase
            .from('prompt_provider_responses')
            .update({
              competitors_json: updatedCompetitors,
              brands_json: updatedBrands,
              competitors_count: updatedCompetitors.length,
              org_brand_present: true,
              org_brand_prominence: 1, // Assume good position
              score: newScore,
              metadata: {
                ...(response.metadata || {}),
                competitor_converted_to_brand: true,
                converted_competitor: competitorName,
                converted_at: new Date().toISOString()
              }
            })
            .eq('id', response.id);

          if (!updateResponseError) {
            updatedCount++;
          }
        }
      }

      console.log(`Updated ${updatedCount} responses after competitor conversion`);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Successfully converted "${competitorName}" to organization brand`,
        warning: !hasNameSimilarity ? 'Brand name may not closely match organization name' : undefined
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in convert-competitor-to-brand:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});