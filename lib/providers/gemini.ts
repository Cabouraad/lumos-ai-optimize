/**
 * Gemini provider adapter for brand extraction
 */

export type BrandExtraction = { 
  brands: string[]; 
  responseText: string;
  tokenIn: number; 
  tokenOut: number; 
};

export async function extractBrands(promptText: string, apiKey: string): Promise<BrandExtraction> {
  const maxAttempts = 3;
  
  let attempt = 0;
  let lastError: Error | null = null;
  
  while (attempt < maxAttempts) {
    try {
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
        const errorText = await response.text();
        const error = new Error(`Gemini API error: ${response.status} ${response.statusText} - ${errorText}`);
        
        // Don't retry on authentication errors
        if (response.status === 401 || response.status === 403) {
          throw error;
        }
        
        // Don't retry on bad request errors
        if (response.status === 400) {
          throw error;
        }
        
        throw error;
      }

      const data = await response.json();
      const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const usage = data.usageMetadata || {};

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
          tokenIn: usage.promptTokenCount || 0,
          tokenOut: usage.candidatesTokenCount || 0,
        };
        
      } catch (parseError) {
        return { 
          brands: extractBrandsFromText(content), 
          responseText: content,
          tokenIn: usage.promptTokenCount || 0,
          tokenOut: usage.candidatesTokenCount || 0
        };
      }
      
    } catch (error: any) {
      attempt++;
      lastError = error;
      
      console.error(`Gemini attempt ${attempt}/${maxAttempts} failed:`, error.message);
      
      // Don't retry on auth errors
      if (error.message?.includes('401') || error.message?.includes('403')) {
        break;
      }
      
      if (attempt < maxAttempts) {
        // Exponential backoff: 1s, 2s, 4s
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt - 1)));
      }
    }
  }

  // All attempts failed
  throw lastError || new Error('Gemini API failed');
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