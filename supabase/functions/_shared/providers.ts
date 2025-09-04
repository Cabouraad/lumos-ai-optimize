/**
 * LLM provider adapters for edge functions
 */

export type BrandExtraction = { 
  brands: string[]; 
  responseText: string;
  tokenIn: number; 
  tokenOut: number; 
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

export async function extractBrandsPerplexity(promptText: string, apiKey: string): Promise<BrandExtraction> {
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
            ]
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
        
      } catch (error: any) {
        attempt++;
        lastError = error;
        
        console.error(`Perplexity ${model} attempt ${attempt}/${maxAttempts} failed:`, error.message);
        
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

/**
 * Extract business context from website content using OpenAI
 */
export async function extractBusinessContextOpenAI(websiteContent: string, apiKey: string): Promise<BusinessContextExtraction> {
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

  // First attempt with GPT-5
  let response: Response;
  let model = 'gpt-5-2025-08-07';
  
  try {
    console.log('Attempting OpenAI analysis with GPT-5...');
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 22000); // 22 second timeout
    
    response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-5-2025-08-07',
        messages: [
          {
            role: 'system',
            content: 'You are a business analyst expert at extracting structured business information from website content. Always respond with valid JSON only.'
          },
          {
            role: 'user',
            content: analysisPrompt
          }
        ],
        response_format: { type: 'json_object' },
        max_completion_tokens: 1000
      })
    });
    
    clearTimeout(timeoutId);
  } catch (error) {
    console.error('GPT-5 attempt failed:', error.message);
    
    // Retry with GPT-4.1 as fallback
    console.log('Retrying with GPT-4.1...');
    model = 'gpt-4.1-2025-04-14';
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 22000);
    
    response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4.1-2025-04-14',
        messages: [
          {
            role: 'system',
            content: 'You are a business analyst expert at extracting structured business information from website content. Always respond with valid JSON only.'
          },
          {
            role: 'user',
            content: analysisPrompt
          }
        ],
        max_tokens: 1000,
        temperature: 0.3
      })
    });
    
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`OpenAI API error (${model}):`, errorText);
    throw new Error(`OpenAI API failed with ${model}: ${response.status}`);
  }

  const openaiResult = await response.json();
  const analysisText = openaiResult.choices[0]?.message?.content?.trim();
  const usage = openaiResult.usage || {};
  
  console.log(`OpenAI analysis successful with ${model}. Response length:`, analysisText?.length || 0);

  if (!analysisText) {
    throw new Error(`No analysis received from OpenAI (${model})`);
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
    console.error('Failed to parse OpenAI response:', analysisText, 'Error:', parseError);
    throw new Error('Failed to parse AI analysis results');
  }

  // Validate and clean the parsed data
  const result: BusinessContextExtraction = {
    keywords: Array.isArray(businessContext.keywords) ? 
      businessContext.keywords
        .filter((k: any) => k && typeof k === 'string' && k.trim().length > 0)
        .map((k: string) => k.trim())
        .slice(0, 10) : [],
    competitors: Array.isArray(businessContext.competitors) ? 
      businessContext.competitors
        .filter((c: any) => c && typeof c === 'string' && c.trim().length > 0)
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
    analysis_hash
  };

  return result;
}