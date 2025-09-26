/**
 * LLM provider adapters for edge functions
 */

import { extractOpenAICitations, extractPerplexityCitations, type CitationsData } from './citations-enhanced.ts';

export type BrandExtraction = { 
  brands: string[]; 
  responseText: string;
  tokenIn: number; 
  tokenOut: number; 
  citations?: CitationsData;
};

export type BusinessContextExtraction = {
  keywords: string[];
  competitors: string[];
  business_description: string;
  products_services: string;
  target_audience: string;
  tokenIn: number;
  tokenOut: number;
  analysis_hash?: string;
};

export async function extractBrandsOpenAI(promptText: string, apiKey: string): Promise<BrandExtraction> {
  // Check for fake provider mode in E2E testing
  if (Deno.env.get('E2E_FAKE_PROVIDERS') === 'true') {
    console.log('[E2E] Using fake OpenAI provider');
    const { extractBrands } = await import('../../lib/providers/fake.ts');
    return await extractBrands(promptText, 'openai');
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4-1106-preview',
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
  
  // Extract citations from OpenAI response (text-only)
  const citations = extractOpenAICitations(content);

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
      citations
    };
  } catch (parseError) {
    return { 
      brands: extractBrandsFromText(content), 
      responseText: content,
      tokenIn: usage.prompt_tokens || 0,
      tokenOut: usage.completion_tokens || 0,
      citations
    };
  }
}

export async function extractBrandsPerplexity(promptText: string, apiKey: string): Promise<BrandExtraction> {
  // Check for fake provider mode in E2E testing
  if (Deno.env.get('E2E_FAKE_PROVIDERS') === 'true') {
    console.log('[E2E] Using fake Perplexity provider');
    const { extractBrands } = await import('../../lib/providers/fake.ts');
    return await extractBrands(promptText, 'perplexity');
  }

  const models = ['sonar']; // Using official Perplexity model as per their docs

  let lastError: Error | null = null;
  
  for (const model of models) {
    let attempt = 0;
    const maxAttempts = 3;
    
    while (attempt < maxAttempts) {
      try {
        const response = await fetch('https://api.perplexity.ai/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            messages: [
              {
                role: 'user',
                content: promptText + '\n\nAfter your response, include a JSON object with a single key "brands" containing an array of brand or company names you mentioned.'
              }
            ],
            return_citations: true,
            return_related_questions: false
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          const error = new Error(`Perplexity API error: ${response.status} ${response.statusText} - ${errorText}`);
          
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
        const content = data.choices[0]?.message?.content || '';
        const usage = data.usage || {};
        
        // Extract citations from Perplexity response
        const citations = extractPerplexityCitations(data, content);

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
            citations
          };
          
        } catch (parseError) {
          return { 
            brands: extractBrandsFromText(content), 
            responseText: content,
            tokenIn: usage.prompt_tokens || 0,
            tokenOut: usage.completion_tokens || 0,
            citations
          };
        }
        
      } catch (error: any) {
        attempt++;
        lastError = error;
        
        console.error(`Perplexity ${model} attempt ${attempt}/${maxAttempts} failed:`, toErrorMessage(error));
        
        // Don't retry on auth errors
        if (toErrorMessage(error).includes('401') || toErrorMessage(error).includes('403')) {
          break;
        }
        
        if (attempt < maxAttempts) {
          // Exponential backoff: 1s, 2s, 4s
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt - 1)));
        }
      }
    }
  }

  // All models and retries failed
  throw lastError || new Error('All Perplexity models failed');
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
      matches.forEach((match: any) => {
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

/**
 * Extract business context from website content using OpenAI with robust fallback chain
 */
export async function extractBusinessContextOpenAI(websiteContent: string, apiKey: string): Promise<BusinessContextExtraction & { model_used: string; source?: string }> {
  // Create analysis hash for deduplication
  const encoder = new TextEncoder();
  const data = encoder.encode(websiteContent);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const analysis_hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);

  const analysisPrompt = `Analyze this website content and extract specific business information. Return ONLY a valid JSON object with this exact structure:

{
  "keywords": ["keyword1", "keyword2", "keyword3"],
  "competitors": ["competitor1", "competitor2", "competitor3"],
  "business_description": "Brief description of what the business does",
  "products_services": "Description of main products and services offered", 
  "target_audience": "Description of ideal customers and target market"
}

Instructions:
- Extract 5-8 specific keywords related to the industry, products, or services (avoid generic terms)
- Extract 3-6 main competitors mentioned or implied on the website (actual company names only)
- Keep descriptions concise and professional
- Focus on concrete business activities, not marketing language
- If information is unclear, provide reasonable inferences based on context

Website content:
${websiteContent}

Return only the JSON object, no other text:`;

  // Model fallback chain with proper parameters
  const modelChain = [
    { 
      name: 'gpt-5-2025-08-07', 
      params: { 
        model: 'gpt-5-2025-08-07',
        max_completion_tokens: 1000,
        response_format: { type: 'json_object' }
      } 
    },
    { 
      name: 'gpt-4.1-2025-04-14', 
      params: { 
        model: 'gpt-4.1-2025-04-14',
        max_completion_tokens: 1000,
        response_format: { type: 'json_object' }
      } 
    },
    { 
      name: 'gpt-5-mini-2025-08-07', 
      params: { 
        model: 'gpt-5-mini-2025-08-07',
        max_completion_tokens: 800,
        response_format: { type: 'json_object' }
      } 
    },
    { 
      name: 'o4-mini-2025-04-16', 
      params: { 
        model: 'o4-mini-2025-04-16',
        max_completion_tokens: 800
      } 
    }
  ];

  let lastError: Error | null = null;

  for (const { name, params } of modelChain) {
    try {
      console.log(`Attempting OpenAI analysis with ${name}...`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000); // Reduced to 12s per model
      
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...params,
          messages: [
            {
              role: 'system',
              content: 'You are a business analyst expert at extracting structured business information from website content. Always respond with valid JSON only.'
            },
            {
              role: 'user',
              content: analysisPrompt
            }
          ]
        })
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`OpenAI API error (${name}):`, errorText);
        lastError = new Error(`${name} failed: ${response.status}`);
        continue;
      }

      const openaiResult = await response.json();
      const analysisText = openaiResult.choices[0]?.message?.content?.trim();
      const usage = openaiResult.usage || {};
      
      console.log(`OpenAI analysis successful with ${name}. Response length:`, analysisText?.length || 0);

      // Handle empty response from successful call
      if (!analysisText || analysisText.length === 0) {
        console.log(`${name} returned empty response, trying next model`);
        lastError = new Error(`${name} returned empty response`);
        continue;
      }

      console.log('Raw OpenAI response:', analysisText);

      // Parse the JSON response with better error handling
      let businessContext: any;
      try {
        // Clean the response to ensure it's valid JSON
        let cleanedResponse = analysisText;
        // Remove any markdown code blocks
        cleanedResponse = cleanedResponse.replace(/```json\n?|\n?```/g, '').trim();
        // Remove any leading/trailing non-JSON content
        const jsonStart = cleanedResponse.indexOf('{');
        const jsonEnd = cleanedResponse.lastIndexOf('}');
        if (jsonStart !== -1 && jsonEnd !== -1) {
          cleanedResponse = cleanedResponse.substring(jsonStart, jsonEnd + 1);
        }
        
        businessContext = JSON.parse(cleanedResponse);
      } catch (parseError) {
        console.error(`Failed to parse ${name} response:`, analysisText, 'Error:', parseError);
        lastError = new Error(`${name} JSON parse failed`);
        continue;
      }

      // Validate and clean the parsed data
      const result = {
        keywords: Array.isArray(businessContext.keywords) ? 
          businessContext.keywords
            .filter(k => k && typeof k === 'string' && k.trim().length > 0)
            .map((k: string) => k.trim())
            .slice(0, 10) : [],
        competitors: Array.isArray(businessContext.competitors) ? 
          businessContext.competitors
            .filter(c => c && typeof c === 'string' && c.trim().length > 0)
            .map((c: string) => c.trim())
            .slice(0, 8) : [],
        business_description: typeof businessContext.business_description === 'string' ? 
          businessContext.business_description : '',
        products_services: typeof businessContext.products_services === 'string' ? 
          businessContext.products_services : '',
        target_audience: typeof businessContext.target_audience === 'string' ? 
          businessContext.target_audience : '',
        tokenIn: usage.prompt_tokens || 0,
        tokenOut: usage.completion_tokens || 0,
        analysis_hash,
        model_used: name
      };

      return result;

    } catch (error: unknown) {
      const message = toErrorMessage(error);
      console.error(`${name} attempt failed:`, message);
      lastError = error instanceof Error ? error : new Error(message);
      continue;
    }
  }

  // All models failed
  throw lastError || new Error('All OpenAI models failed');
}

