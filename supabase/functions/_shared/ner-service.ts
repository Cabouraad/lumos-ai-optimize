/**
 * Named Entity Recognition Service
 * Lightweight NER service using OpenAI for organization entity extraction
 */

export interface NEREntity {
  text: string;
  label: string;
  confidence: number;
  start: number;
  end: number;
}

export interface NERResult {
  entities: NEREntity[];
  organizations: string[];
  processing_time_ms: number;
}

/**
 * Extract organization entities from text using OpenAI
 */
export async function extractOrganizations(
  text: string,
  options: {
    maxEntities?: number;
    confidenceThreshold?: number;
  } = {}
): Promise<NERResult> {
  const startTime = Date.now();
  const { maxEntities = 15, confidenceThreshold = 0.8 } = options;

  const openaiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiKey) {
    throw new Error('OpenAI API key not configured for NER service');
  }

  try {
    console.log('🤖 Performing NER extraction...');
    
    const prompt = `Extract organization names (companies, brands, software, services, platforms) from this text. 

Text:
"""
${text.substring(0, 3000)}
"""

Instructions:
- Only identify legitimate business entities, brands, company names, software names, or service names
- Do NOT include: generic words, actions, common nouns, descriptive terms, or personal names
- Do NOT include: "using", "making", "while", "experience", "solution", "platform" (unless part of a specific brand name)
- Include compound names like "Sales Force", "Google Workspace", "Microsoft Teams"
- Focus on entities that are clearly business/brand names

Return a JSON array of objects with this exact format:
[
  {"name": "Company Name", "confidence": 0.95},
  {"name": "Another Brand", "confidence": 0.87}
]

Only include entities with confidence >= ${confidenceThreshold}. Maximum ${maxEntities} entities.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5-nano-2025-08-07',
        messages: [
          { 
            role: 'system', 
            content: 'You are a precise named entity recognition system specialized in identifying business entities, brands, and organization names. Be conservative and accurate.' 
          },
          { role: 'user', content: prompt }
        ],
        max_completion_tokens: 400,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content.trim();
    
    // Parse JSON response
    let extractedEntities: Array<{ name: string; confidence: number }> = [];
    try {
      extractedEntities = JSON.parse(content);
    } catch (parseError: unknown) {
      console.warn('Failed to parse NER JSON response, attempting fallback extraction');
      // Fallback: try to extract entities from malformed JSON
      const entityMatches = content.match(/"name":\s*"([^"]+)"/g);
      if (entityMatches) {
        extractedEntities = entityMatches.map((match: string) => {
          const nameMatch = match.match(/"name":\s*"([^"]+)"/);
          return {
            name: nameMatch ? nameMatch[1] : '',
            confidence: 0.75 // Default confidence for fallback
          };
        }).filter((entity: any) => entity.name.length > 0);
      }
    }

    // Convert to NER entities with position information
    const entities: NEREntity[] = [];
    const organizations: string[] = [];

    for (const extracted of extractedEntities) {
      if (!extracted.name || extracted.confidence < confidenceThreshold) {
        continue;
      }

      const name = extracted.name.trim();
      if (name.length < 3 || name.length > 30) {
        continue;
      }

      // Find position in text
      const regex = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      const match = text.match(regex);
      
      if (match && match.index !== undefined) {
        entities.push({
          text: name,
          label: 'ORG',
          confidence: extracted.confidence,
          start: match.index,
          end: match.index + name.length
        });
        
        organizations.push(name);
      }
    }

    const processingTime = Date.now() - startTime;
    
    console.log(`✅ NER extraction complete: ${organizations.length} organizations found (${processingTime}ms)`);
    console.log('Organizations:', organizations);

    return {
      entities: entities.slice(0, maxEntities),
      organizations: organizations.slice(0, maxEntities),
      processing_time_ms: processingTime
    };

  } catch (error: unknown) {
    console.error('❌ NER extraction failed:', error);
    throw error;
  }
}

/**
 * Lightweight entity validation
 */
export function validateOrganizationEntity(name: string): boolean {
  const normalized = name.toLowerCase().trim();
  
  // Basic validation
  if (normalized.length < 3 || normalized.length > 30) {
    return false;
  }

  // Must start with capital letter
  if (!/^[A-Z]/.test(name)) {
    return false;
  }

  // Reject common stopwords that should never be organizations
  const organizationStopwords = new Set([
    'using', 'making', 'while', 'experience', 'solution', 'platform', 'service',
    'system', 'tool', 'software', 'application', 'business', 'company', 'team',
    'project', 'management', 'development', 'marketing', 'sales', 'support'
  ]);

  if (organizationStopwords.has(normalized)) {
    return false;
  }

  // Reject purely numeric or problematic characters
  if (/^[0-9]+$/.test(normalized) || /[<>{}[\]()"`''""''„"‚'']/.test(normalized)) {
    return false;
  }

  return true;
}