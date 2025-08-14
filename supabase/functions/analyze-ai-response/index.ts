import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const openaiKey = Deno.env.get('OPENAI_API_KEY');
  
  if (!openaiKey) {
    return new Response(JSON.stringify({ error: 'OpenAI API key not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const { prompt, response, provider, orgBrands } = await req.json();

    if (!prompt || !response) {
      return new Response(JSON.stringify({ error: 'Missing prompt or AI response' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Analyzing ${provider || 'AI'} response for prompt: "${prompt}"`);

    // Extract brands from search results using OpenAI
    const brandResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1-2025-04-14',
        messages: [
          {
            role: 'system',
            content: 'You are an expert at extracting brand names, company names, product names, and service names from AI-generated text responses. Extract all brands and companies that are specifically mentioned in the AI response. Be thorough but only include actual brand names, not generic categories.'
          },
          {
            role: 'user',
            content: `Original Prompt: "${prompt}"

AI Response to analyze:
${response}

Extract all brand names, company names, product names, and service names that are specifically mentioned in this AI response. Return only the names, one per line, without any additional text or explanations. Focus on:
- Specific company names mentioned
- Product/service brand names
- Platform names
- Software/tool names

Do not include generic terms or categories.`
          }
        ],
        max_tokens: 500,
        temperature: 0.1,
      }),
    });

    if (!brandResponse.ok) {
      throw new Error(`OpenAI API error: ${brandResponse.statusText}`);
    }

    const brandData = await brandResponse.json();
    const brandContent = brandData.choices[0].message.content || '';
    
    // Extract and clean brand names
    const extractedBrands = brandContent
      .split('\n')
      .map(line => line.trim())
      .filter(line => {
        // Filter out empty lines, numbers, and obvious non-brand text
        if (!line || line.length < 2) return false;
        if (/^\d+\.?\s*$/.test(line)) return false;
        if (line.includes('http') || line.includes('www.')) return false;
        if (line.length > 50) return false;
        
        return /^[A-Za-z0-9\s&\-\.\(\)\/]{2,40}$/.test(line);
      })
      .slice(0, 15);

    console.log(`Extracted brands:`, extractedBrands);

    // Check for organization brand presence and position
    let orgBrandPresent = false;
    let orgBrandPosition: number | null = null;

    if (orgBrands && orgBrands.length > 0) {
      for (let i = 0; i < extractedBrands.length; i++) {
        const brand = extractedBrands[i].toLowerCase();
        for (const orgBrand of orgBrands) {
          if (brand.includes(orgBrand.toLowerCase()) || orgBrand.toLowerCase().includes(brand)) {
            orgBrandPresent = true;
            orgBrandPosition = i;
            break;
          }
        }
        if (orgBrandPresent) break;
      }
    }

    // Calculate score
    let score = 1; // Base score

    if (orgBrandPresent) {
      score = 5; // Base score for being present
      
      // Position bonus
      if (orgBrandPosition !== null) {
        if (orgBrandPosition === 0) score += 3;
        else if (orgBrandPosition <= 2) score += 2;
        else if (orgBrandPosition <= 5) score += 1;
      }
      
      // Competitor penalty
      const competitorCount = extractedBrands.length - (orgBrandPresent ? 1 : 0);
      if (competitorCount > 5) score -= 2;
      else if (competitorCount > 2) score -= 1;
    }

    score = Math.max(1, Math.min(10, score));

    const result = {
      brands: extractedBrands,
      orgBrandPresent,
      orgBrandPosition,
      score,
      competitorCount: extractedBrands.length - (orgBrandPresent ? 1 : 0)
    };

    console.log('Analysis result:', result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in analyze-search-results function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});