import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// LLM Prompt Templates
const OPTIMIZER_SYSTEM = `
You are an AI Search Optimization strategist for brand visibility in LLM answers
(ChatGPT, Perplexity, Gemini, Google AI Overviews). You produce actionable content ideas
tailored to a specific "tracked prompt" and the brand's current weaknesses.
Keep output concise, structured, and directly publishable.
`;

function optimizerUserPrompt(args: {
  brand: string;
  promptText: string;
  presenceRate: number;
  competitors: string[];
  citations: {domain: string; title?: string; link: string}[];
}) {
  const { brand, promptText, presenceRate, competitors, citations } = args;
  const cites = citations.slice(0, 8).map((c: any) => `- ${c.domain} ${c.title ? `— ${c.title}` : ''} (${c.link})`).join('\n');
  const comp = competitors.slice(0, 8).join(', ') || 'None observed';
  
  return `
BRAND: ${brand}
TRACKED PROMPT: "${promptText}"
CURRENT PRESENCE: ${presenceRate.toFixed(1)}% (last 14 days)
COMPETITORS IN RESPONSES: ${comp}
TOP CITATION DOMAINS LATELY:
${cites}

TASKS:
1) Propose 2 SOCIAL POSTS (LinkedIn + X). Each: hook + 2-3 bullets + CTA. Use language aligned to the tracked prompt.
2) Propose 1 BLOG OUTLINE (H2/H3 + bullets) targeting the same prompt angle; include 3 internal link ideas + 3 external outreach targets (by domain) from the citations above.
3) Provide 5 TALKING POINTS to increase brand mention likelihood in LLM answers for this prompt.
4) Provide 3 CTA SNIPPETS (≤120 chars) aligned to the prompt intent.

RULES:
- Reference our BRAND where natural, but avoid spam.
- Adapt tone to B2B SaaS.
- Prefer using and improving content that aligns with citation domains; avoid competitors by name.
- Return JSON with keys: social_posts[], blog_outline{title,sections[]}, talking_points[], cta_snippets[], projected_impact.
`;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Check CRON_SECRET for security
    const cronSecret = Deno.env.get('CRON_SECRET');
    const providedSecret = req.headers.get('x-cron-secret');
    
    if (!cronSecret || providedSecret !== cronSecret) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('[optimization-worker] Starting job processing...');

    // Get next queued job
    const { data: job, error: jobError } = await supabase
      .from('optimization_jobs')
      .select('*')
      .eq('status', 'queued')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (jobError) {
      console.error('[optimization-worker] Error fetching job:', jobError);
      return new Response(JSON.stringify({ error: 'Database error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!job) {
      console.log('[optimization-worker] No queued jobs found');
      return new Response(JSON.stringify({ message: 'No jobs to process' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[optimization-worker] Processing job:', job.id, 'scope:', job.scope);

    // Mark job as running
    await supabase
      .from('optimization_jobs')
      .update({ 
        status: 'running', 
        started_at: new Date().toISOString() 
      })
      .eq('id', job.id);

    try {
      // Get organization info
      const { data: orgData, error: orgError } = await supabase
        .from('organizations')
        .select('name, domain')
        .eq('id', job.org_id)
        .single();

      if (orgError || !orgData) {
        throw new Error('Organization not found');
      }

      const brandName = orgData.name;

      // Determine target prompts based on scope
      let targetPrompts: any[] = [];

      if (job.scope === 'org') {
        // Get low visibility prompts for the org
        const { data: lowVisPrompts, error: promptsError } = await supabase
          .from('low_visibility_prompts')
          .select('*')
          .eq('org_id', job.org_id)
          .limit(10); // Process up to 10 low-visibility prompts

        if (promptsError) {
          throw new Error(`Failed to fetch low visibility prompts: ${promptsError.message}`);
        }

        targetPrompts = lowVisPrompts || [];
      } else if (job.scope === 'prompt' && job.prompt_ids) {
        // Get specific prompts
        const { data: specificPrompts, error: specificError } = await supabase
          .from('prompts')
          .select('id, text, org_id')
          .eq('org_id', job.org_id)
          .in('id', job.prompt_ids);

        if (specificError) {
          throw new Error(`Failed to fetch specific prompts: ${specificError.message}`);
        }

        // Add presence rate data
        targetPrompts = (specificPrompts || []).map(p => ({
          prompt_id: p.id,
          prompt_text: p.text,
          org_id: p.org_id,
          presence_rate: 0, // Will be calculated later if needed
          runs: 0
        }));
      }

      if (targetPrompts.length === 0) {
        throw new Error('No target prompts found');
      }

      console.log('[optimization-worker] Processing', targetPrompts.length, 'prompts');

      // Process each prompt
      const allOptimizations: any[] = [];

      for (const prompt of targetPrompts) {
        try {
          console.log('[optimization-worker] Processing prompt:', prompt.prompt_id);

          // Get recent responses and citations for this prompt
          const { data: responses, error: responsesError } = await supabase
            .from('prompt_provider_responses')
            .select('competitors_json, citations_json, org_brand_present')
            .eq('prompt_id', prompt.prompt_id)
            .eq('status', 'success')
            .gte('run_at', new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString())
            .order('run_at', { ascending: false })
            .limit(20);

          // Extract competitors and citations
          const competitors: string[] = [];
          const citations: {domain: string; title?: string; link: string}[] = [];

          if (responses) {
            for (const response of responses) {
              if (response.competitors_json) {
                try {
                  const compArray = Array.isArray(response.competitors_json) 
                    ? response.competitors_json 
                    : JSON.parse(response.competitors_json);
                  competitors.push(...compArray);
                } catch (e) {
                  console.warn('[optimization-worker] Failed to parse competitors:', e);
                }
              }

              if (response.citations_json) {
                try {
                  const citArray = Array.isArray(response.citations_json) 
                    ? response.citations_json 
                    : JSON.parse(response.citations_json);
                  
                  for (const cit of citArray) {
                    if (cit.value) {
                      try {
                        const url = new URL(cit.value);
                        citations.push({
                          domain: url.hostname,
                          title: cit.title || '',
                          link: cit.value
                        });
                      } catch (urlError) {
                        // Skip invalid URLs
                      }
                    }
                  }
                } catch (e) {
                  console.warn('[optimization-worker] Failed to parse citations:', e);
                }
              }
            }
          }

          // Dedupe competitors and citations
          const uniqueCompetitors = [...new Set(competitors)];
          const uniqueCitations = citations.reduce((acc: any[], curr) => {
            if (!acc.find((c: any) => c.domain === curr.domain)) {
              acc.push(curr);
            }
            return acc;
          }, []);

          // Generate optimizations using LLM
          const optimizationContent = await generateOptimizations({
            brand: brandName,
            promptText: prompt.prompt_text,
            presenceRate: prompt.presence_rate || 0,
            competitors: uniqueCompetitors,
            citations: uniqueCitations
          });

          // Store optimizations
          const optimizations = await storeOptimizations(
            supabase,
            job.org_id,
            job.id,
            prompt.prompt_id,
            optimizationContent,
            uniqueCitations,
            prompt.presence_rate || 0
          );

          allOptimizations.push(...optimizations);

        } catch (promptError) {
          console.error('[optimization-worker] Error processing prompt:', prompt.prompt_id, promptError);
          // Continue with other prompts
        }
      }

      // Mark job as done
      await supabase
        .from('optimization_jobs')
        .update({ 
          status: 'done', 
          finished_at: new Date().toISOString() 
        })
        .eq('id', job.id);

      console.log('[optimization-worker] Job completed:', job.id, 'Generated', allOptimizations.length, 'optimizations');

      return new Response(JSON.stringify({ 
        message: 'Job completed successfully',
        jobId: job.id,
        optimizationsGenerated: allOptimizations.length
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } catch (processingError) {
      console.error('[optimization-worker] Job processing failed:', processingError);
      
      // Mark job as error
      await supabase
        .from('optimization_jobs')
        .update({ 
          status: 'error', 
          finished_at: new Date().toISOString(),
          error_text: processingError.message 
        })
        .eq('id', job.id);

      return new Response(JSON.stringify({ 
        error: 'Job processing failed',
        jobId: job.id,
        details: processingError.message
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

  } catch (error: unknown) {
    console.error('[optimization-worker] Unexpected error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function generateOptimizations(args: {
  brand: string;
  promptText: string;
  presenceRate: number;
  competitors: string[];
  citations: {domain: string; title?: string; link: string}[];
}) {
  const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
  
  if (!openAIApiKey) {
    throw new Error('OpenAI API key not configured');
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openAIApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: OPTIMIZER_SYSTEM },
        { role: 'user', content: optimizerUserPrompt(args) }
      ],
      temperature: 0.7,
      max_tokens: 2000
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices[0].message.content;

  try {
    return JSON.parse(content);
  } catch (parseError) {
    console.error('[optimization-worker] Failed to parse LLM response:', content);
    throw new Error('Invalid JSON response from LLM');
  }
}

async function storeOptimizations(
  supabase: any,
  orgId: string,
  jobId: string,
  promptId: string,
  content: any,
  sources: any[],
  scoreBefore: number
) {
  const optimizations: any[] = [];

  // Store social posts
  if (content.social_posts && Array.isArray(content.social_posts)) {
    for (let i = 0; i < content.social_posts.length; i++) {
      const post = content.social_posts[i];
      optimizations.push({
        org_id: orgId,
        job_id: jobId,
        prompt_id: promptId,
        content_type: 'social_post',
        title: `Social Post ${i + 1}`,
        body: typeof post === 'string' ? post : JSON.stringify(post),
        sources: JSON.stringify(sources),
        score_before: scoreBefore,
        projected_impact: content.projected_impact || 'Increase brand visibility in social feeds'
      });
    }
  }

  // Store blog outline
  if (content.blog_outline) {
    optimizations.push({
      org_id: orgId,
      job_id: jobId,
      prompt_id: promptId,
      content_type: 'blog_outline',
      title: content.blog_outline.title || 'Blog Content Strategy',
      body: JSON.stringify(content.blog_outline),
      sources: JSON.stringify(sources),
      score_before: scoreBefore,
      projected_impact: content.projected_impact || 'Drive organic search traffic'
    });
  }

  // Store talking points
  if (content.talking_points && Array.isArray(content.talking_points)) {
    optimizations.push({
      org_id: orgId,
      job_id: jobId,
      prompt_id: promptId,
      content_type: 'talking_points',
      title: 'Brand Messaging Talking Points',
      body: content.talking_points.join('\n\n'),
      sources: JSON.stringify(sources),
      score_before: scoreBefore,
      projected_impact: content.projected_impact || 'Improve brand mentions in AI responses'
    });
  }

  // Store CTA snippets
  if (content.cta_snippets && Array.isArray(content.cta_snippets)) {
    optimizations.push({
      org_id: orgId,
      job_id: jobId,
      prompt_id: promptId,
      content_type: 'cta_snippets',
      title: 'Call-to-Action Snippets',
      body: content.cta_snippets.join('\n\n'),
      sources: JSON.stringify(sources),
      score_before: scoreBefore,
      projected_impact: content.projected_impact || 'Increase conversion opportunities'
    });
  }

  // Insert all optimizations
  if (optimizations.length > 0) {
    const { error } = await supabase
      .from('optimizations')
      .insert(optimizations);

    if (error) {
      throw new Error(`Failed to store optimizations: ${error.message}`);
    }
  }

  return optimizations;
}