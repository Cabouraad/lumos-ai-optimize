/**
 * OpenAI provider adapter for brand extraction
 */

export type BrandExtraction = { 
  brands: string[]; 
  tokenIn: number; 
  tokenOut: number; 
};

export async function extractBrands(promptText: string, apiKey: string): Promise<BrandExtraction> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4.1-2025-04-14',
      messages: [
        {
          role: 'system',
          content: 'You are an extraction API. Given a user prompt, output ONLY a JSON object with a single key brands as an array of brand or company names you would include in your answer. No explanations.'
        },
        {
          role: 'user',
          content: promptText
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices[0].message.content;
  const usage = data.usage || {};

  try {
    const parsed = JSON.parse(content);
    return {
      brands: Array.isArray(parsed.brands) ? parsed.brands : [],
      tokenIn: usage.prompt_tokens || 0,
      tokenOut: usage.completion_tokens || 0,
    };
  } catch (parseError) {
    // Fallback regex extraction for array patterns
    const match = content.match(/\["[^"]*"(?:,\s*"[^"]*")*\]/);
    if (match) {
      try {
        const brands = JSON.parse(match[0]);
        return {
          brands: Array.isArray(brands) ? brands : [],
          tokenIn: usage.prompt_tokens || 0,
          tokenOut: usage.completion_tokens || 0,
        };
      } catch {
        // If all parsing fails, return empty
        return { brands: [], tokenIn: 0, tokenOut: 0 };
      }
    }
    return { brands: [], tokenIn: 0, tokenOut: 0 };
  }
}