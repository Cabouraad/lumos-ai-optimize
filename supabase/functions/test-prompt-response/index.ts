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
  
  try {
    const { prompt, provider } = await req.json();

    if (!prompt || !provider) {
      return new Response(JSON.stringify({ error: 'Missing prompt or provider' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let response;
    let apiKey;

    if (provider === 'openai') {
      if (!openaiKey) {
        return new Response(JSON.stringify({ error: 'OpenAI API key not configured' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiKey}`,
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
      if (!perplexityKey) {
        return new Response(JSON.stringify({ error: 'Perplexity API key not configured' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Perplexity with robust fallback and detailed error logging
      const endpoint = 'https://api.perplexity.ai/chat/completions';
      const models = [
        'llama-3.1-sonar-small-128k-online',
        'llama-3.1-sonar-large-128k-online',
        'llama-3.1-70b-instruct',
        'llama-3.1-8b-instruct'
      ];

      let lastError: any = null;
      for (const model of models) {
        console.log(`[Perplexity:test] Trying model: ${model}`);
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${perplexityKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            messages: [ { role: 'user', content: prompt } ],
            max_tokens: 1000,
            temperature: 0.7,
            return_images: false,
            return_related_questions: false,
            search_recency_filter: 'month',
            frequency_penalty: 1,
            presence_penalty: 0
          }),
        });

        if (!res.ok) {
          const bodyText = await res.text().catch(() => '');
          console.error(`[Perplexity:test] ${model} failed: ${res.status} ${res.statusText} — ${bodyText?.slice(0, 500)}`);
          lastError = new Error(`Perplexity ${model} error: ${res.status} ${res.statusText} — ${bodyText}`);
          continue;
        }

        const data = await res.json();
        const aiResponse = data?.choices?.[0]?.message?.content || '';
        return new Response(JSON.stringify({ response: aiResponse }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      throw lastError || new Error('Perplexity error: all models failed');
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