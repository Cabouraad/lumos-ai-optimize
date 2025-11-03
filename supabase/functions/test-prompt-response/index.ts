import "https://deno.land/x/xhr@0.1.0/mod.ts";

const ORIGIN = Deno.env.get("APP_ORIGIN") ?? "https://llumos.app";

const corsHeaders = {
  'Access-Control-Allow-Origin': ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const openaiKey = Deno.env.get('OPENAI_API_KEY');
  const perplexityKey = Deno.env.get('PERPLEXITY_API_KEY');
  const geminiKey = Deno.env.get('GEMINI_API_KEY') || Deno.env.get('GOOGLE_API_KEY') || Deno.env.get('GOOGLE_GENAI_API_KEY') || Deno.env.get('GENAI_API_KEY');
  
  try {
    const { prompt, provider, testKey } = await req.json();

    if (!prompt || !provider) {
      return new Response(JSON.stringify({ error: 'Missing prompt or provider' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let response;
    let apiKey;

    if (provider === 'openai') {
      const keyToUse = testKey || openaiKey;
      if (!keyToUse) {
        return new Response(JSON.stringify({ error: 'OpenAI API key not configured' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${keyToUse}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4.1-2025-04-14',
          messages: [
            {
              role: 'system',
              content: 'You are a helpful AI assistant. When providing information, always cite your sources by including relevant URLs as inline citations throughout your response. Use the format [Source Title](https://example.com) for each citation. Include at least 2-3 credible sources when possible.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 1000,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.statusText}`);
      }

      const data = await response.json();
      const aiResponse = data.choices[0].message.content || '';

      return new Response(JSON.stringify({ response: aiResponse }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } else if (provider === 'perplexity') {
      const keyToUse = testKey || perplexityKey;
      if (!keyToUse) {
        return new Response(JSON.stringify({ error: 'Perplexity API key not configured' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Perplexity using official model as per documentation
      const endpoint = 'https://api.perplexity.ai/chat/completions';
      const model = 'sonar';

      let attempt = 0;
      const maxAttempts = 3;
      
      while (attempt < maxAttempts) {
        try {
          console.log(`[Perplexity:test] Trying model: ${model}, attempt ${attempt + 1}`);
          
          // Use exact payload structure from Perplexity documentation
          const payload = {
            model,
            messages: [ { role: 'user', content: prompt } ]
          };

            const res = await fetch(endpoint, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${keyToUse}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(payload),
            });

            if (!res.ok) {
              const bodyText = await res.text().catch(() => '');
              const error = new Error(`Perplexity ${model} error: ${res.status} ${res.statusText} — ${bodyText}`);
              console.error(`[Perplexity:test] ${model} attempt ${attempt + 1} failed: ${res.status} ${res.statusText} — Body: ${bodyText?.slice(0, 500)}`);
              
              // Don't retry on auth/bad request errors
              if (res.status === 401 || res.status === 403 || res.status === 400) {
                throw error;
              }
              
              throw error;
            }

            const data = await res.json();
            console.log(`[Perplexity:test] Success with model: ${model}`);
            const aiResponse = data?.choices?.[0]?.message?.content || '';
            
            return new Response(JSON.stringify({ 
              response: aiResponse,
              provider: 'perplexity',
              model: model
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
            
          } catch (error: unknown) {
            attempt++;
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`[Perplexity:test] ${model} attempt ${attempt} error:`, errorMessage);
            
            // Don't retry on auth errors
            if (errorMessage?.includes('401') || errorMessage?.includes('403')) {
              break;
            }
            
            if (attempt < maxAttempts) {
              await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
            }
          }
        }

      throw new Error('Perplexity error: all attempts failed');
    } else if (provider === 'gemini') {
      const keyToUse = testKey || geminiKey;
      if (!keyToUse) {
        return new Response(JSON.stringify({ error: 'Gemini API key not configured' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log('[Gemini] Starting standardized API call with key length:', keyToUse.length);

      let attempt = 0;
      const maxAttempts = 3;
      
      while (attempt < maxAttempts) {
        try {
          attempt++;
          console.log(`[Gemini:test] Attempt ${attempt}/${maxAttempts}`);
          
          const payload = {
            contents: [
              {
                parts: [
                  {
                    text: prompt
                  }
                ]
              }
            ],
            tools: [{
              google_search_retrieval: {
                dynamic_retrieval_config: {
                  mode: "MODE_DYNAMIC",
                  dynamic_threshold: 0.7
                }
              }
            }],
            generationConfig: {
              temperature: 0.3,
              topK: 40,
              topP: 0.95,
              maxOutputTokens: 1000,
            }
          };

          const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-goog-api-key': keyToUse,
            },
            body: JSON.stringify(payload),
          });

          console.log(`[Gemini:test] Response status: ${res.status} ${res.statusText}`);

          if (!res.ok) {
            const bodyText = await res.text().catch(() => '');
            const error = new Error(`Gemini error: ${res.status} ${res.statusText} — ${bodyText}`);
            console.error(`[Gemini:test] Attempt ${attempt} failed: ${res.status} ${res.statusText} — Body: ${bodyText?.slice(0, 500)}`);
            
            // Don't retry on auth/bad request errors
            if (res.status === 401 || res.status === 403 || res.status === 400) {
              console.error('[Gemini:test] Non-retryable error detected');
              throw error;
            }
            
            if (attempt >= maxAttempts) {
              throw error;
            }
            
            // Wait before retry
            const delay = 1000 * attempt;
            console.log(`[Gemini:test] Waiting ${delay}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }

          const data = await res.json();
          console.log(`[Gemini:test] Success - received response data`);
          const aiResponse = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
          
          return new Response(JSON.stringify({ 
            response: aiResponse,
            provider: 'gemini',
            model: 'gemini-2.0-flash-lite'
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
          
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error(`[Gemini:test] Attempt ${attempt} error:`, errorMessage);
          
          // Don't retry on auth errors
          if (errorMessage?.includes('401') || errorMessage?.includes('403')) {
            console.error('[Gemini:test] Authentication error - stopping retries');
            break;
          }
          
          if (attempt < maxAttempts) {
            const delay = 1000 * attempt;
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }

      throw new Error('Gemini error: all attempts failed');
    } else {
      throw new Error('Invalid provider specified');
    }

  } catch (error: unknown) {
    console.error('Error in test-prompt-response function:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});