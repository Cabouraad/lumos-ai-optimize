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
    const { promptText, provider, orgId } = await req.json();

    if (!promptText || !provider) {
      return new Response(
        JSON.stringify({ error: 'Missing promptText or provider' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let response;
    let brandAnalysis;

    // Execute prompt based on provider with enhanced brand extraction
    switch (provider) {
      case 'openai':
        brandAnalysis = await extractBrandsOpenAI(promptText);
        break;
      case 'perplexity':
        brandAnalysis = await extractBrandsPerplexity(promptText);
        break;
      case 'gemini':
        brandAnalysis = await extractBrandsGemini(promptText);
        break;
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }

    // Get organization's brand catalog for proper identification
    let brandCatalog = [];
    if (orgId) {
      const { data } = await supabase
        .from('brand_catalog')
        .select('name, variants_json, is_org_brand')
        .eq('org_id', orgId);
      
      brandCatalog = data || [];
    }

    // Classify brands as org brands vs competitors
    const { orgBrands, competitors } = classifyBrands(brandAnalysis.brands, brandCatalog);
    
    // Calculate visibility score
    const score = calculateEnhancedVisibilityScore(orgBrands, competitors, brandAnalysis.responseText);

    return new Response(
      JSON.stringify({
        success: true,
        responseText: brandAnalysis.responseText,
        brands: brandAnalysis.brands,
        orgBrands,
        competitors,
        score,
        tokenIn: brandAnalysis.tokenIn || 0,
        tokenOut: brandAnalysis.tokenOut || 0
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

async function extractBrandsOpenAI(promptText: string) {
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
        {
          role: 'system',
          content: 'You are a helpful AI assistant. Answer the user\'s question comprehensively and naturally. After your response, include a JSON object with a single key "brands" containing an array of brand or company names you mentioned in your answer.'
        },
        {
          role: 'user',
          content: promptText
        }
      ],
      max_tokens: 1000,
      temperature: 0.7
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices[0].message.content;
  const usage = data.usage || {};

  // Extract brands from the response
  const brands = extractBrandsFromResponse(content);

  return {
    brands,
    responseText: content,
    tokenIn: usage.prompt_tokens || 0,
    tokenOut: usage.completion_tokens || 0,
  };
}

async function extractBrandsPerplexity(promptText: string) {
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
      temperature: 0.1,
      max_tokens: 1000,
      return_images: false,
      return_related_questions: false,
      messages: [
        {
          role: 'system',
          content: 'You are an extraction API. Given a user prompt, output ONLY a JSON object with a single key brands as an array of brand or company names you would include in your answer. No explanations.'
        },
        {
          role: 'user',
          content: promptText
        }
      ]
    }),
  });

  if (!response.ok) {
    throw new Error(`Perplexity API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';
  const usage = data.usage || {};

  // Prefer direct JSON content when present, else fallback
  let brands: string[] = [];
  try {
    const parsed = JSON.parse(content);
    brands = Array.isArray(parsed.brands) ? parsed.brands : extractBrandsFromResponse(content);
  } catch {
    brands = extractBrandsFromResponse(content);
  }

  return {
    brands,
    responseText: content,
    tokenIn: usage.prompt_tokens || 0,
    tokenOut: usage.completion_tokens || 0
  };
}

async function extractBrandsGemini(promptText: string) {
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) throw new Error('Gemini API key not found');

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              text: promptText + '\n\nAfter your response, include a JSON object with a single key "brands" containing an array of brand or company names you mentioned.'
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 2000,
      }
    }),
  });

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const usage = data.usageMetadata || {};

  const brands = extractBrandsFromResponse(content);

  return {
    brands,
    responseText: content,
    tokenIn: usage.promptTokenCount || 0,
    tokenOut: usage.candidatesTokenCount || 0
  };
}

/**
 * Extract brands from AI response - tries JSON first, falls back to text analysis
 */
function extractBrandsFromResponse(text: string): string[] {
  // Try to extract JSON from the response first
  const jsonMatch = text.match(/\{[^}]*"brands"[^}]*\}/);
  let brands: string[] = [];
  
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      brands = Array.isArray(parsed.brands) ? parsed.brands : [];
    } catch {
      // JSON parsing failed, fall back to text extraction
    }
  }
  
  // If no JSON brands found, extract from text using patterns
  if (brands.length === 0) {
    brands = extractBrandsFromText(text);
  }
  
  return brands;
}

/**
 * Fallback brand extraction from text content using patterns
 */
function extractBrandsFromText(text: string): string[] {
  const brandPatterns = [
    /\b[A-Z][a-z]+ [A-Z][a-z]+\b/g, // Two-word brands like "Google Cloud"
    /\b[A-Z][a-z]{2,}\b/g, // Single capitalized words like "Apple"
  ];
  
  const brands = new Set<string>();
  
  for (const pattern of brandPatterns) {
    const matches = text.match(pattern);
    if (matches) {
      matches.forEach(match => {
        if (!isCommonWord(match) && match.length > 2) {
          brands.add(match);
        }
      });
    }
  }
  
  return Array.from(brands).slice(0, 15);
}

/**
 * Check if a word is likely a common non-brand term
 */
function isCommonWord(word: string): boolean {
  const commonWords = [
    'The', 'This', 'That', 'Here', 'There', 'When', 'Where', 'What', 'How',
    'Some', 'Many', 'Most', 'All', 'Best', 'Good', 'Better', 'Great',
    'First', 'Last', 'Next', 'New', 'Old', 'Other', 'Another', 'Each', 'Every',
    'More', 'Less', 'Much', 'Such', 'Only', 'Also', 'Even', 'Still'
  ];
  return commonWords.includes(word);
}

/**
 * Classify extracted brands as organization brands vs competitors
 */
function classifyBrands(extractedBrands: string[], brandCatalog: any[]) {
  const orgBrands: string[] = [];
  const competitors: string[] = [];
  
  for (const brand of extractedBrands) {
    const normalizedBrand = normalize(brand);
    
    // Check if it matches any org brand in the catalog
    const isOrgBrand = brandCatalog.some(catalogBrand => {
      if (catalogBrand.is_org_brand) {
        const normalizedCatalogBrand = normalize(catalogBrand.name);
        
        // Check exact match or if brand contains catalog brand name
        if (normalizedBrand === normalizedCatalogBrand) return true;
        if (normalizedBrand.includes(normalizedCatalogBrand)) return true;
        
        // Check variants
        for (const variant of catalogBrand.variants_json || []) {
          const normalizedVariant = normalize(variant);
          if (normalizedBrand === normalizedVariant || normalizedBrand.includes(normalizedVariant)) {
            return true;
          }
        }
      }
      return false;
    });
    
    if (isOrgBrand) {
      orgBrands.push(brand);
    } else {
      competitors.push(brand);
    }
  }
  
  return { orgBrands, competitors };
}

/**
 * Normalize brand name for comparison
 */
function normalize(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\s+/g, ' ') // Normalize spaces
    .trim();
}

/**
 * Calculate enhanced visibility score based on org brand presence and competitor analysis
 */
function calculateEnhancedVisibilityScore(orgBrands: string[], competitors: string[], responseText: string) {
  const orgBrandPresent = orgBrands.length > 0;
  const competitorCount = competitors.length;
  
  // Find position of first org brand mention (0-based)
  let brandPosition = null;
  if (orgBrandPresent) {
    const responseWords = responseText.toLowerCase().split(/\s+/);
    for (const orgBrand of orgBrands) {
      const brandWords = orgBrand.toLowerCase().split(/\s+/);
      for (let i = 0; i <= responseWords.length - brandWords.length; i++) {
        const match = brandWords.every((word, index) => 
          responseWords[i + index]?.includes(word.substring(0, Math.min(word.length, 4)))
        );
        if (match) {
          brandPosition = i;
          break;
        }
      }
      if (brandPosition !== null) break;
    }
  }
  
  // Calculate score: 0-10 scale
  let score = 0;
  
  if (orgBrandPresent) {
    // Base score for being mentioned
    score = 5;
    
    // Bonus for early position (earlier = higher score)
    if (brandPosition !== null) {
      const positionBonus = Math.max(0, 3 - Math.floor(brandPosition / 10)); // Up to 3 points for early mention
      score += positionBonus;
    }
    
    // Penalty for competitors (more competitors = lower score)
    const competitorPenalty = Math.min(3, competitorCount * 0.5); // Up to 3 points penalty
    score -= competitorPenalty;
    
    // Ensure minimum score of 1 if org brand is present
    score = Math.max(1, score);
  }
  
  // Cap at 10
  score = Math.min(10, Math.round(score));
  
  return {
    brandPresent: orgBrandPresent,
    brandPosition,
    competitorCount,
    score
  };
}