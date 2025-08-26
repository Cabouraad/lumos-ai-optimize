import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { computeVisibilityScore } from "../_shared/scoring.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simple provider execution functions
async function executeOpenAI(promptText: string): Promise<{ responseText: string; tokenIn: number; tokenOut: number }> {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) throw new Error('OpenAI API key not configured');

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: promptText }],
      temperature: 0.3,
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  return {
    responseText: data.choices[0]?.message?.content || '',
    tokenIn: data.usage?.prompt_tokens || 0,
    tokenOut: data.usage?.completion_tokens || 0,
  };
}

async function executeGemini(promptText: string): Promise<{ responseText: string; tokenIn: number; tokenOut: number }> {
  console.log('=== GEMINI STANDARDIZED v2 ===');
  
  // Use multiple fallback environment variable names for compatibility
  const apiKey = Deno.env.get('GEMINI_API_KEY') || Deno.env.get('GOOGLE_API_KEY') || Deno.env.get('GOOGLE_GENAI_API_KEY') || Deno.env.get('GENAI_API_KEY');
  
  console.log('API Key Check:', {
    hasGeminiKey: !!Deno.env.get('GEMINI_API_KEY'),
    hasGoogleApiKey: !!Deno.env.get('GOOGLE_API_KEY'),
    hasGoogleGenaiKey: !!Deno.env.get('GOOGLE_GENAI_API_KEY'),
    hasGenaiKey: !!Deno.env.get('GENAI_API_KEY'),
    finalKeyFound: !!apiKey,
    keyLength: apiKey ? apiKey.length : 0
  });
  
  if (!apiKey) {
    console.error('GEMINI API KEY ERROR: No API key found in any environment variable');
    throw new Error('Gemini API key not configured');
  }

  console.log(`Starting Gemini API call with key length: ${apiKey.length}`);

  const maxAttempts = 3;
  let attempt = 0;
  let lastError: Error | null = null;

  while (attempt < maxAttempts) {
    try {
      attempt++;
      console.log(`[Gemini] Attempt ${attempt}/${maxAttempts}`);

      const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-goog-api-key': apiKey
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: promptText }] }],
          generationConfig: { 
            temperature: 0.3, 
            maxOutputTokens: 2000,
            topK: 40,
            topP: 0.95
          },
        }),
      });

      console.log(`[Gemini] Response status: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        const errorText = await response.text();
        const error = new Error(`Gemini API error: ${response.status} ${response.statusText} - ${errorText}`);
        console.error(`[Gemini] API Error Details:`, {
          status: response.status,
          statusText: response.statusText,
          errorBody: errorText.substring(0, 500) + (errorText.length > 500 ? '...' : '')
        });
        
        // Don't retry on authentication or bad request errors
        if (response.status === 401 || response.status === 403 || response.status === 400) {
          console.error(`[Gemini] Non-retryable error: ${response.status}`);
          throw error;
        }
        
        lastError = error;
        if (attempt < maxAttempts) {
          const delay = 1000 * Math.pow(2, attempt - 1);
          console.log(`[Gemini] Retrying after ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        throw error;
      }

      const data = await response.json();
      console.log('[Gemini] Response received successfully');
      
      const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const usage = data.usageMetadata || {};
      
      console.log(`[Gemini] Success - Content length: ${content.length}, Tokens in: ${usage.promptTokenCount || 0}, Tokens out: ${usage.candidatesTokenCount || 0}`);
      
      return {
        responseText: content,
        tokenIn: usage.promptTokenCount || 0,
        tokenOut: usage.candidatesTokenCount || 0,
      };
    } catch (error: any) {
      lastError = error;
      console.error(`[Gemini] Attempt ${attempt}/${maxAttempts} failed:`, error.message);
      
      // Don't retry on auth errors
      if (error.message?.includes('401') || error.message?.includes('403')) {
        console.error('[Gemini] Authentication error detected - stopping retries');
        break;
      }
      
      if (attempt < maxAttempts) {
        const delay = 1000 * Math.pow(2, attempt - 1);
        console.log(`[Gemini] Waiting ${delay}ms before next retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  const finalError = lastError || new Error('Gemini API failed after all attempts');
  console.error('[Gemini] ALL ATTEMPTS FAILED:', finalError.message);
  throw finalError;
}

async function executePerplexity(promptText: string): Promise<{ responseText: string; tokenIn: number; tokenOut: number }> {
  const apiKey = Deno.env.get('PERPLEXITY_API_KEY');
  if (!apiKey) throw new Error('Perplexity API key not configured');

  const response = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'sonar',
      messages: [{ role: 'user', content: promptText }],
      temperature: 0.3,
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    throw new Error(`Perplexity API error: ${response.status}`);
  }

  const data = await response.json();
  return {
    responseText: data.choices[0]?.message?.content || '',
    tokenIn: data.usage?.prompt_tokens || 0,
    tokenOut: data.usage?.completion_tokens || 0,
  };
}

// Simple analysis function  
function analyzeResponse(responseText: string, orgName: string): { 
  score: number; 
  brandPresent: boolean; 
  brands: string[]; 
  competitors: string[]; 
  orgBrands: string[];
  orgBrandPresent: boolean;
  orgBrandPosition: number | null;
  competitorCount: number;
} {
  const text = (responseText || '').toLowerCase();
  const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
  const makeBoundaryRegex = (term: string) => new RegExp(`(?<![A-Za-z0-9])${escapeRegExp(term)}(?![A-Za-z0-9])`, 'gi');
  
  const base = (orgName || '').trim();
  const baseLower = base.toLowerCase();
  const orgVariants = Array.from(new Set([
    baseLower,
    baseLower.replace(/\s+/g, ''),
    baseLower.replace(/\s+/g, '-'),
    `${baseLower} crm`,
    `${baseLower} marketing hub`,
  ].filter(Boolean)));

  const findEarliestIndex = (t: string, terms: string[]): number | null => {
    let min: number | null = null;
    for (const term of terms) {
      const re = makeBoundaryRegex(term);
      const m = re.exec(t);
      if (m) {
        const idx = m.index;
        if (min === null || idx < min) min = idx;
      }
    }
    return min;
  };

  const competitorKeywords = [
    'salesforce','marketo','pardot','mailchimp','hootsuite','buffer',
    'sprout social','semrush','ahrefs','buzzsumo','getresponse',
    'activecampaign','convertkit','monday.com','trello','asana','notion',
    'intercom','zendesk','pipedrive','freshsales','hubspot','klaviyo',
    'constant contact','aweber','drip','omnisend','sendinblue','brevo',
    'mailerlite','campaign monitor','emma','benchmark email'
  ];

  // Detect org presence and position with boundaries
  const orgPos = findEarliestIndex(text, orgVariants);
  const brandPresent = orgPos !== null;

  // Detect competitors with boundaries and de-duplication
  const competitorSet = new Set<string>();
  const competitorPositions: Array<{ name: string; pos: number }> = [];
  
  for (const comp of competitorKeywords) {
    // Skip if this competitor matches any org brand variant
    const isOrgBrand = orgVariants.some(variant => 
      variant.toLowerCase() === comp.toLowerCase() ||
      comp.toLowerCase().includes(variant.toLowerCase()) ||
      variant.toLowerCase().includes(comp.toLowerCase())
    );
    
    if (isOrgBrand) continue;
    
    const re = makeBoundaryRegex(comp);
    re.lastIndex = 0; // Reset regex state
    const match = re.exec(text);
    if (match) {
      // Only add if we haven't seen this competitor already
      if (!competitorSet.has(comp)) {
        competitorSet.add(comp);
        competitorPositions.push({ name: comp, pos: match.index });
      }
    }
  }

  // Compute prominence index: how many brand mentions occur before org mention
  let prominenceIdx: number | null = null;
  if (brandPresent) {
    const allPositions = [
      ...competitorPositions.map(c => ({ type: 'comp' as const, pos: c.pos })),
      { type: 'org' as const, pos: orgPos as number }
    ].sort((a, b) => a.pos - b.pos);
    prominenceIdx = allPositions.findIndex(x => x.type === 'org');
  }

  // Score using unified scoring
  const score = computeVisibilityScore(brandPresent, prominenceIdx, competitorSet.size);

  const competitors = Array.from(competitorSet);
  const foundBrands = brandPresent ? [base] : [];

  return { 
    score: Math.round(score),
    brandPresent,
    brands: foundBrands,
    competitors,
    orgBrands: foundBrands,
    orgBrandPresent: brandPresent,
    orgBrandPosition: orgPos,
    competitorCount: competitors.length
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestBody = await req.json();
    const { promptText, provider, orgId } = requestBody;
    
    // Debug what we received
    console.log(`=== SINGLE PROVIDER TEST: ${provider} ===`);
    console.log(`Request body:`, JSON.stringify(requestBody));
    console.log(`Prompt: ${promptText?.substring(0, 50)}...`);
    console.log(`Provider: ${provider}`);
    console.log(`OrgId: ${orgId}`);

    if (!promptText || !provider || !orgId) {
      console.error(`=== PROVIDER TEST ERROR === Missing promptText, provider, or orgId`);
      console.error(`promptText: ${promptText ? 'present' : 'missing'}`);
      console.error(`provider: ${provider ? 'present' : 'missing'}`);
      console.error(`orgId: ${orgId ? 'present' : 'missing'}`);
      throw new Error('Missing promptText, provider, or orgId');
    }

    // Get org name for analysis from database
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const orgResponse = await fetch(`${supabaseUrl}/rest/v1/organizations?id=eq.${orgId}&select=name`, {
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'apikey': supabaseKey,
        'Content-Type': 'application/json'
      }
    });
    
    if (!orgResponse.ok) {
      throw new Error('Failed to fetch organization data');
    }
    
    const orgData = await orgResponse.json();
    const orgName = orgData?.[0]?.name || 'Unknown Organization';

    // Execute the specific provider
    let response;
    switch (provider.toLowerCase()) {
      case 'openai':
        response = await executeOpenAI(promptText);
        break;
      case 'gemini':
        response = await executeGemini(promptText);
        break;
      case 'perplexity':
        response = await executePerplexity(promptText);
        break;
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }

    // Analyze the response
    const analysis = analyzeResponse(response.responseText, orgName);
    
    console.log(`✅ ${provider} success:`, {
      score: analysis.score,
      brandPresent: analysis.brandPresent,
      competitors: analysis.competitorCount
    });

    return new Response(
      JSON.stringify({
        success: true,
        responseId: crypto.randomUUID(),
        responseText: response.responseText,
        tokenIn: response.tokenIn,
        tokenOut: response.tokenOut,
        ...analysis
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error(`=== PROVIDER TEST ERROR ===`, error.message);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { 
        status: 200, // Return 200 so client can parse the error
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});