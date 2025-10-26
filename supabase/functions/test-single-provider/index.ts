import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { computeVisibilityScore } from "../_shared/scoring.ts";
import { getOrgSubscriptionTier, isProviderAllowed, auditProviderFilter } from '../_shared/provider-policy.ts';

import { corsHeaders } from '../_shared/cors.ts';

// Simple provider execution functions
async function executeOpenAI(promptText: string): Promise<{ responseText: string; tokenIn: number; tokenOut: number; fullResponse: any }> {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) throw new Error('OpenAI API key not configured');

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-5-2025-08-07',
      messages: [{ role: 'user', content: promptText }],
      max_completion_tokens: 2000,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`OpenAI API error ${response.status}:`, errorText);
    throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return {
    responseText: data.choices[0]?.message?.content || '',
    tokenIn: data.usage?.prompt_tokens || 0,
    tokenOut: data.usage?.completion_tokens || 0,
    fullResponse: data
  };
}

async function executeGemini(promptText: string): Promise<{ responseText: string; tokenIn: number; tokenOut: number; fullResponse: any }> {
  console.log('=== GEMINI STANDARDIZED v2 ===');
  
  // Use multiple fallback environment variable names for compatibility
  const apiKey = Deno.env.get('GEMINI_API_KEY') || Deno.env.get('GOOGLE_API_KEY') || Deno.env.get('GOOGLE_GENAI_API_KEY') || Deno.env.get('GENAI_API_KEY');
  
  console.log('API Key Check:', {
    hasGeminiKey: !!Deno.env.get('GEMINI_API_KEY'),
    hasGoogleApiKey: !!Deno.env.get('GOOGLE_API_KEY'),
    hasGoogleGenaiKey: !!Deno.env.get('GOOGLE_GENAI_API_KEY'),
    hasGenaiKey: !!Deno.env.get('GENAI_API_KEY'),
    finalKeyFound: !!apiKey,
    keyLength: apiKey ? apiKey.length : 0
  });
  
  if (!apiKey) {
    console.error('GEMINI API KEY ERROR: No API key found in any environment variable');
    throw new Error('Gemini API key not configured');
  }

  console.log(`Starting Gemini API call with key length: ${apiKey.length}`);

  const maxAttempts = 3;
  let attempt = 0;
  let lastError: Error | null = null;

  while (attempt < maxAttempts) {
    try {
      attempt++;
      console.log(`[Gemini] Attempt ${attempt}/${maxAttempts}`);

      const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-goog-api-key': apiKey
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: promptText }] }],
          generationConfig: { 
            temperature: 0.3, 
            maxOutputTokens: 2000,
            topK: 40,
            topP: 0.95
          },
        }),
      });

      console.log(`[Gemini] Response status: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        const errorText = await response.text();
        const error = new Error(`Gemini API error: ${response.status} ${response.statusText} - ${errorText}`);
        console.error(`[Gemini] API Error Details:`, {
          status: response.status,
          statusText: response.statusText,
          errorBody: errorText.substring(0, 500) + (errorText.length > 500 ? '...' : '')
        });
        
        // Don't retry on authentication or bad request errors
        if (response.status === 401 || response.status === 403 || response.status === 400) {
          console.error(`[Gemini] Non-retryable error: ${response.status}`);
          throw error;
        }
        
        lastError = error;
        if (attempt < maxAttempts) {
          const delay = 1000 * Math.pow(2, attempt - 1);
          console.log(`[Gemini] Retrying after ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        throw error;
      }

      const data = await response.json();
      console.log('[Gemini] Response received successfully');
      
      const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const usage = data.usageMetadata || {};
      
      console.log(`[Gemini] Success - Content length: ${content.length}, Tokens in: ${usage.promptTokenCount || 0}, Tokens out: ${usage.candidatesTokenCount || 0}`);
      
      return {
        responseText: content,
        tokenIn: usage.promptTokenCount || 0,
        tokenOut: usage.candidatesTokenCount || 0,
        fullResponse: data
      };
    } catch (error: unknown) {
      lastError = error;
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[Gemini] Attempt ${attempt}/${maxAttempts} failed:`, errorMessage);
      
      // Don't retry on auth errors
      if (errorMessage?.includes('401') || errorMessage?.includes('403')) {
        console.error('[Gemini] Authentication error detected - stopping retries');
        break;
      }
      
      if (attempt < maxAttempts) {
        const delay = 1000 * Math.pow(2, attempt - 1);
        console.log(`[Gemini] Waiting ${delay}ms before next retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  const finalError = lastError || new Error('Gemini API failed after all attempts');
  console.error('[Gemini] ALL ATTEMPTS FAILED:', finalError.message);
  throw finalError;
}

