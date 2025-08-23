import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { promptText, provider, orgId } = await req.json();

    if (!promptText || !provider) {
      return new Response(
        JSON.stringify({ error: 'Missing promptText or provider' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let response;
    let brands: string[] = [];

    // Execute prompt based on provider
    switch (provider) {
      case 'openai':
        response = await executeOpenAI(promptText);
        break;
      case 'perplexity':
        response = await executePerplexity(promptText);
        break;
      case 'gemini':
        response = await executeGemini(promptText);
        break;
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }

    // Extract brands from response
    brands = extractBrands(response.text);

    return new Response(
      JSON.stringify({
        success: true,
        responseText: response.text,
        brands,
        tokenIn: response.tokenIn || 0,
        tokenOut: response.tokenOut || 0
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Execute prompt error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

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
      messages: [
        { role: 'user', content: promptText }
      ],
      max_tokens: 1000,
      temperature: 0.7
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }

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
      messages: [
        { role: 'user', content: promptText }
      ],
      max_tokens: 1000,
      temperature: 0.2
    }),
  });

  if (!response.ok) {
    throw new Error(`Perplexity API error: ${response.status}`);
  }

  const data = await response.json();
  return {
    text: data.choices[0].message.content,
    tokenIn: 0, // Perplexity doesn't provide token counts
    tokenOut: 0
  };
}

async function executeGemini(promptText: string) {
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) throw new Error('Gemini API key not found');

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{
        parts: [{
          text: promptText
        }]
      }]
    }),
  });

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  
  return {
    text,
    tokenIn: 0, // Gemini doesn't provide token counts in this format
    tokenOut: 0
  };
}

/**
 * Extract brand names from AI response text
 * Simple implementation - looks for capitalized words/phrases that could be brands
 */
function extractBrands(text: string): string[] {
  const brands: string[] = [];
  
  // Simple brand extraction - find capitalized words
  const words = text.split(/\s+/);
  const brandPattern = /^[A-Z][a-zA-Z]*(?:\s+[A-Z][a-zA-Z]*)*$/;
  
  for (let i = 0; i < words.length; i++) {
    const word = words[i].replace(/[.,!?;:]$/, ''); // Remove punctuation
    
    // Check for single capitalized words (potential brands)
    if (brandPattern.test(word) && word.length > 2) {
      brands.push(word);
    }
    
    // Check for two-word brands
    if (i < words.length - 1) {
      const twoWord = `${word} ${words[i + 1].replace(/[.,!?;:]$/, '')}`;
      if (brandPattern.test(twoWord)) {
        brands.push(twoWord);
        i++; // Skip next word since we used it
      }
    }
  }
  
  // Remove duplicates and filter out common words
  const commonWords = ['The', 'This', 'That', 'And', 'Or', 'But', 'With', 'For', 'On', 'In', 'At', 'To', 'From'];
  const uniqueBrands = [...new Set(brands)]
    .filter(brand => !commonWords.includes(brand))
    .filter(brand => brand.length > 1);
  
  return uniqueBrands.slice(0, 10); // Limit to 10 brands
}