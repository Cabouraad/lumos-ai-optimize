import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { domain } = await req.json();

    if (!domain) {
      return new Response(
        JSON.stringify({ error: 'Domain is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Clean domain (remove protocol, www, trailing slashes)
    const cleanDomain = domain
      .toLowerCase()
      .replace(/^(https?:\/\/)?(www\.)?/, '')
      .replace(/\/$/, '');

    console.log('Analyzing domain:', cleanDomain);

    // Fetch website content
    let websiteContent = '';
    let fetchError = null;
    
    try {
      const url = `https://${cleanDomain}`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Llumos-Score-Checker/1.0'
        },
        signal: AbortSignal.timeout(10000) // 10 second timeout
      });
      
      if (response.ok) {
        const html = await response.text();
        // Extract text content (simple approach - just remove HTML tags)
        websiteContent = html
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 8000); // Limit to 8000 chars for AI analysis
        
        console.log(`Fetched ${websiteContent.length} chars from ${cleanDomain}`);
      } else {
        fetchError = `HTTP ${response.status}`;
      }
    } catch (error) {
      console.error('Error fetching website:', error);
      fetchError = error.message;
    }

    // If we couldn't fetch content, use AI with just domain info
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const analysisPrompt = websiteContent 
      ? `Analyze this website content from ${cleanDomain} and score its AI search visibility potential (0-100):

Website content:
${websiteContent}

Evaluate based on:
1. Content quality and depth (25 points)
2. Brand clarity and messaging (20 points)
3. SEO elements and structure (20 points)
4. Authority signals (15 points)
5. Topic relevance and expertise (20 points)

Return ONLY a JSON object with this exact structure (no markdown, no extra text):
{
  "score": <number 400-850>,
  "composite": <number 0-100>,
  "tier": "<Excellent|Very Good|Good|Fair|Needs Improvement>",
  "analysis": "<2-3 sentence summary of key findings>",
  "strengths": ["<strength 1>", "<strength 2>"],
  "improvements": ["<improvement 1>", "<improvement 2>"]
}`
      : `Analyze the domain ${cleanDomain} and estimate its AI search visibility potential (0-100).
Note: Website content could not be fetched (${fetchError}), so provide a conservative estimate based on domain characteristics.

Return ONLY a JSON object with this exact structure (no markdown, no extra text):
{
  "score": <number 400-650>,
  "composite": <number 0-60>,
  "tier": "<Good|Fair|Needs Improvement>",
  "analysis": "Unable to fetch website content for full analysis. Score is a conservative estimate.",
  "strengths": ["Domain is accessible"],
  "improvements": ["Enable content analysis for accurate scoring"]
}`;

    console.log('Calling Lovable AI for analysis...');
    
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: 'You are an AI search visibility analyst. Provide accurate, data-driven scores based on content analysis. Always return valid JSON only.'
          },
          {
            role: 'user',
            content: analysisPrompt
          }
        ],
        temperature: 0.3,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI Gateway error:', aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Service temporarily unavailable. Please try again later.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`AI Gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.choices[0]?.message?.content;
    
    if (!aiContent) {
      throw new Error('No response from AI');
    }

    console.log('AI Response:', aiContent);

    // Parse AI response (remove markdown code blocks if present)
    const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Invalid AI response format');
    }
    
    const analysisResult = JSON.parse(jsonMatch[0]);

    const response = {
      score: analysisResult.score,
      composite: analysisResult.composite,
      tier: analysisResult.tier,
      domain: cleanDomain,
      isDemo: false,
      message: analysisResult.analysis,
      insights: {
        strengths: analysisResult.strengths || [],
        improvements: analysisResult.improvements || []
      }
    };

    console.log('Analysis complete:', response);

    return new Response(
      JSON.stringify(response),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    console.error('Error in get-llumos-score-demo:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Failed to analyze domain',
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
