import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Test prompt for consistent API testing
const TEST_PROMPT = "What are the best cloud storage solutions for small businesses in 2024? Please provide specific recommendations.";

interface APITestResult {
  provider: string;
  success: boolean;
  response?: string;
  model?: string;
  tokenIn?: number;
  tokenOut?: number;
  error?: string;
  duration?: number;
}

async function testOpenAI(apiKey: string): Promise<APITestResult> {
  const start = Date.now();
  try {
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
            content: 'You are a helpful AI assistant. Answer comprehensively and include brand names in your response. After your response, include a JSON object with "brands" array.'
          },
          {
            role: 'user',
            content: TEST_PROMPT
          }
        ],
        max_tokens: 1000,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content || '';
    const usage = data.usage || {};

    return {
      provider: 'openai',
      success: true,
      response: content,
      model: 'gpt-4.1-2025-04-14',
      tokenIn: usage.prompt_tokens || 0,
      tokenOut: usage.completion_tokens || 0,
      duration: Date.now() - start
    };
  } catch (error: any) {
    return {
      provider: 'openai',
      success: false,
      error: error.message,
      duration: Date.now() - start
    };
  }
}

async function testPerplexity(apiKey: string): Promise<APITestResult> {
  const start = Date.now();
  try {
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful AI assistant. Answer comprehensively with web search and include brand names. After your response, include a JSON object with "brands" array.'
          },
          {
            role: 'user',
            content: TEST_PROMPT
          }
        ],
        max_tokens: 1000,
        stream: false,
        return_images: false,
        return_related_questions: false,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content || '';
    const usage = data.usage || {};

    return {
      provider: 'perplexity',
      success: true,
      response: content,
      model: 'sonar',
      tokenIn: usage.prompt_tokens || 0,
      tokenOut: usage.completion_tokens || 0,
      duration: Date.now() - start
    };
  } catch (error: any) {
    return {
      provider: 'perplexity',
      success: false,
      error: error.message,
      duration: Date.now() - start
    };
  }
}

async function testGemini(apiKey: string): Promise<APITestResult> {
  const start = Date.now();
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
                text: TEST_PROMPT + '\n\nAfter your response, include a JSON object with a "brands" array containing brand names you mentioned.'
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 1000,
        }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const usage = data.usageMetadata || {};

    return {
      provider: 'gemini',
      success: true,
      response: content,
      model: 'gemini-1.5-flash-latest',
      tokenIn: usage.promptTokenCount || 0,
      tokenOut: usage.candidatesTokenCount || 0,
      duration: Date.now() - start
    };
  } catch (error: any) {
    return {
      provider: 'gemini',
      success: false,
      error: error.message,
      duration: Date.now() - start
    };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get API keys
    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    const perplexityKey = Deno.env.get('PERPLEXITY_API_KEY');
    const geminiKey = Deno.env.get('GEMINI_API_KEY');

    console.log('Starting comprehensive scheduler API tests...');
    console.log('API Keys available:', {
      openai: !!openaiKey,
      perplexity: !!perplexityKey,
      gemini: !!geminiKey
    });

    const results: APITestResult[] = [];

    // Test OpenAI
    if (openaiKey) {
      console.log('Testing OpenAI API...');
      const openaiResult = await testOpenAI(openaiKey);
      results.push(openaiResult);
      console.log(`OpenAI test ${openaiResult.success ? 'SUCCESS' : 'FAILED'}:`, 
        openaiResult.success ? `${openaiResult.tokenIn}/${openaiResult.tokenOut} tokens, ${openaiResult.duration}ms` : openaiResult.error);
    } else {
      results.push({
        provider: 'openai',
        success: false,
        error: 'API key not configured'
      });
    }

    // Test Perplexity
    if (perplexityKey) {
      console.log('Testing Perplexity API...');
      const perplexityResult = await testPerplexity(perplexityKey);
      results.push(perplexityResult);
      console.log(`Perplexity test ${perplexityResult.success ? 'SUCCESS' : 'FAILED'}:`, 
        perplexityResult.success ? `${perplexityResult.tokenIn}/${perplexityResult.tokenOut} tokens, ${perplexityResult.duration}ms` : perplexityResult.error);
    } else {
      results.push({
        provider: 'perplexity',
        success: false,
        error: 'API key not configured'
      });
    }

    // Test Gemini
    if (geminiKey) {
      console.log('Testing Gemini API...');
      const geminiResult = await testGemini(geminiKey);
      results.push(geminiResult);
      console.log(`Gemini test ${geminiResult.success ? 'SUCCESS' : 'FAILED'}:`, 
        geminiResult.success ? `${geminiResult.tokenIn}/${geminiResult.tokenOut} tokens, ${geminiResult.duration}ms` : geminiResult.error);
    } else {
      results.push({
        provider: 'gemini',
        success: false,
        error: 'API key not configured'
      });
    }

    // Check scheduler state and timing
    const { data: schedulerState } = await supabase
      .from('scheduler_state')
      .select('*')
      .eq('id', 'global')
      .single();

    // Check if we're in the 3AM EST window
    const now = new Date();
    const nyTime = new Date().toLocaleString("en-US", {
      timeZone: "America/New_York",
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    const currentHourNY = parseInt(nyTime.split(':')[0]);
    const isPast3AM = currentHourNY >= 3;

    // Get enabled providers from database
    const { data: enabledProviders } = await supabase
      .from('llm_providers')
      .select('name, enabled')
      .eq('enabled', true);

    // Check organizations and prompts
    const { data: organizations } = await supabase
      .from('organizations')
      .select('id, name, plan_tier');

    let totalActivePrompts = 0;
    if (organizations) {
      for (const org of organizations) {
        const { data: prompts } = await supabase
          .from('prompts')
          .select('id')
          .eq('org_id', org.id)
          .eq('active', true);
        totalActivePrompts += prompts?.length || 0;
      }
    }

    const summary = {
      timestamp: new Date().toISOString(),
      nyTime: nyTime,
      isPast3AM,
      testPrompt: TEST_PROMPT,
      apiTests: results,
      schedulerReady: results.filter(r => r.success).length > 0,
      schedulerState: schedulerState,
      databaseStatus: {
        organizations: organizations?.length || 0,
        activePrompts: totalActivePrompts,
        enabledProviders: enabledProviders?.map(p => p.name) || []
      },
      recommendations: {
        readyForScheduledRun: isPast3AM && results.filter(r => r.success).length > 0,
        issues: [
          ...(!openaiKey ? ['OpenAI API key missing'] : []),
          ...(!perplexityKey ? ['Perplexity API key missing'] : []),
          ...(!geminiKey ? ['Gemini API key missing'] : []),
          ...(results.filter(r => r.success).length === 0 ? ['No working API providers'] : []),
          ...(!isPast3AM ? ['Outside 3AM EST execution window'] : []),
          ...(totalActivePrompts === 0 ? ['No active prompts to process'] : [])
        ]
      }
    };

    console.log('API test summary:', summary);

    return new Response(
      JSON.stringify(summary, null, 2),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Scheduler API test error:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Test failed',
        message: error.message,
        timestamp: new Date().toISOString()
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});