async function executePerplexity(promptText: string): Promise<{ responseText: string; tokenIn: number; tokenOut: number; fullResponse: any }> {
  const apiKey = Deno.env.get('PERPLEXITY_API_KEY');
  if (!apiKey) throw new Error('Perplexity API key not configured');

  const response = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'sonar',
      messages: [{ role: 'user', content: promptText }],
      temperature: 0.3,
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    throw new Error(`Perplexity API error: ${response.status}`);
  }

  const data = await response.json();
  console.log('[Perplexity] Full response structure:', JSON.stringify(data).substring(0, 300));
  
  return {
    responseText: data.choices[0]?.message?.content || '',
    tokenIn: data.usage?.prompt_tokens || 0,
    tokenOut: data.usage?.completion_tokens || 0,
    fullResponse: data // Return full API response for citation extraction
  };
}

// Response analysis using comprehensive brand analyzer
async function analyzeResponse(responseText: string, orgName: string) {
  console.log(`Analyzing response for org: ${orgName}`);
  
  try {
    // Use comprehensive brand analyzer
    const { analyzePromptResponse } = await import('../_shared/brand-response-analyzer.ts');
    
    // Create mock brand catalog with org name
    const mockBrandCatalog = [
      { name: orgName, is_org_brand: true, variants_json: [orgName.toLowerCase()] }
    ];
    
    const analysis = await analyzePromptResponse(
      responseText,
      { name: orgName },
      mockBrandCatalog
    );
    
    console.log(`Comprehensive analysis complete: Brand=${analysis.org_brand_present}, Competitors=${analysis.competitors_json.length}, Score=${analysis.score}`);
    
    return {
      brandPresent: analysis.org_brand_present,
      brandMentions: analysis.brands_json.length,
      brandPosition: analysis.org_brand_prominence || 0,
      competitors: analysis.competitors_json,
      competitorMentions: analysis.competitors_json.length,
      score: analysis.score,
      confidence: analysis.metadata.confidence_score,
      globalCompetitorsFound: analysis.metadata.global_competitors,
      catalogCompetitors: analysis.metadata.catalog_competitors,
      discoveredCompetitors: analysis.metadata.discovered_competitors,
      enhancedAnalysis: true,
      method: analysis.metadata.analysis_method
    };
    
  } catch (error: unknown) {
    console.error('Comprehensive analysis failed, using fallback:', error);
    
    // Fallback basic analysis
    const brandPresent = responseText.toLowerCase().includes(orgName.toLowerCase());
    const brandMentions = brandPresent ? 1 : 0;
    const score = brandPresent ? 6.0 : 1.0;
    
    return {
      brandPresent,
      brandMentions,
      brandPosition: brandPresent ? 1 : 0,
      competitors: [],
      competitorMentions: 0,
      score,
      confidence: 0.5,
      globalCompetitorsFound: 0,
      enhancedAnalysis: false,
      fallbackUsed: true
    };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Safely parse request body
    const requestText = await req.text();
    if (!requestText || requestText.trim() === '') {
      throw new Error('Empty request body');
    }
    
    let requestBody;
    try {
      requestBody = JSON.parse(requestText);
    } catch (parseError: unknown) {
      console.error('JSON parse error:', parseError);
      throw new Error('Invalid JSON in request body');
    }
    
    const { promptText, provider, orgId } = requestBody;
    
    // Debug what we received
    console.log(`=== SINGLE PROVIDER TEST: ${provider} ===`);
    console.log(`Request body:`, JSON.stringify(requestBody));
    console.log(`Prompt: ${promptText?.substring(0, 50)}...`);
    console.log(`Provider: ${provider}`);
    console.log(`OrgId: ${orgId}`);

    if (!promptText || !provider || !orgId) {
      console.error(`=== PROVIDER TEST ERROR === Missing promptText, provider, or orgId`);
      console.error(`promptText: ${promptText ? 'present' : 'missing'}`);
      console.error(`provider: ${provider ? 'present' : 'missing'}`);
      console.error(`orgId: ${orgId ? 'present' : 'missing'}`);
      throw new Error('Missing promptText, provider, or orgId');
    }

    // Check provider access based on subscription tier
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Get organization subscription tier
    const subscriptionTier = await getOrgSubscriptionTier({ from: () => ({ select: () => ({ eq: () => ({ single: async () => {
      const orgResponse = await fetch(`${supabaseUrl}/rest/v1/organizations?id=eq.${orgId}&select=plan_tier`, {
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'apikey': supabaseKey,
          'Content-Type': 'application/json'
        }
      });
      
      if (!orgResponse.ok) {
        throw new Error('Failed to fetch organization data');
      }
      
      const orgData = await orgResponse.json();
      return { data: orgData?.[0] };
    } }) }) }) }, orgId);
    
    // Check if provider is allowed for this tier
    if (!isProviderAllowed(provider.toLowerCase() as any, subscriptionTier)) {
      auditProviderFilter(orgId, subscriptionTier, [provider], [], [provider]);
      throw new Error(`Provider '${provider}' not allowed for ${subscriptionTier} tier. Upgrade to access this provider.`);
    }
    
    const orgResponse = await fetch(`${supabaseUrl}/rest/v1/organizations?id=eq.${orgId}&select=name`, {
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'apikey': supabaseKey,
        'Content-Type': 'application/json'
      }
    });
    
    if (!orgResponse.ok) {
      throw new Error('Failed to fetch organization data');
    }
    
    const orgData = await orgResponse.json();
    const orgName = orgData?.[0]?.name || 'Unknown Organization';

    console.log(`✅ Provider ${provider} allowed for ${subscriptionTier} tier`);

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

    // Analyze the response - add await
    const analysis = await analyzeResponse(response.responseText, orgName);
    
    // Extract citations from response
    let citationsData = null;
    try {
      const { extractPerplexityCitations, extractGeminiCitations, extractOpenAICitations } = 
        await import('../_shared/citations-enhanced.ts');
      
      switch (provider.toLowerCase()) {
        case 'perplexity':
          // Pass full API response for proper citation extraction
          citationsData = extractPerplexityCitations(response.fullResponse || {}, response.responseText);
          break;
        case 'gemini':
          citationsData = extractGeminiCitations(response.fullResponse || {}, response.responseText);
          break;
        case 'openai':
          citationsData = extractOpenAICitations(response.responseText);
          break;
      }
      
      if (citationsData?.citations?.length > 0) {
        console.log(`[${provider}] Extracted ${citationsData.citations.length} citations`);
      }
    } catch (citationError: any) {
      console.error(`[${provider}] Citation extraction failed:`, citationError.message);
    }
    
    console.log(`✅ ${provider} success:`, {
      score: analysis.score,
      brandPresent: analysis.brandPresent,
      competitors: analysis.competitors?.length || 0,
      citations: citationsData?.citations?.length || 0
    });

    return new Response(
      JSON.stringify({
        success: true,
        responseId: crypto.randomUUID(),
        responseText: response.responseText,
        tokenIn: response.tokenIn,
        tokenOut: response.tokenOut,
        citations: citationsData?.citations || [],
        citationCount: citationsData?.citations?.length || 0,
        subscriptionTier,
        providerAllowed: true,
        ...analysis
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error(`=== PROVIDER TEST ERROR ===`, err.message);
    console.error('Error stack:', err.stack);
    
    // Ensure we always return valid JSON
    const errorResponse = {
      success: false,
      error: err.message || 'Unknown error occurred',
      timestamp: new Date().toISOString()
    };
    
    return new Response(
      JSON.stringify(errorResponse),
      { 
        status: 200, // Return 200 so client can parse the error
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});