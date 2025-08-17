/**
 * OpenAI provider adapter for brand extraction
 */

export type BrandExtraction = { 
  brands: string[]; 
  responseText: string;
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
          content: 'You are a helpful AI assistant. Answer the user\'s question comprehensively and naturally. After your response, include a JSON object with a single key "brands" containing an array of brand or company names you mentioned in your answer.'
        },
        {
          role: 'user',
          content: promptText
        }
      ],
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices[0].message.content;
  const usage = data.usage || {};

  try {
    // Try to extract JSON from the end of the response
    const jsonMatch = content.match(/\{[^}]*"brands"[^}]*\}/);
    let brands: string[] = [];
    
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        brands = Array.isArray(parsed.brands) ? parsed.brands : [];
      } catch {
        // If JSON parsing fails, extract brands from text content
        brands = extractBrandsFromText(content);
      }
    } else {
      // No JSON found, extract from text
      brands = extractBrandsFromText(content);
    }
    
    return {
      brands,
      responseText: content,
      tokenIn: usage.prompt_tokens || 0,
      tokenOut: usage.completion_tokens || 0,
    };
  } catch (parseError) {
    return { 
      brands: extractBrandsFromText(content), 
      responseText: content,
      tokenIn: usage.prompt_tokens || 0,
      tokenOut: usage.completion_tokens || 0
    };
  }
}

/**
 * Fallback brand extraction from text content
 */
function extractBrandsFromText(text: string): string[] {
  // Simple pattern matching for common brand formats
  const brandPatterns = [
    /\b[A-Z][a-z]+ [A-Z][a-z]+\b/g, // Two-word brands like "Google Cloud"
    /\b[A-Z][a-z]{2,}\b/g, // Single capitalized words like "Apple"
  ];
  
  const brands = new Set<string>();
  
  for (const pattern of brandPatterns) {
    const matches = text.match(pattern);
    if (matches) {
      matches.forEach(match => {
        // Filter out common non-brand words
        if (!isCommonWord(match)) {
          brands.add(match);
        }
      });
    }
  }
  
  return Array.from(brands);
}

/**
 * Check if a word is likely a common non-brand term
 */
function isCommonWord(word: string): boolean {
  const commonWords = [
    'The', 'This', 'That', 'Here', 'There', 'When', 'Where', 'What', 'How',
    'Some', 'Many', 'Most', 'All', 'Best', 'Good', 'Better', 'Great',
    'First', 'Last', 'Next', 'New', 'Old', 'Other', 'Another'
  ];
  return commonWords.includes(word);
}