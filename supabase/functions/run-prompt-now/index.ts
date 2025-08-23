
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';
import { corsHeaders } from '../_shared/cors.ts';
import { authenticateUser } from '../_shared/auth.ts';
import { runPromptAgainstProviders } from '../_shared/visibility/runPrompt.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { promptId, orgId } = await req.json();
    console.log('=== run-prompt-now edge function called ===');
    console.log('promptId:', promptId);
    console.log('orgId:', orgId);

    if (!promptId || !orgId) {
      throw new Error('Missing promptId or orgId');
    }

    // Authenticate user
    const user = await authenticateUser(req);
    console.log('Authenticated user:', user.id);

    // Verify user has access to this org
    const { data: userData } = await supabase
      .from('users')
      .select('org_id')
      .eq('id', user.id)
      .single();

    if (!userData || userData.org_id !== orgId) {
      throw new Error('Access denied: User does not belong to this organization');
    }

    // Get the prompt
    const { data: prompt, error: promptError } = await supabase
      .from('prompts')
      .select('*')
      .eq('id', promptId)
      .eq('org_id', orgId)
      .single();

    if (promptError || !prompt) {
      throw new Error(`Prompt not found: ${promptError?.message}`);
    }

    console.log('Found prompt:', prompt.text);

    // Get enabled providers
    const { data: providers } = await supabase
      .from('llm_providers')
      .select('*')
      .eq('enabled', true);

    if (!providers || providers.length === 0) {
      throw new Error('No enabled providers found');
    }

    console.log('Running against providers:', providers.map(p => p.name));

    // Run the prompt against all enabled providers
    const results = await runPromptAgainstProviders(
      supabase,
      orgId,
      promptId,
      prompt.text,
      providers
    );

    console.log('Prompt run results:', results);

    // Process competitor mentions from the results
    if (results && results.length > 0) {
      for (const result of results) {
        if (result.success && result.visibilityResult) {
          const brands = result.visibilityResult.brands_json;
          
          if (Array.isArray(brands) && brands.length > 0) {
            // Process each brand mention
            for (let i = 0; i < brands.length; i++) {
              const brand = brands[i];
              let brandName: string;
              let brandScore: number = 0;
              
              // Handle both old string format and new object format
              if (typeof brand === 'string') {
                brandName = brand;
              } else if (typeof brand === 'object' && brand.brand_name) {
                brandName = brand.brand_name;
                brandScore = brand.score || 0;
              } else {
                continue; // Skip invalid brand entries
              }
              
              // Skip empty brand names
              if (!brandName || brandName.trim().length === 0) {
                continue;
              }
              
              // Upsert competitor mention for this prompt
              try {
                const { error: mentionError } = await supabase.rpc(
                  'upsert_competitor_mention',
                  {
                    p_org_id: orgId,
                    p_prompt_id: promptId,
                    p_competitor_name: brandName.trim(),
                    p_normalized_name: brandName.toLowerCase().trim(),
                    p_position: i, // Position in the response
                    p_sentiment: 'neutral' // Default sentiment
                  }
                );
                
                if (mentionError) {
                  console.error('Error upserting competitor mention:', mentionError);
                }
              } catch (mentionErr) {
                console.error('Exception upserting competitor mention:', mentionErr);
              }
              
              // Also upsert to brand catalog if it's not the org's own brand
              try {
                const { error: brandError } = await supabase.rpc(
                  'upsert_competitor_brand',
                  {
                    p_org_id: orgId,
                    p_brand_name: brandName.trim(),
                    p_score: brandScore
                  }
                );
                
                if (brandError) {
                  console.error('Error upserting competitor brand:', brandError);
                }
              } catch (brandErr) {
                console.error('Exception upserting competitor brand:', brandErr);
              }
            }
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Prompt "${prompt.text}" executed successfully`,
        results: results.map(r => ({
          provider: r.provider,
          success: r.success,
          error: r.error,
          hasVisibilityResult: !!r.visibilityResult
        }))
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('run-prompt-now error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'An unexpected error occurred'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
