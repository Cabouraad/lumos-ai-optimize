import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { promptId, orgId } = await req.json();
    console.log('Running single prompt:', { promptId, orgId });

    if (!promptId || !orgId) {
      throw new Error('Missing promptId or orgId');
    }

    // Get prompt
    const { data: prompt } = await supabase
      .from('prompts')
      .select('text')
      .eq('id', promptId)
      .eq('org_id', orgId)
      .single();

    if (!prompt) {
      throw new Error('Prompt not found');
    }

    // Get organization info for brand analysis
    const { data: org } = await supabase
      .from('organizations')
      .select('name')
      .eq('id', orgId)
      .maybeSingle();
    const orgName = org?.name || '';


    // Get enabled providers
    const { data: providers } = await supabase
      .from('llm_providers')
      .select('id, name')
      .eq('enabled', true);

    if (!providers || providers.length === 0) {
      throw new Error('No enabled providers');
    }

    let totalRuns = 0;
    let successfulRuns = 0;

    // Run prompt on each provider
    for (const provider of providers) {
      try {
        console.log(`Running prompt on ${provider.name}`);
        
        // Execute prompt based on provider
        let response;
        switch (provider.name) {
          case 'openai':
            response = await executeOpenAI(prompt.text);
            break;
          case 'perplexity':
            response = await executePerplexity(prompt.text);
            break;
          case 'gemini':
            response = await executeGemini(prompt.text);
            break;
          default:
            console.log(`Unknown provider: ${provider.name}`);
            continue;
        }

        if (!response) continue;

        // Analyze brand presence and competitors using catalog-aware matcher
        const analysis = await analyzeBrandsInResponse(supabase, orgId, orgName, response.text);

        // Store run (keep existing logging table)
        const { data: run } = await supabase
          .from('prompt_runs')
          .insert({
            prompt_id: promptId,
            provider_id: provider.id,
            status: 'success',
            token_in: response.tokenIn || 0,
            token_out: response.tokenOut || 0,
            cost_est: 0
          })
          .select()
          .single();

        // Also store normalized provider response used by the UI
        const providerModel = provider.name === 'openai' 
          ? 'gpt-4o-mini' 
          : provider.name === 'perplexity' 
            ? 'llama-3.1-sonar-small-128k-online' 
            : 'gemini-pro';

        const { error: pprError } = await supabase
          .from('prompt_provider_responses')
          .insert({
            org_id: orgId,
            prompt_id: promptId,
            provider: provider.name,
            status: 'success',
            score: analysis.score,
            org_brand_present: analysis.orgBrandPresent,
            org_brand_prominence: analysis.orgBrandProminence,
            brands_json: analysis.brands,
            competitors_json: analysis.competitors,
            competitors_count: analysis.competitors.length,
            token_in: response.tokenIn || 0,
            token_out: response.tokenOut || 0,
            raw_ai_response: response.text,
            model: providerModel,
            run_at: new Date().toISOString(),
            metadata: { analysis_method: 'catalog_boundary_match_v2' }
          });
        if (pprError) {
          console.error('Failed to insert prompt_provider_responses:', pprError);
        }

        if (run) {
          // Store visibility result (legacy table)
          await supabase
            .from('visibility_results')
            .insert({
              prompt_run_id: run.id,
              org_brand_present: analysis.orgBrandPresent,
              org_brand_prominence: analysis.orgBrandProminence,
              competitors_count: analysis.competitors.length,
              brands_json: analysis.brands,
              score: analysis.score,
              raw_ai_response: response.text,
              raw_evidence: JSON.stringify({ analysis })
            });

          console.log(`Successfully processed prompt ${promptId} on ${provider.name}`);
          successfulRuns++;
        }
        totalRuns++;

      } catch (providerError) {
        console.error(`Provider ${provider.name} error:`, providerError);
        
        // Log failed run
        await supabase
          .from('prompt_runs')
          .insert({
            prompt_id: promptId,
            provider_id: provider.id,
            status: 'error',
            token_in: 0,
            token_out: 0,
            cost_est: 0
          });
        totalRuns++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Prompt executed successfully`,
        totalRuns,
        successfulRuns,
        timestamp: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Run prompt error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Provider execution functions
async function executeOpenAI(promptText: string) {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) throw new Error('OpenAI API key not found');

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: promptText }],
      max_tokens: 1000,
      temperature: 0.7
    }),
  });

  if (!response.ok) throw new Error(`OpenAI API error: ${response.status}`);

  const data = await response.json();
  return {
    text: data.choices[0].message.content,
    tokenIn: data.usage?.prompt_tokens || 0,
    tokenOut: data.usage?.completion_tokens || 0
  };
}

async function executePerplexity(promptText: string) {
  const apiKey = Deno.env.get('PERPLEXITY_API_KEY');
  if (!apiKey) throw new Error('Perplexity API key not found');

  const response = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.1-sonar-small-128k-online',
      messages: [{ role: 'user', content: promptText }],
      max_tokens: 1000,
      temperature: 0.2
    }),
  });

  if (!response.ok) throw new Error(`Perplexity API error: ${response.status}`);

  const data = await response.json();
  return {
    text: data.choices[0].message.content,
    tokenIn: 0,
    tokenOut: 0
  };
}

async function executeGemini(promptText: string) {
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) throw new Error('Gemini API key not found');

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: promptText }] }]
    }),
  });

  if (!response.ok) throw new Error(`Gemini API error: ${response.status}`);

  const data = await response.json();
  return {
    text: data.candidates?.[0]?.content?.parts?.[0]?.text || '',
    tokenIn: 0,
    tokenOut: 0
  };
}

// Catalog-aware brand analysis with strict word-boundary matching
async function analyzeBrandsInResponse(supabase: any, orgId: string, orgName: string, responseText: string) {
  // Fetch brand catalog for org
  const { data: brandCatalog } = await supabase
    .from('brand_catalog')
    .select('name, variants_json, is_org_brand')
    .eq('org_id', orgId);

  const text = responseText || '';
  const textLower = text.toLowerCase();

  const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const findFirstIndex = (needle: string) => {
    const pattern = new RegExp(`\\b${escapeRegex(needle.toLowerCase())}\\b`, 'i');
    const match = textLower.match(pattern);
    if (!match) return -1;
    return textLower.indexOf((match as any)[0].toLowerCase());
  };

  const orgBrands = (brandCatalog || []).filter((b: any) => b.is_org_brand);
  const competitors = (brandCatalog || []).filter((b: any) => !b.is_org_brand);

  // Build org brand patterns (names + variants)
  const orgPatterns: string[] = [];
  if (orgName) orgPatterns.push(orgName);
  for (const b of orgBrands) {
    orgPatterns.push(b.name);
    if (Array.isArray(b.variants_json)) {
      for (const v of b.variants_json) orgPatterns.push(v);
    }
  }
  // Special-case safety for HubSpot
  if (/hubspot/i.test(orgPatterns.join(' '))) {
    orgPatterns.push('marketing hub', 'hub spot', 'hubspot.com');
  }

  // Detect org brand presence and first position among all brands
  const mentions: { name: string; index: number; isOrg: boolean }[] = [];
  let orgBrandPresent = false;
  for (const p of orgPatterns) {
    const idx = findFirstIndex(p);
    if (idx !== -1) {
      orgBrandPresent = true;
      mentions.push({ name: p, index: idx, isOrg: true });
    }
  }

  // Competitor filtering
  const generic = new Set<string>([
    'seo','marketing','social','media','facebook','google','advertising','analytics','automation','content','digital','platform','tool','tools','software','solution','service','services','company','business','website','online','internet','web','app','application','system','technology','data','insights','reporting','dashboard','management','customer','lead','sales','email','campaign','strategy','optimization','integration','api','cloud','mobile','desktop','browser','plugins','plugin','strong','part','creation','combines'
  ]);

  const foundCompetitors: string[] = [];
  for (const c of competitors) {
    const name = (c.name || '').toString();
    const nameLower = name.toLowerCase();
    if (!name || nameLower.length < 3 || generic.has(nameLower)) continue;

    let idx = findFirstIndex(name);
    if (idx !== -1) {
      foundCompetitors.push(name);
      mentions.push({ name, index: idx, isOrg: false });
      continue;
    }

    if (Array.isArray(c.variants_json)) {
      for (const v of c.variants_json) {
        const vl = (v || '').toString().toLowerCase().trim();
        if (!vl || vl.length < 3 || generic.has(vl)) continue;
        idx = findFirstIndex(vl);
        if (idx !== -1) {
          foundCompetitors.push(name);
          mentions.push({ name, index: idx, isOrg: false });
          break;
        }
      }
    }
  }

  // Compute org brand prominence (rank among all brand mentions)
  let orgBrandProminence: number | null = null;
  if (orgBrandPresent && mentions.length > 0) {
    mentions.sort((a, b) => a.index - b.index);
    const firstOrg = mentions.findIndex(m => m.isOrg);
    orgBrandProminence = firstOrg >= 0 ? firstOrg + 1 : null;
  }

  // Unique competitor list
  const competitorsUnique = Array.from(new Set(foundCompetitors));

  // Score
  let score = 0;
  if (orgBrandPresent) {
    score = 6;
    if (orgBrandProminence && orgBrandProminence <= 3) score += 2;
    else if (orgBrandProminence && orgBrandProminence <= 5) score += 1;
    const penalty = Math.min(2, competitorsUnique.length * 0.3);
    score -= penalty;
  } else if (competitorsUnique.length === 0) {
    score = 2;
  }
  score = Math.max(0, Math.min(10, score));

  return {
    score,
    orgBrandPresent,
    orgBrandProminence,
    brands: orgBrandPresent ? orgPatterns.slice(0, 3) : [],
    competitors: competitorsUnique
  };
}
