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
  type: 'content' | 'social';
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

    // Generate intelligent recommendations (ensure at least 8)
    const recommendations: ContentRecommendation[] = [];

    // 1. Low-performing prompts need targeted content (4-6 recommendations)
    const lowPerformingPrompts = promptPerformance.filter(p => p.avgScore < 4);
    if (lowPerformingPrompts.length > 0) {
      for (const prompt of lowPerformingPrompts.slice(0, 6)) {
        const recommendation = generateContentRecommendation(
          prompt, 
          org, 
          competitors?.map(c => c.name) || []
        );
        recommendations.push(recommendation);
      }
    }

    // 2. High-competition prompts need differentiation content (2-3 recommendations)
    const highCompetitionPrompts = promptPerformance.filter(p => p.competitorCount > 5);
    if (highCompetitionPrompts.length > 0) {
      for (const prompt of highCompetitionPrompts.slice(0, 3)) {
        const competitiveRecommendation = generateCompetitiveContentRecommendation(prompt, org);
        recommendations.push(competitiveRecommendation);
      }
    }

    // 3. Missing brand presence needs awareness content (2-3 recommendations)
    const noBrandPrompts = promptPerformance.filter(p => !p.brandPresent);
    if (noBrandPrompts.length > 0) {
      // Create multiple brand awareness recommendations with different approaches
      const chunkSize = Math.ceil(noBrandPrompts.length / 3);
      for (let i = 0; i < Math.min(3, Math.ceil(noBrandPrompts.length / chunkSize)); i++) {
        const chunk = noBrandPrompts.slice(i * chunkSize, (i + 1) * chunkSize);
        recommendations.push(generateBrandAwarenessRecommendation(chunk, org, i));
      }
    }

    // 4. Social media strategies for different prompt categories (2-4 recommendations)
    const goodPerformingPrompts = promptPerformance.filter(p => p.avgScore >= 6);
    const mediumPerformingPrompts = promptPerformance.filter(p => p.avgScore >= 4 && p.avgScore < 6);
    
    if (goodPerformingPrompts.length > 0) {
      recommendations.push(generateSocialMediaStrategy(goodPerformingPrompts.slice(0, 3), org, 'amplify'));
    }
    
    if (mediumPerformingPrompts.length > 0) {
      recommendations.push(generateSocialMediaStrategy(mediumPerformingPrompts.slice(0, 3), org, 'boost'));
    }

    // 5. Additional content recommendations if we don't have enough
    while (recommendations.length < 8 && promptPerformance.length > 0) {
      const remainingPrompts = promptPerformance.filter(p => 
        !recommendations.some(r => r.targetPrompts.includes(p.text))
      );
      
      if (remainingPrompts.length === 0) break;
      
      const prompt = remainingPrompts[0];
      const additionalRec = generateContentRecommendation(prompt, org, competitors?.map(c => c.name) || []);
      recommendations.push(additionalRec);
    }

    // 6. Fill remaining slots with general best practices if needed
    if (recommendations.length < 8) {
      const generalRecs = generateGeneralRecommendations(org, 8 - recommendations.length);
      recommendations.push(...generalRecs);
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

function generateContentRecommendation(
  prompt: PromptPerformance, 
  org: any,
  competitors: string[]
): ContentRecommendation {
  const topCompetitors = prompt.topCompetitors.length > 0 ? prompt.topCompetitors : competitors.slice(0, 3);
  
  // Generate clear, actionable content titles based on prompt analysis
  const contentTitles = generateContentTitle(prompt.text, org.name);
  
  const outline = [
    'Introduction highlighting the key problem/question',
    `How ${org.name} uniquely solves this challenge`,
    'Step-by-step implementation guide',
    'Real-world examples and case studies',
    'Comparison with traditional approaches',
    'Call-to-action with specific next steps'
  ];
  
  const steps = [
    'Research the top 5 search results for this query',
    'Identify gaps in existing content coverage',
    'Create a 2000+ word comprehensive guide',
    'Include original data, screenshots, or examples',
    'Optimize for the specific keywords in the prompt',
    'Add internal links to your product/service pages',
    'Create supporting visuals or infographics',
    'Develop downloadable resources and templates'
  ];

  // Clean and truncate prompt text for rationale
  const truncatedPrompt = prompt.text.length > 60 
    ? prompt.text.substring(0, 57) + '...'
    : prompt.text;

  return {
    type: 'content',
    title: contentTitles,
    rationale: `Your brand is ${prompt.brandPresent ? 'mentioned but scoring low' : 'completely missing'} in AI responses to "${truncatedPrompt}". This content will establish your authority and improve visibility. Current average score: ${prompt.avgScore.toFixed(1)}/10. Competing against: ${topCompetitors.slice(0, 3).join(', ')}.`,
    targetPrompts: [prompt.text],
    contentOutline: outline,
    implementationSteps: steps,
    expectedImpact: prompt.avgScore < 2 ? 'high' : prompt.avgScore < 4 ? 'medium' : 'low',
    timeToImplement: '1-2 weeks',
    seoKeywords: extractKeywords(prompt.text),
    socialStrategy: {
      platforms: ['LinkedIn', 'Twitter', 'Industry Forums'],
      postTemplates: [
        `Just published: "${contentTitles}" - Key insights: [3 bullet points]`,
        `${topCompetitors.length > 0 ? `Unlike ${topCompetitors[0]}, ` : ''}here's our approach: [insight]`,
        'Behind the scenes: Creating this guide taught us [key learning]'
      ],
      hashtagStrategy: generateHashtags(org.products_services, extractKeywords(prompt.text))
    }
  };
}

function generateCompetitiveContentRecommendation(prompt: PromptPerformance, org: any): ContentRecommendation {
  const competitiveTitle = generateCompetitiveTitle(prompt.text, org.name);
  
  return {
    type: 'content',
    title: competitiveTitle,
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
      'Create interactive comparison tool on your website',
      'Develop competitive battle cards for sales team',
      'Build landing page focused on competitive advantages'
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

function generateBrandAwarenessRecommendation(prompts: PromptPerformance[], org: any, variant: number = 0): ContentRecommendation {
  const approaches = [
    'thought leadership content',
    'educational guide series',  
    'industry insights report'
  ];
  const approach = approaches[variant] || approaches[0];
  
  // Generate a meaningful title based on the business context
  const title = generateBrandAwarenessTitle(prompts, org.name, approach);
  
  return {
    type: 'content',
    title: title,
    rationale: `Your brand is completely missing from AI responses to ${prompts.length} key prompts. Need foundational content to establish presence. Target prompts: ${prompts.map(p => `"${p.text.length > 40 ? p.text.substring(0, 37) + '...' : p.text}"`).join(', ')}.`,
    targetPrompts: prompts.map(p => p.text),
    contentOutline: [
      `Introduction: ${org.name}'s philosophy and approach`,
      'Industry challenges we have identified',
      'Our unique methodology and framework',
      'Case studies demonstrating our approach',
      'Future vision and trends we are watching',
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
    seoKeywords: [org.name, 'methodology', 'approach', 'framework', ...extractKeywords(prompts.map(p => p.text).join(' '))],
    socialStrategy: {
      platforms: ['LinkedIn', 'Twitter', 'Medium', 'Industry Publications'],
      postTemplates: [
        `Why ${org.name} takes a different approach to [industry topic]`,
        `The methodology we developed after working with 100+ clients`,
        `Thread: ${org.name}'s proven framework for [topic] 🧵`
      ],
      hashtagStrategy: ['#ThoughtLeadership', '#Industry', `#${org.name.replace(/\s+/g, '')}`, '#Methodology']
    }
  };
}

function generateSocialMediaStrategy(prompts: PromptPerformance[], org: any, strategy: 'amplify' | 'boost'): ContentRecommendation {
  const strategyTitles = {
    amplify: 'Amplify your strong-performing content with strategic social media',
    boost: 'Boost medium-performing content through targeted social campaigns'
  };
  
  return {
    type: 'social', 
    title: strategyTitles[strategy],
    rationale: `You're performing ${strategy === 'amplify' ? 'well' : 'moderately'} on these prompts (avg score: ${(prompts.reduce((sum, p) => sum + p.avgScore, 0) / prompts.length).toFixed(1)}/10). ${strategy === 'amplify' ? 'Leverage this success with targeted social strategy' : 'Boost performance through strategic social media campaigns'}.`,
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
      'Create shareable assets (quotes, statistics, infographics)',
      'Set up social media scheduling and automation'
    ],
    expectedImpact: strategy === 'amplify' ? 'medium' : 'high',
    timeToImplement: '1 week',
    seoKeywords: prompts.flatMap(p => extractKeywords(p.text)),
    socialStrategy: {
      platforms: ['LinkedIn', 'Twitter', 'Reddit', 'Industry Communities'],
      postTemplates: [
        `Here's what we learned from analyzing ${prompts.length} industry queries`,
        'Data shows that most people ask about [topic] - here are the real answers',
        'Thread: Breaking down the most common questions in our industry 🧵'
      ],
      hashtagStrategy: ['#SocialStrategy', '#ContentAmplification', `#${org.name.replace(/\s+/g, '')}`]
    }
  };
}

function generateGeneralRecommendations(org: any, count: number): ContentRecommendation[] {
  const generalRecs: ContentRecommendation[] = [];
  
  const recommendations = [
    {
      type: 'content' as const,
      title: `Create comprehensive FAQ content for ${org.name}`,
      rationale: 'Build foundational content that addresses common customer questions and establishes your expertise.',
      outline: ['Common customer questions', 'Detailed answers with examples', 'Related resources and next steps'],
      steps: ['Collect frequently asked questions from sales and support teams', 'Create comprehensive answers', 'Optimize for search']
    },
    {
      type: 'social' as const,
      title: 'Develop consistent social media presence',
      rationale: 'Maintain regular engagement across social platforms to build brand awareness.',
      outline: ['Content calendar planning', 'Platform-specific strategies', 'Community engagement tactics'],
      steps: ['Create content calendar', 'Design platform-specific templates', 'Set up engagement workflows']
    },
    {
      type: 'content' as const,
      title: `Build comprehensive resource library for ${org.name}`,
      rationale: 'Create a centralized knowledge base that positions your brand as an industry authority.',
      outline: ['Industry guides and tutorials', 'Best practices documentation', 'Tool comparisons and reviews'],
      steps: ['Audit existing content', 'Identify content gaps', 'Create comprehensive guides', 'Organize in searchable format']
    },
    {
      type: 'social' as const,
      title: 'Launch community engagement initiative',
      rationale: 'Actively participate in industry conversations to increase brand visibility and establish thought leadership.',
      outline: ['Industry community mapping', 'Engagement strategy', 'Content sharing plan'],
      steps: ['Map relevant communities and forums', 'Create engagement guidelines', 'Develop content sharing strategy']
    }
  ];
  
  for (let i = 0; i < Math.min(count, recommendations.length); i++) {
    const rec = recommendations[i];
    generalRecs.push({
      type: rec.type,
      title: rec.title,
      rationale: rec.rationale,
      targetPrompts: [],
      contentOutline: rec.outline,
      implementationSteps: rec.steps,
      expectedImpact: 'medium',
      timeToImplement: '1-2 weeks',
      seoKeywords: [org.name, 'industry', 'expertise'],
      socialStrategy: {
        platforms: ['LinkedIn', 'Twitter'],
        postTemplates: [`Sharing insights about ${org.name} and our industry expertise`],
        hashtagStrategy: [`#${org.name.replace(/\s+/g, '')}`, '#Industry']
      }
    });
  }
  
  return generalRecs;
}

function extractKeywords(text: string): string[] {
  // Simple keyword extraction - in production, use more sophisticated NLP
  const words = text.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 3 && !['what', 'how', 'when', 'where', 'why', 'which', 'that', 'this', 'with', 'from', 'they', 'have', 'been', 'were', 'said', 'each', 'more', 'other', 'such', 'only', 'even', 'also', 'just', 'like', 'many', 'most', 'much', 'very', 'well', 'good', 'best'].includes(word));
  
  return [...new Set(words)].slice(0, 5);
}

function generateContentTitle(promptText: string, orgName: string): string {
  const lowercasePrompt = promptText.toLowerCase();
  
  // Analyze prompt patterns to generate specific, actionable titles
  if (lowercasePrompt.includes('best') && (lowercasePrompt.includes('tool') || lowercasePrompt.includes('software') || lowercasePrompt.includes('platform'))) {
    return `Ultimate guide to choosing the best tools for your business`;
  } else if (lowercasePrompt.includes('how to') || lowercasePrompt.includes('how do')) {
    const topic = promptText.replace(/^(how to|how do|how does|how can)\s+/i, '').split(' ').slice(0, 4).join(' ');
    return `Complete guide: How to ${topic.toLowerCase()}`;
  } else if (lowercasePrompt.includes('what is') || lowercasePrompt.includes('what are')) {
    const topic = promptText.replace(/^(what is|what are)\s+/i, '').split(' ').slice(0, 4).join(' ');
    return `Everything you need to know about ${topic.toLowerCase()}`;
  } else if (lowercasePrompt.includes('vs') || lowercasePrompt.includes('versus') || lowercasePrompt.includes('comparison')) {
    return `Comprehensive comparison guide for businesses`;
  } else if (lowercasePrompt.includes('review') || lowercasePrompt.includes('reviews')) {
    return `In-depth review and buyer's guide`;
  } else if (lowercasePrompt.includes('pricing') || lowercasePrompt.includes('cost') || lowercasePrompt.includes('price')) {
    return `Complete pricing guide and cost breakdown`;
  } else if (lowercasePrompt.includes('example') || lowercasePrompt.includes('examples')) {
    return `Real-world examples and case studies`;
  } else if (lowercasePrompt.includes('strategy') || lowercasePrompt.includes('strategies')) {
    return `Proven strategies that deliver results`;
  } else if (lowercasePrompt.includes('tip') || lowercasePrompt.includes('tips')) {
    return `Expert tips and best practices guide`;
  } else if (lowercasePrompt.includes('benefit') || lowercasePrompt.includes('advantage')) {
    return `Key benefits and advantages explained`;
  } else {
    // General fallback - create actionable title based on key terms
    const keywords = extractKeywords(promptText);
    const mainKeyword = keywords[0] || 'business solutions';
    return `Comprehensive guide to ${mainKeyword}`;
  }
}

function generateCompetitiveTitle(promptText: string, orgName: string): string {
  const lowercasePrompt = promptText.toLowerCase();
  
  if (lowercasePrompt.includes('best') && (lowercasePrompt.includes('tool') || lowercasePrompt.includes('software'))) {
    return `Why ${orgName} outperforms other tools: Feature comparison`;
  } else if (lowercasePrompt.includes('alternative')) {
    return `${orgName} vs competitors: Which is right for you?`;
  } else if (lowercasePrompt.includes('comparison') || lowercasePrompt.includes('vs')) {
    return `Head-to-head comparison: ${orgName} advantage`;
  } else {
    const keywords = extractKeywords(promptText);
    const mainKeyword = keywords[0] || 'solutions';
    return `Why ${orgName} is the smart choice for ${mainKeyword}`;
  }
}

function generateBrandAwarenessTitle(prompts: PromptPerformance[], orgName: string, approach: string): string {
  // Analyze the prompts to understand the business context
  const allText = prompts.map(p => p.text).join(' ').toLowerCase();
  
  if (allText.includes('marketing') && allText.includes('tool')) {
    return `${orgName}'s comprehensive marketing methodology`;
  } else if (allText.includes('software') || allText.includes('platform')) {
    return `${orgName}'s proven software selection framework`;
  } else if (allText.includes('strategy') || allText.includes('strategies')) {
    return `${orgName}'s strategic approach to business growth`;
  } else if (allText.includes('content') && allText.includes('marketing')) {
    return `${orgName}'s content marketing mastery guide`;
  } else if (allText.includes('best practices')) {
    return `${orgName}'s industry best practices guide`;
  } else if (allText.includes('automation') || allText.includes('workflow')) {
    return `${orgName}'s business automation blueprint`;
  } else {
    // Fallback based on approach type
    const fallbacks = {
      'thought leadership content': `${orgName}'s industry leadership insights`,
      'educational guide series': `${orgName}'s complete business guide series`,
      'industry insights report': `${orgName}'s annual industry insights report`
    };
    return fallbacks[approach] || `${orgName}'s comprehensive business guide`;
  }
}

function generateHashtags(productsServices: string | null, keywords: string[]): string[] {
  const baseHashtags = ['#Marketing', '#BusinessGrowth', '#DigitalStrategy'];
  const keywordHashtags = keywords.map(k => '#' + k.charAt(0).toUpperCase() + k.slice(1).replace(/\s+/g, ''));
  const productHashtags = productsServices 
    ? productsServices.split(',').map(p => '#' + p.trim().replace(/\s+/g, '')).slice(0, 2)
    : [];
  
  return [...baseHashtags, ...keywordHashtags.slice(0, 3), ...productHashtags].slice(0, 8);
}