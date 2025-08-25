import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) throw new Error('Gemini API key not configured');

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: promptText }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 2000 },
    }),
  });

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  
  return {
    responseText: content,
    tokenIn: data.usageMetadata?.promptTokenCount || 0,
    tokenOut: data.usageMetadata?.candidatesTokenCount || 0,
  };
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
      model: 'llama-3.1-sonar-small-128k-online',
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
  const text = responseText.toLowerCase();
  const orgLower = orgName.toLowerCase();
  
  // Simple brand detection
  const brandPresent = text.includes(orgLower) || text.includes(orgName.toLowerCase());
  const orgBrandPosition = brandPresent ? text.indexOf(orgLower) : null;
  
  // Extract brands (simplified)
  const brandPatterns = [orgName, orgLower, `${orgName} CRM`, `${orgName} Marketing Hub`];
  const foundBrands = brandPatterns.filter(brand => text.includes(brand.toLowerCase()));
  
  // Extract competitors (simple keyword extraction)
  const competitorKeywords = [
    'salesforce', 'marketo', 'pardot', 'mailchimp', 'hootsuite', 'buffer', 
    'sprout social', 'semrush', 'ahrefs', 'buzzsumo', 'getresponse', 
    'activecampaign', 'convertkit', 'monday.com', 'trello', 'asana'
  ];
  
  const competitors = competitorKeywords.filter(competitor => 
    text.includes(competitor) && !competitor.includes(orgLower)
  );
  
  // Simple scoring
  let score = 0;
  if (brandPresent) {
    const relativePosition = orgBrandPosition! / text.length;
    if (relativePosition < 0.2) score = 8; // Early mention
    else if (relativePosition < 0.5) score = 6; // Middle mention  
    else score = 4; // Late mention
    
    // Adjust for competition
    score = Math.max(1, score - Math.min(2, competitors.length * 0.2));
  } else {
    score = responseText.length > 500 ? 2 : 1;
  }
  
  return { 
    score: Math.round(score),
    brandPresent,
    brands: foundBrands,
    competitors,
    orgBrands: foundBrands,
    orgBrandPresent: brandPresent,
    orgBrandPosition,
    competitorCount: competitors.length
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { promptText, provider, orgId } = await req.json();
    
    console.log(`=== SINGLE PROVIDER TEST: ${provider} ===`);
    console.log(`Prompt: ${promptText.substring(0, 50)}...`);

    if (!promptText || !provider) {
      throw new Error('Missing promptText or provider');
    }

    // Get org name for analysis
    const orgName = 'HubSpot'; // Default for now - could fetch from DB

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