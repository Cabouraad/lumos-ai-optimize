import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PromptPerformance {
  id: string;
  text: string;
  avgScore: number;
  brandPresent: boolean;
  competitorCount: number;
  missingFromProviders: string[];
  topCompetitors: string[];
  lastRun: string;
}

interface ContentRecommendation {
  type: 'blog_post' | 'case_study' | 'comparison' | 'tutorial' | 'social_post' | 'landing_page';
  title: string;
  rationale: string;
  targetPrompts: string[];
  contentOutline: string[];
  implementationSteps: string[];
  socialStrategy?: {
    platforms: string[];
    postTemplates: string[];
    hashtagStrategy: string[];
  };
  expectedImpact: 'high' | 'medium' | 'low';
  timeToImplement: string;
  seoKeywords: string[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { orgId } = await req.json();
    
    if (!orgId) {
      throw new Error('Organization ID is required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get organization details
    const { data: org } = await supabase
      .from('organizations')
      .select('name, business_description, products_services, target_audience, keywords')
      .eq('id', orgId)
      .single();

    if (!org) {
      throw new Error('Organization not found');
    }

    // Get prompt performance data
    const { data: prompts } = await supabase
      .from('prompts')
      .select('id, text, active')
      .eq('org_id', orgId)
      .eq('active', true);

    if (!prompts || prompts.length === 0) {
      throw new Error('No active prompts found');
    }

    // Get recent performance data
    const { data: responses } = await supabase
      .from('latest_prompt_provider_responses')
      .select('*')
      .in('prompt_id', prompts.map(p => p.id));

    // Get competitor data
    const { data: competitors } = await supabase
      .from('brand_catalog')
      .select('name, total_appearances')
      .eq('org_id', orgId)
      .eq('is_org_brand', false)
      .gt('total_appearances', 0)
      .order('total_appearances', { ascending: false })
      .limit(10);

    // Analyze prompt performance
    const promptPerformance: PromptPerformance[] = prompts.map(prompt => {
      const promptResponses = responses?.filter(r => r.prompt_id === prompt.id) || [];
      const avgScore = promptResponses.length > 0 
        ? promptResponses.reduce((sum, r) => sum + (r.score || 0), 0) / promptResponses.length 
        : 0;
      
      const brandPresent = promptResponses.some(r => r.org_brand_present);
      const competitorCount = Math.max(...promptResponses.map(r => r.competitors_count || 0), 0);
      const missingFromProviders = ['openai', 'gemini', 'perplexity'].filter(provider => 
        !promptResponses.some(r => r.provider === provider && r.org_brand_present)
      );

      // Extract top competitors from this prompt's responses
      const allCompetitors = new Set<string>();
      promptResponses.forEach(r => {
        if (r.competitors_json) {
          (r.competitors_json as string[]).forEach(comp => allCompetitors.add(comp));
        }
      });

      return {
        id: prompt.id,
        text: prompt.text,
        avgScore,
        brandPresent,
        competitorCount,
        missingFromProviders,
        topCompetitors: Array.from(allCompetitors).slice(0, 3),
        lastRun: promptResponses.length > 0 
          ? Math.max(...promptResponses.map(r => new Date(r.run_at || 0).getTime())).toString()
          : '0'
      };
    });

    // Generate intelligent recommendations
    const recommendations: ContentRecommendation[] = [];

    // 1. Low-performing prompts need targeted content
    const lowPerformingPrompts = promptPerformance.filter(p => p.avgScore < 4);
    if (lowPerformingPrompts.length > 0) {
      for (const prompt of lowPerformingPrompts.slice(0, 3)) {
        const contentType = determineContentType(prompt.text);
        const recommendation = generateContentRecommendation(
          prompt, 
          org, 
          contentType,
          competitors?.map(c => c.name) || []
        );
        recommendations.push(recommendation);
      }
    }

    // 2. High-competition prompts need differentiation content
    const highCompetitionPrompts = promptPerformance.filter(p => p.competitorCount > 5);
    if (highCompetitionPrompts.length > 0) {
      const competitivePrompt = highCompetitionPrompts[0];
      recommendations.push(generateCompetitiveContentRecommendation(competitivePrompt, org));
    }

    // 3. Missing brand presence needs awareness content
    const noBrandPrompts = promptPerformance.filter(p => !p.brandPresent);
    if (noBrandPrompts.length > 0) {
      recommendations.push(generateBrandAwarenessRecommendation(noBrandPrompts.slice(0, 2), org));
    }

    // 4. Social media strategy for top-performing prompts
    const goodPerformingPrompts = promptPerformance.filter(p => p.avgScore >= 6);
    if (goodPerformingPrompts.length > 0) {
      recommendations.push(generateSocialMediaStrategy(goodPerformingPrompts.slice(0, 2), org));
    }

    // Store recommendations in database
    let createdCount = 0;
    for (const rec of recommendations) {
      const { error } = await supabase.rpc('reco_upsert', {
        p_org_id: orgId,
        p_kind: rec.type,
        p_title: rec.title,
        p_rationale: rec.rationale,
        p_steps: rec.implementationSteps,
        p_est_lift: rec.expectedImpact === 'high' ? 0.25 : rec.expectedImpact === 'medium' ? 0.15 : 0.08,
        p_source_prompt_ids: rec.targetPrompts,
        p_source_run_ids: [],
        p_citations: [{type: 'ref', value: 'AI Analysis'}],
        p_cooldown_days: 7
      });

      if (!error) {
        createdCount++;
      }
    }

    return new Response(JSON.stringify({
      success: true,
      created: createdCount,
      analyzed: promptPerformance.length,
      recommendations: recommendations.map(r => ({
        title: r.title,
        type: r.type,
        impact: r.expectedImpact,
        targetPrompts: r.targetPrompts.length
      }))
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error generating intelligent recommendations:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function determineContentType(promptText: string): ContentRecommendation['type'] {
  const text = promptText.toLowerCase();
  
  if (text.includes('comparison') || text.includes('vs') || text.includes('alternative')) {
    return 'comparison';
  }
  if (text.includes('how to') || text.includes('tutorial') || text.includes('guide')) {
    return 'tutorial';
  }
  if (text.includes('case study') || text.includes('example') || text.includes('success')) {
    return 'case_study';
  }
  if (text.includes('landing') || text.includes('page') || text.includes('conversion')) {
    return 'landing_page';
  }
  
  return 'blog_post';
}

function generateContentRecommendation(
  prompt: PromptPerformance, 
  org: any, 
  contentType: ContentRecommendation['type'],
  competitors: string[]
): ContentRecommendation {
  const topCompetitors = prompt.topCompetitors.length > 0 ? prompt.topCompetitors : competitors.slice(0, 3);
  
  const templates = {
    blog_post: {
      title: `Create a comprehensive blog post addressing "${prompt.text}"`,
      outline: [
        'Introduction highlighting the key problem/question',
        `How ${org.name} uniquely solves this challenge`,
        'Step-by-step implementation guide',
        'Real-world examples and case studies',
        'Comparison with traditional approaches',
        'Call-to-action with specific next steps'
      ],
      steps: [
        'Research the top 5 search results for this query',
        'Identify gaps in existing content coverage',
        'Create a 2000+ word comprehensive guide',
        'Include original data, screenshots, or examples',
        'Optimize for the specific keywords in the prompt',
        'Add internal links to your product/service pages',
        'Create supporting visuals or infographics'
      ],
      seoKeywords: extractKeywords(prompt.text)
    },
    tutorial: {
      title: `Build a step-by-step tutorial for "${prompt.text}"`,
      outline: [
        'Prerequisites and tools needed',
        'Step-by-step instructions with screenshots',
        `How ${org.name} simplifies this process`,
        'Common mistakes and how to avoid them',
        'Advanced tips and best practices',
        'Next steps and related tutorials'
      ],
      steps: [
        'Create detailed screenshots for each step',
        'Record a video walkthrough',
        'Build downloadable templates or checklists',
        'Create an interactive demo if possible',
        'Optimize for "how to" keywords',
        'Add FAQ section addressing common questions'
      ],
      seoKeywords: ['how to', ...extractKeywords(prompt.text), 'tutorial', 'guide']
    },
    comparison: {
      title: `Develop a comprehensive comparison addressing "${prompt.text}"`,
      outline: [
        'Executive summary of key differences',
        `Why ${org.name} stands out from alternatives`,
        'Feature-by-feature comparison table',
        'Pricing and ROI analysis',
        'User testimonials and case studies',
        'Recommendation based on use cases'
      ],
      steps: [
        'Research all mentioned competitors thoroughly',
        'Create detailed comparison tables',
        'Include honest pros and cons for each option',
        'Add customer testimonials for credibility',
        'Create decision-making framework',
        'Optimize for "[product] vs [competitor]" keywords'
      ],
      seoKeywords: ['vs', 'comparison', 'alternative', ...extractKeywords(prompt.text)]
    },
    case_study: {
      title: `Publish a detailed case study for "${prompt.text}"`,
      outline: [
        'Client background and initial challenge',
        'Solution approach using your methodology',
        'Implementation timeline and process',
        'Measurable results and ROI achieved',
        'Lessons learned and best practices',
        'How others can achieve similar results'
      ],  
      steps: [
        'Interview successful clients for detailed stories',
        'Gather specific metrics and results data',
        'Create before/after comparisons',
        'Include client testimonials and quotes',
        'Document the exact process used',
        'Create templates others can use'
      ],
      seoKeywords: ['case study', 'success story', ...extractKeywords(prompt.text)]
    }
  };

  const template = templates[contentType] || templates.blog_post;

  return {
    type: contentType,
    title: template.title,
    rationale: `Your brand is ${prompt.brandPresent ? 'mentioned but scoring low' : 'completely missing'} in AI responses to "${prompt.text}". This content will establish your authority and improve visibility. Current average score: ${prompt.avgScore.toFixed(1)}/10. Competing against: ${topCompetitors.join(', ')}.`,
    targetPrompts: [prompt.text],
    contentOutline: template.outline,
    implementationSteps: template.steps,
    expectedImpact: prompt.avgScore < 2 ? 'high' : prompt.avgScore < 4 ? 'medium' : 'low',
    timeToImplement: contentType === 'case_study' ? '2-3 weeks' : contentType === 'tutorial' ? '1-2 weeks' : '1 week',
    seoKeywords: template.seoKeywords,
    socialStrategy: {
      platforms: ['LinkedIn', 'Twitter', 'Industry Forums'],
      postTemplates: [
        `Just published: ${template.title.split('"')[1]} - Key insights: [3 bullet points]`,
        `${topCompetitors.length > 0 ? `Unlike ${topCompetitors[0]}, ` : ''}here's how we approach [topic]: [insight]`,
        'Behind the scenes: Creating this guide taught us [key learning]'
      ],
      hashtagStrategy: generateHashtags(org.products_services, template.seoKeywords)
    }
  };
}

function generateCompetitiveContentRecommendation(prompt: PromptPerformance, org: any): ContentRecommendation {
  return {
    type: 'comparison',
    title: `Create a competitive analysis: "Why choose ${org.name} for ${extractMainTopic(prompt.text)}"`,
    rationale: `High competition detected (${prompt.competitorCount} competitors) for "${prompt.text}". You need differentiation content to stand out. Top competitors: ${prompt.topCompetitors.join(', ')}.`,
    targetPrompts: [prompt.text],
    contentOutline: [
      'Market landscape overview',
      `Unique value proposition of ${org.name}`,
      'Head-to-head feature comparison',
      'Customer success stories and testimonials',
      'Pricing and ROI justification',
      'Why customers switch to us'
    ],
    implementationSteps: [
      'Analyze top 3 competitors\' positioning and messaging',
      'Survey recent customers about why they chose you',
      'Create detailed feature comparison matrix',
      'Collect quantifiable ROI data from customers',
      'Develop "switching guide" for prospects',
      'Create interactive comparison tool on your website'
    ],
    expectedImpact: 'high',
    timeToImplement: '2-3 weeks',
    seoKeywords: [org.name, 'vs', 'alternative', 'comparison', ...extractKeywords(prompt.text)],
    socialStrategy: {
      platforms: ['LinkedIn', 'Twitter', 'Reddit', 'Industry Slack/Discord'],
      postTemplates: [
        `Honest comparison: ${org.name} vs [Competitor] - Here's what we found`,
        'Why 85% of our customers switched from [competitor] (data from our analysis)',
        `[Competitor] is great for X, but if you need Y, here's why ${org.name} wins`
      ],
      hashtagStrategy: ['#MarketAnalysis', '#ToolComparison', `#${org.name.replace(/\s+/g, '')}`]
    }
  };
}

function generateBrandAwarenessRecommendation(prompts: PromptPerformance[], org: any): ContentRecommendation {
  const topics = prompts.map(p => extractMainTopic(p.text));
  
  return {
    type: 'blog_post',
    title: `Establish thought leadership: "${org.name}'s approach to ${topics.join(' and ')}"`,
    rationale: `Your brand is completely missing from AI responses to ${prompts.length} key prompts. Need foundational content to establish presence. Target prompts: ${prompts.map(p => `"${p.text}"`).join(', ')}.`,
    targetPrompts: prompts.map(p => p.text),
    contentOutline: [
      `Introduction: ${org.name}'s philosophy and approach`,
      'Industry challenges we've identified',
      'Our unique methodology and framework',
      'Case studies demonstrating our approach',
      'Future vision and trends we're watching',
      'How to get started with our solutions'
    ],
    implementationSteps: [
      'Document your unique processes and methodologies',
      'Create original framework or model',
      'Develop proprietary research or data',
      'Write thought leadership articles',
      'Guest post on industry publications',
      'Speak at industry events and record sessions',
      'Create downloadable resources (whitepapers, guides)',
      'Build backlinks from authoritative sources'
    ],
    expectedImpact: 'high',
    timeToImplement: '3-4 weeks',
    seoKeywords: [org.name, ...topics, 'methodology', 'approach', 'framework'],
    socialStrategy: {
      platforms: ['LinkedIn', 'Twitter', 'Medium', 'Industry Publications'],
      postTemplates: [
        `Our approach to ${topics[0]}: Here's what 10 years in the industry taught us`,
        `Why most ${topics[0]} strategies fail (and what works instead)`,
        `Thread: ${org.name}'s 5-step framework for ${topics[0]} 🧵`
      ],
      hashtagStrategy: ['#ThoughtLeadership', `#${topics[0].replace(/\s+/g, '')}`, '#Industry', `#${org.name.replace(/\s+/g, '')}`]
    }
  };
}

function generateSocialMediaStrategy(prompts: PromptPerformance[], org: any): ContentRecommendation {
  return {
    type: 'social_post', 
    title: `Amplify your strong-performing content with strategic social media`,
    rationale: `You're performing well on these prompts (avg score: ${(prompts.reduce((sum, p) => sum + p.avgScore, 0) / prompts.length).toFixed(1)}/10). Leverage this success with targeted social strategy.`,
    targetPrompts: prompts.map(p => p.text),
    contentOutline: [
      'Content amplification strategy',
      'Platform-specific adaptations',
      'Community engagement plan',
      'Influencer outreach approach',
      'Performance tracking framework'
    ],
    implementationSteps: [
      'Repurpose high-performing content into social posts',
      'Create platform-specific versions (LinkedIn articles, Twitter threads, etc.)',
      'Engage in relevant community discussions',
      'Share insights and behind-the-scenes content',
      'Partner with industry influencers',
      'Use social listening to join relevant conversations',
      'Create shareable assets (quotes, statistics, infographics)'
    ],
    expectedImpact: 'medium',
    timeToImplement: '1 week',
    seoKeywords: prompts.flatMap(p => extractKeywords(p.text)),
    socialStrategy: {
      platforms: ['LinkedIn', 'Twitter', 'Reddit', 'Industry Communities'],
      postTemplates: [
        'Sharing insights from our latest analysis on [topic]',
        'Here\'s what we\'re seeing in the [industry] space:',
        'Quick thread on [topic] based on our experience helping 100+ clients 🧵'
      ],
      hashtagStrategy: generateHashtags(org.products_services, prompts.flatMap(p => extractKeywords(p.text)))
    }
  };
}

function extractKeywords(text: string): string[] {
  // Simple keyword extraction - in production, use more sophisticated NLP
  const words = text.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 3 && !['what', 'how', 'when', 'where', 'why', 'which', 'that', 'this', 'with', 'from', 'they', 'have', 'been', 'were', 'said', 'each', 'more', 'other', 'such', 'only', 'even', 'also', 'just', 'like', 'many', 'most', 'much', 'very', 'well', 'good', 'best'].includes(word));
  
  return [...new Set(words)].slice(0, 5);
}

function extractMainTopic(text: string): string {
  // Extract main topic from prompt text
  const cleaned = text.replace(/^(what|how|when|where|why|which|are|is|can|do|does)\s+/i, '');
  const words = cleaned.split(' ').slice(0, 3).join(' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function generateHashtags(productsServices: string | null, keywords: string[]): string[] {
  const baseHashtags = ['#Marketing', '#BusinessGrowth', '#DigitalStrategy'];
  const keywordHashtags = keywords.map(k => '#' + k.charAt(0).toUpperCase() + k.slice(1).replace(/\s+/g, ''));
  const productHashtags = productsServices 
    ? productsServices.split(',').map(p => '#' + p.trim().replace(/\s+/g, '')).slice(0, 2)
    : [];
  
  return [...baseHashtags, ...keywordHashtags.slice(0, 3), ...productHashtags].slice(0, 8);
}