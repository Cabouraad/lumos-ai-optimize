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
  const perplexityKey = Deno.env.get('PERPLEXITY_API_KEY');
  const geminiKey = Deno.env.get('GEMINI_API_KEY');
  
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
            
          } catch (error: any) {
            attempt++;
            console.error(`[Perplexity:test] ${model} attempt ${attempt} error:`, error.message);
            
            // Don't retry on auth errors
            if (error.message?.includes('401') || error.message?.includes('403')) {
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

      let attempt = 0;
      const maxAttempts = 3;
      
      while (attempt < maxAttempts) {
        try {
          console.log(`[Gemini:test] Attempt ${attempt + 1}`);
          
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
            generationConfig: {
              temperature: 0.7,
              topK: 40,
              topP: 0.95,
              maxOutputTokens: 1000,
            }
          };

          const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${keyToUse}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
          });

          if (!res.ok) {
            const bodyText = await res.text().catch(() => '');
            const error = new Error(`Gemini error: ${res.status} ${res.statusText} — ${bodyText}`);
            console.error(`[Gemini:test] Attempt ${attempt + 1} failed: ${res.status} ${res.statusText} — Body: ${bodyText?.slice(0, 500)}`);
            
            // Don't retry on auth/bad request errors
            if (res.status === 401 || res.status === 403 || res.status === 400) {
              throw error;
            }
            
            throw error;
          }

          const data = await res.json();
          console.log(`[Gemini:test] Success`);
          const aiResponse = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
          
          return new Response(JSON.stringify({ 
            response: aiResponse,
            provider: 'gemini',
            model: 'gemini-1.5-flash-latest'
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
          
        } catch (error: any) {
          attempt++;
          console.error(`[Gemini:test] Attempt ${attempt} error:`, error.message);
          
          // Don't retry on auth errors
          if (error.message?.includes('401') || error.message?.includes('403')) {
            break;
          }
          
          if (attempt < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          }
        }
      }

      throw new Error('Gemini error: all attempts failed');
    } else {
      throw new Error('Invalid provider specified');
    }

  } catch (error) {
    console.error('Error in test-prompt-response function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});