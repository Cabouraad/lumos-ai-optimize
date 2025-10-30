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

    console.log('Generating demo score for domain:', cleanDomain);

    // Generate a consistent score based on domain hash
    const hash = Array.from(cleanDomain).reduce((acc, char) => {
      return ((acc << 5) - acc) + char.charCodeAt(0);
    }, 0);
    
    // Map hash to score range 400-850
    const baseScore = 400 + (Math.abs(hash) % 451);
    
    // Add slight randomization for realism (+/- 10 points)
    const randomOffset = Math.floor(Math.random() * 21) - 10;
    const score = Math.max(400, Math.min(850, baseScore + randomOffset));

    // Calculate composite (0-100 scale)
    const composite = Math.round(((score - 400) / 450) * 100);

    // Determine tier
    let tier = 'Needs Improvement';
    if (score >= 760) tier = 'Excellent';
    else if (score >= 700) tier = 'Very Good';
    else if (score >= 640) tier = 'Good';
    else if (score >= 580) tier = 'Fair';

    // Generate simulated submetrics
    const submetrics = {
      pr: Math.round(composite * 0.95 + Math.random() * 10),
      pp: Math.round(composite * 1.05 - Math.random() * 10),
      cv: Math.round(composite * 0.90 + Math.random() * 15),
      ca: Math.round(composite * 1.02 - Math.random() * 8),
      cs: Math.round(composite * 0.98 + Math.random() * 12),
      fc: Math.round(composite * 0.93 + Math.random() * 14),
    };

    const response = {
      score,
      composite,
      tier,
      submetrics,
      domain: cleanDomain,
      isDemo: true,
      message: 'This is a simulated score for demonstration purposes.',
    };

    console.log('Demo score generated:', response);

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
        error: 'Failed to generate demo score',
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