/**
 * Generate keywords from text using a fast, focused prompt
 */
export async function generateKeywordsOnly(text: string, apiKey: string): Promise<string[]> {
  const keywordPrompt = `Extract 6-8 specific business keywords from this content. Return only a JSON array of strings:

${text.substring(0, 2000)}

Return format: ["keyword1", "keyword2", ...]`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // Fast 8s timeout
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-5-mini-2025-08-07',
        messages: [
          {
            role: 'user',
            content: keywordPrompt
          }
        ],
        max_completion_tokens: 200
      })
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Keywords API failed: ${response.status}`);
    }

    const result = await response.json();
    const content = result.choices[0]?.message?.content?.trim();
    
    if (content) {
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        return parsed.filter(k => k && typeof k === 'string').slice(0, 8);
      }
    }
    return [];
  } catch (error: unknown) {
    console.error('Keywords generation failed:', error);
    return [];
  }
}

/**
 * Extract keywords from meta tags in HTML
 */
export function extractMetaKeywords(html: string): string[] {
  const metaMatch = html.match(/<meta\s+name=["']keywords["']\s+content=["']([^"']+)["']/i);
  if (metaMatch && metaMatch[1]) {
    return metaMatch[1]
      .split(',')
      .map(k => k.trim())
      .filter(k => k.length > 0)
      .slice(0, 8);
  }
  return [];
}

/**
 * Heuristic keyword extraction from text
 */
export function extractHeuristicKeywords(text: string): string[] {
  // Extract potential keywords using simple patterns
  const words = text.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3 && w.length < 20);

  // Count word frequencies
  const freq: Record<string, number> = {};
  words.forEach((w: any) => {
    if (!isCommonWord(w.charAt(0).toUpperCase() + w.slice(1))) {
      freq[w] = (freq[w] || 0) + 1;
    }
  });

  // Get most frequent, non-generic words
  return Object.entries(freq)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 6)
    .map(([word]) => word)
    .filter(w => !['website', 'company', 'business', 'service', 'product'].includes(w));
}