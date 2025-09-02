import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ORIGIN = Deno.env.get("APP_ORIGIN") ?? "https://llumos.app";

const corsHeaders = {
  'Access-Control-Allow-Origin': ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const openaiKey = Deno.env.get('OPENAI_API_KEY')!;
  
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { orgId, brandName } = await req.json();

    if (!orgId || !brandName) {
      return new Response(JSON.stringify({ error: 'Missing orgId or brandName' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Enriching brand data for: ${brandName} (org: ${orgId})`);

    // Get organization context
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('name, business_description, domain')
      .eq('id', orgId)
      .single();

    if (orgError) {
      console.error('Error fetching organization:', orgError);
      return new Response(JSON.stringify({ error: 'Organization not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Use OpenAI to generate brand variants and additional info
    const prompt = `Generate brand name variants and information for "${brandName}".
    
Organization context:
- Company: ${org.name}
- Business: ${org.business_description || 'Not specified'}
- Domain: ${org.domain}

Please provide:
1. Alternative spellings and common variations
2. Potential abbreviations or acronyms
3. Related product/service names
4. Common misspellings
5. International variants

Format as JSON with this structure:
{
  "variants": ["variant1", "variant2", ...],
  "aliases": ["alias1", "alias2", ...],
  "products": ["product1", "product2", ...],
  "description": "Brief description of what this brand/company does",
  "confidence": 0.95
}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a brand research expert. Generate comprehensive brand variant lists in valid JSON format only.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 1000
      }),
    });

    if (!response.ok) {
      console.error('OpenAI API error:', response.statusText);
      throw new Error('Failed to generate brand variants');
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices[0].message.content;
    
    let enrichmentData;
    try {
      enrichmentData = JSON.parse(content);
    } catch (parseError) {
      console.error('Failed to parse AI response:', content);
      // Fallback to basic variants
      enrichmentData = {
        variants: [brandName.toLowerCase(), brandName.toUpperCase()],
        aliases: [],
        products: [],
        description: `Brand or company: ${brandName}`,
        confidence: 0.5
      };
    }

    // Combine all variants
    const allVariants = [
      brandName,
      ...enrichmentData.variants || [],
      ...enrichmentData.aliases || [],
      ...enrichmentData.products || []
    ].filter((v, i, arr) => arr.indexOf(v) === i); // Remove duplicates

    // Update brand catalog entry
    const { data: existingBrand } = await supabase
      .from('brand_catalog')
      .select('*')
      .eq('org_id', orgId)
      .eq('name', brandName)
      .single();

    if (existingBrand) {
      // Update existing brand
      const { error: updateError } = await supabase
        .from('brand_catalog')
        .update({
          variants_json: allVariants,
          last_seen_at: new Date().toISOString()
        })
        .eq('id', existingBrand.id);

      if (updateError) {
        console.error('Error updating brand:', updateError);
        throw new Error('Failed to update brand data');
      }
    } else {
      // Create new brand entry
      const { error: insertError } = await supabase
        .from('brand_catalog')
        .insert({
          org_id: orgId,
          name: brandName,
          is_org_brand: true, // Assume this is the user's brand
          variants_json: allVariants,
          first_detected_at: new Date().toISOString(),
          last_seen_at: new Date().toISOString()
        });

      if (insertError) {
        console.error('Error inserting brand:', insertError);
        throw new Error('Failed to create brand entry');
      }
    }

    return new Response(JSON.stringify({
      success: true,
      brandName,
      variants: allVariants,
      description: enrichmentData.description,
      confidence: enrichmentData.confidence
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in brand-enrich:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});