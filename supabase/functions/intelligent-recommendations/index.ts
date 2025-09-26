import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const ORIGIN = Deno.env.get("APP_ORIGIN") ?? "https://llumos.app";

const corsHeaders = {
  'Access-Control-Allow-Origin': ORIGIN,
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
      .in('prompt_id', prompts.map((p: any) => p.id));

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
    const promptPerformance: PromptPerformance[] = prompts.map((prompt: any) => {
      const promptResponses = responses?.filter((r: any) => r.prompt_id === prompt.id) || [];
      const avgScore = promptResponses.length > 0 
        ? promptResponses.reduce((sum: number, r: any) => sum + (r.score || 0), 0) / promptResponses.length 
        : 0;
      
      const brandPresent = promptResponses.some((r: any) => r.org_brand_present);
      const competitorCount = Math.max(...promptResponses.map((r: any) => r.competitors_count || 0), 0);
      const missingFromProviders = ['openai', 'gemini', 'perplexity'].filter((provider: string) => 
        !promptResponses.some((r: any) => r.provider === provider && r.org_brand_present)
      );

      // Extract top competitors from this prompt's responses
      const allCompetitors = new Set<string>();
      promptResponses.forEach((r: any) => {
        if (r.competitors_json) {
          (r.competitors_json as string[]).forEach((comp: string) => allCompetitors.add(comp));
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
          ? Math.max(...promptResponses.map((r: any) => new Date(r.run_at || 0).getTime())).toString()
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

    // Store recommendations in database and manage the 20-recommendation limit
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

    // Clean up old recommendations to keep only the latest 20
    await cleanupOldRecommendations(supabase, orgId);

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

  } catch (error: unknown) {
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
  
  // Generate intelligent, contextual content titles
  const title = generateIntelligentContentTitle(prompt.text, org);
  const contentType = detectContentType(prompt.text);
  const keywords = extractEnhancedKeywords(prompt.text);
  
  // Generate specific content outline based on detected content type
  const outline = generateContentOutline(contentType, org.name, keywords);
  
  // Create targeted implementation steps
  const steps = generateImplementationSteps(contentType, keywords, org.name);

  // Clean and truncate prompt text for rationale
  const truncatedPrompt = prompt.text.length > 60 
    ? prompt.text.substring(0, 57) + '...'
    : prompt.text;

  return {
    type: 'content',
    title: title,
    rationale: `Your brand is ${prompt.brandPresent ? 'mentioned but scoring low' : 'completely missing'} in AI responses to "${truncatedPrompt}". This ${contentType} content will establish your authority and improve visibility. Current average score: ${prompt.avgScore.toFixed(1)}/10. Competing against: ${topCompetitors.slice(0, 3).join(', ')}.`,
    targetPrompts: [prompt.text],
    contentOutline: outline,
    implementationSteps: steps,
    expectedImpact: prompt.avgScore < 2 ? 'high' : prompt.avgScore < 4 ? 'medium' : 'low',
    timeToImplement: getTimeEstimate(contentType),
    seoKeywords: keywords,
    socialStrategy: {
      platforms: ['LinkedIn', 'Twitter', 'Industry Forums'],
      postTemplates: [
        `Just published: "${title}" - Key insights: [3 bullet points]`,
        `${topCompetitors.length > 0 ? `Unlike ${topCompetitors[0]}, ` : ''}here's our approach: [insight]`,
        'Behind the scenes: Creating this guide taught us [key learning]'
      ],
      hashtagStrategy: generateEnhancedHashtags(org.products_services, keywords)
    }
  };
}

function generateCompetitiveContentRecommendation(prompt: PromptPerformance, org: any): ContentRecommendation {
  const title = generateIntelligentCompetitiveTitle(prompt.text, org);
  const keywords = extractEnhancedKeywords(prompt.text);
  
  return {
    type: 'content',
    title: title,
    rationale: `High competition detected (${prompt.competitorCount} competitors) for "${prompt.text}". You need differentiation content to stand out. Top competitors: ${prompt.topCompetitors.join(', ')}.`,
    targetPrompts: [prompt.text],
    contentOutline: [
      'Market landscape overview and analysis',
      `Why ${org.name} was built differently from the start`,
      'Head-to-head feature comparison with proof points',
      'Customer success stories with measurable outcomes',
      'Total cost of ownership analysis',
      'Migration guide and support comparison'
    ],
    implementationSteps: [
      'Analyze top 3 competitors\' positioning, pricing, and messaging',
      'Survey recent customers about decision factors and switching reasons',
      'Create detailed feature comparison matrix with screenshots',
      'Collect quantifiable ROI data and time-to-value metrics',
      'Develop "switching guide" with migration timelines and costs',
      'Create interactive comparison tool on your website',
      'Develop competitive battle cards for sales and customer success teams',
      'Build dedicated landing page highlighting competitive advantages'
    ],
    expectedImpact: 'high',
    timeToImplement: '2-3 weeks',
    seoKeywords: [org.name, 'vs', 'alternative', 'comparison', 'better than', ...keywords],
    socialStrategy: {
      platforms: ['LinkedIn', 'Twitter', 'Reddit', 'Industry Slack/Discord'],
      postTemplates: [
        `Honest comparison: ${org.name} vs [Competitor] - Here's what surprised us`,
        'Data from 200+ customer interviews: Why they switched from [competitor]',
        `[Competitor] works well for X, but if you need Y, here's why ${org.name} is different`
      ],
      hashtagStrategy: ['#MarketAnalysis', '#ToolComparison', `#${org.name.replace(/\s+/g, '')}Alternative`]
    }
  };
}

function generateBrandAwarenessRecommendation(prompts: PromptPerformance[], org: any, variant: number = 0): ContentRecommendation {
  // Cluster prompts by dominant topic
  const clusteredPrompts = clusterPromptsByTopic(prompts);
  const dominantTopic = clusteredPrompts.dominantTopic;
  const topicKeywords = clusteredPrompts.keywords;
  
  // Generate contextually relevant title based on the dominant topic
  const title = generateIntelligentBrandAwarenessTitle(dominantTopic, org, variant);
  
  return {
    type: 'content',
    title: title,
    rationale: `Your brand is completely missing from AI responses to ${prompts.length} key ${dominantTopic} prompts. Need foundational content to establish presence. Target prompts: ${prompts.map(p => `"${p.text.length > 40 ? p.text.substring(0, 37) + '...' : p.text}"`).join(', ')}.`,
    targetPrompts: prompts.map(p => p.text),
    contentOutline: [
      `Introduction: ${org.name}'s unique approach to ${dominantTopic}`,
      `Common ${dominantTopic} challenges and misconceptions`,
      `Our proven ${dominantTopic} methodology and framework`,
      'Real client success stories and measurable outcomes',
      `Industry trends and the future of ${dominantTopic}`,
      `How to get started with ${org.name}'s ${dominantTopic} solutions`
    ],
    implementationSteps: [
      `Document your unique ${dominantTopic} processes and methodologies`,
      `Create original framework or model for ${dominantTopic}`,
      `Develop proprietary research or data about ${dominantTopic}`,
      `Write comprehensive ${dominantTopic} thought leadership articles`,
      'Guest post on industry publications and relevant platforms',
      'Speak at industry events and record video sessions',
      `Create downloadable ${dominantTopic} resources (guides, templates, checklists)`,
      'Build high-quality backlinks from authoritative industry sources'
    ],
    expectedImpact: 'high',
    timeToImplement: '3-4 weeks',
    seoKeywords: [org.name, dominantTopic, 'methodology', 'framework', 'guide', ...topicKeywords],
    socialStrategy: {
      platforms: ['LinkedIn', 'Twitter', 'Medium', 'Industry Publications'],
      postTemplates: [
        `Why ${org.name} takes a different approach to ${dominantTopic}`,
        `The ${dominantTopic} methodology we developed after 3+ years of client work`,
        `Thread: ${org.name}'s proven ${dominantTopic} framework 🧵`
      ],
      hashtagStrategy: [`#${dominantTopic.replace(/\s+/g, '')}`, '#ThoughtLeadership', `#${org.name.replace(/\s+/g, '')}`]
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
    seoKeywords: prompts.flatMap((p: any) => extractKeywords(p.text)),
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

// Comprehensive stopword list for better keyword extraction
const STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has', 'he', 
  'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the', 'to', 'was', 'will', 'with',
  'can', 'could', 'should', 'would', 'may', 'might', 'must', 'shall', 'do', 'does',
  'did', 'have', 'had', 'having', 'i', 'you', 'we', 'they', 'them', 'their', 'this',
  'these', 'those', 'what', 'when', 'where', 'why', 'how', 'which', 'who', 'whom'
]);

// Extract meaningful subject from "how to" style prompts
function extractHowToSubject(text: string): string {
  const cleanText = text.toLowerCase().trim();
  
  // Pattern 1: "How to [verb] [object]" - extract the main action and object
  const howToMatch = cleanText.match(/how\s+to\s+([^?]+)/);
  if (howToMatch) {
    const action = howToMatch[1].trim();
    // Remove common filler words and return meaningful part
    return action.replace(/\b(the|a|an|my|your|our|their|for|with|in|on|at)\b/g, '').trim();
  }
  
  // Pattern 2: "How can/should/do [subject] [verb] [object]"
  const howCanMatch = cleanText.match(/how\s+(can|should|do|does)\s+([^?]+)/);
  if (howCanMatch) {
    const rest = howCanMatch[2].trim();
    // Extract meaningful nouns and verbs, skip pronouns
    const words = rest.split(/\s+/).filter(word => 
      word.length > 2 && !STOPWORDS.has(word) && !/^(i|you|we|they|it)$/.test(word)
    );
    return words.slice(0, 3).join(' ');
  }
  
  // Fallback: extract first meaningful noun phrases
  const words = cleanText.split(/\s+/).filter(word => 
    word.length > 3 && !STOPWORDS.has(word) && !/^\d+$/.test(word)
  );
  return words.slice(0, 2).join(' ');
}

function extractKeywords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 3 && !STOPWORDS.has(word))
    .slice(0, 5);
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

// Enhanced title generation with better pattern detection and subject extraction
function generateIntelligentContentTitle(promptText: string, org: any): string {
  const cleanPrompt = normalizePromptText(promptText);
  const contentType = detectContentType(cleanPrompt);
  const keywords = extractEnhancedKeywords(cleanPrompt);
  
  console.log(`Generating title for: "${promptText}" | Type: ${contentType} | Keywords: ${keywords.join(', ')}`);
  
  // Pattern-based title generation with improved subject extraction
  if (contentType === 'how-to') {
    const subject = extractHowToSubject(promptText);
    if (subject && subject.length > 3) {
      return sanitizeTitle(`How to ${subject} - ${org.name} complete guide`);
    }
    // Fallback to keywords if subject extraction fails
    const mainKeyword = keywords.slice(0, 2).join(' ') || 'achieve your goals';
    return sanitizeTitle(`How to ${mainKeyword} - Complete guide`);
  }
  
  if (contentType === 'best-of') {
    const subject = extractSubjectFromBestOf(promptText) || keywords.slice(0, 2).join(' ') || 'tools';
    const year = new Date().getFullYear();
    return sanitizeTitle(`${year}'s best ${subject} - Expert recommendations`);
  }
  
  if (contentType === 'comparison') {
    const subjects = extractComparisonSubjects(cleanPrompt);
    if (subjects.length >= 2) {
      return sanitizeTitle(`${titleCase(subjects[0])} vs ${titleCase(subjects[1])} - Which should you choose?`);
    }
    const subject = keywords.slice(0, 2).join(' ') || 'solutions';
    return sanitizeTitle(`${titleCase(subject)} comparison guide - Make the right choice`);
  }
  
  if (contentType === 'explanation') {
    const subject = extractSubjectFromWhat(promptText) || keywords.slice(0, 2).join(' ') || 'business concepts';
    return sanitizeTitle(`Complete guide to ${subject} - Everything you need to know`);
  }
  
  if (contentType === 'troubleshooting') {
    const problem = extractProblem(cleanPrompt) || keywords.slice(0, 2).join(' ') || 'common issues';
    return sanitizeTitle(`Fixing ${problem} - Step-by-step troubleshooting guide`);
  }
  
  // Default case with business context
  const primaryKeyword = keywords[0] || 'business solutions';
  const businessFocus = org.products_services ? extractBusinessFocus(org.products_services) : 'business';
  return sanitizeTitle(`Ultimate ${primaryKeyword} guide for ${businessFocus} success`);
}

// Helper function to extract subject from "what is/are" questions
function extractSubjectFromWhat(text: string): string {
  const whatMatch = text.toLowerCase().match(/what\s+(is|are)\s+([^?]+)/);
  if (whatMatch) {
    const subject = whatMatch[2].trim();
    return subject.replace(/\b(the|a|an|my|your|our|their)\b/g, '').trim();
  }
  return '';
}

// Helper function to extract subject from "best of" questions
function extractSubjectFromBestOf(text: string): string {
  const bestMatch = text.toLowerCase().match(/(?:best|top)\s+(?:\d+\s+)?([^?]+)/);
  if (bestMatch) {
    const subject = bestMatch[1].trim();
    return subject.replace(/\b(for|to|in|on|at|the|a|an)\b/g, '').trim();
  }
  return '';
}

// Enhanced noun phrase extraction with domain focus
function extractNounPhrases(text: string): string[] {
  const cleanText = text.toLowerCase().replace(/[^\w\s]/g, ' ').trim();
  const words = cleanText.split(/\s+/);
  
  const phrases: string[] = [];
  const businessTerms = ['business', 'company', 'startup', 'marketing', 'sales', 'customer', 'service', 'platform', 'software', 'tool', 'strategy', 'management', 'team', 'product', 'solution'];
  
  // Extract 2-3 word phrases, prioritizing business terms
  for (let i = 0; i < words.length - 1; i++) {
    if (STOPWORDS.has(words[i])) continue;
    
    // Check for business context
    const isBusinessContext = businessTerms.some(term => 
      words[i].includes(term) || (i < words.length - 1 && words[i + 1].includes(term))
    );
    
    if (isBusinessContext || (!STOPWORDS.has(words[i]) && words[i].length > 3)) {
      if (i < words.length - 1 && !STOPWORDS.has(words[i + 1])) {
        phrases.push(`${words[i]} ${words[i + 1]}`);
      }
      if (i < words.length - 2 && !STOPWORDS.has(words[i + 2])) {
        phrases.push(`${words[i]} ${words[i + 1]} ${words[i + 2]}`);
      }
    }
  }
  
  return [...new Set(phrases)].slice(0, 3);
}

// Function to sanitize and clean up titles
function sanitizeTitle(title: string): string {
  return title
    .replace(/\s+/g, ' ')  // Remove extra spaces
    .replace(/\b(how to|for)\s+\b/g, (match) => match.toLowerCase())  // Keep common words lowercase
    .replace(/\b\w/g, (match) => match.toUpperCase())  // Capitalize first letter of words
    .trim()
    .substring(0, 100);  // Limit length
}

// Improved title case function
function titleCase(str: string): string {
  const smallWords = new Set(['a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'if', 'in', 'of', 'on', 'or', 'the', 'to', 'up', 'via']);
  
  return str
    .toLowerCase()
    .split(' ')
    .map((word, index) => {
      // Always capitalize first and last word, and words not in smallWords set
      if (index === 0 || !smallWords.has(word)) {
        return word.charAt(0).toUpperCase() + word.slice(1);
      }
      return word;
    })
    .join(' ');
}

function generateIntelligentCompetitiveTitle(promptText: string, org: any): string {
  const cleanPrompt = normalizePromptText(promptText);
  const nounPhrases = extractNounPhrases(cleanPrompt);
  const keywords = extractEnhancedKeywords(cleanPrompt);
  
  const subject = nounPhrases[0] || keywords.slice(0, 2).join(' ');
  const orgNameShort = org.name.split(' ')[0]; // Use first word of org name
  
  const competitiveTitles = [
    `${orgNameShort} vs competitors - Honest ${subject} comparison`,
    `Why customers choose ${orgNameShort} for ${subject}`,
    `${subject} alternatives - Complete ${orgNameShort} comparison`,
    `${orgNameShort} competitive analysis - ${subject} market review`
  ];
  
  return formatTitle(competitiveTitles[Math.floor(Math.random() * competitiveTitles.length)]);
}

function generateIntelligentBrandAwarenessTitle(dominantTopic: string, org: any, variant: number): string {
  const approaches = [
    `The ${org.name} approach to ${dominantTopic} - Our proven methodology`,
    `${dominantTopic} insights from ${org.name} - Industry expertise guide`,
    `Mastering ${dominantTopic} - ${org.name}'s comprehensive framework`
  ];
  
  return formatTitle(approaches[variant] || approaches[0]);
}

// Enhanced helper functions for intelligent content generation
function normalizePromptText(text: string): string {
  return text.toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function detectContentType(cleanPrompt: string): string {
  if (/how\s+(to|do|can|should)/.test(cleanPrompt)) return 'how-to';
  if (/best|top\s+\d*|greatest|leading/.test(cleanPrompt)) return 'best-of';
  if (/vs|versus|compared?\s+to|difference\s+between/.test(cleanPrompt)) return 'comparison';
  if (/what\s+(is|are)|define|explain|meaning/.test(cleanPrompt)) return 'explanation';
  if (/fix|solve|troubleshoot|error|problem|issue/.test(cleanPrompt)) return 'troubleshooting';
  if (/why|benefits|advantages|reasons/.test(cleanPrompt)) return 'benefits';
  if (/when|timing|schedule/.test(cleanPrompt)) return 'timing';
  return 'guide';
}

function extractNounPhrases(text: string): string[] {
  const cleanText = text.toLowerCase().replace(/[^\w\s]/g, ' ').trim();
  const words = cleanText.split(/\s+/);
  
  const phrases: string[] = [];
  const businessTerms = ['business', 'company', 'startup', 'marketing', 'sales', 'customer', 'service', 'platform', 'software', 'tool', 'strategy', 'management', 'team', 'product', 'solution'];
  
  // Extract 2-3 word phrases, prioritizing business terms
  for (let i = 0; i < words.length - 1; i++) {
    if (STOPWORDS.has(words[i])) continue;
    
    // Check for business context
    const isBusinessContext = businessTerms.some(term => 
      words[i].includes(term) || (i < words.length - 1 && words[i + 1].includes(term))
    );
    
    if (isBusinessContext || (!STOPWORDS.has(words[i]) && words[i].length > 3)) {
      if (i < words.length - 1 && !STOPWORDS.has(words[i + 1])) {
        phrases.push(`${words[i]} ${words[i + 1]}`);
      }
      if (i < words.length - 2 && !STOPWORDS.has(words[i + 2])) {
        phrases.push(`${words[i]} ${words[i + 1]} ${words[i + 2]}`);
      }
    }
  }
  
  return [...new Set(phrases)].slice(0, 3);
}

function extractActionWord(text: string): string | null {
  const actionWords = ['create', 'build', 'make', 'setup', 'install', 'configure', 'optimize', 'improve', 'choose', 'select', 'implement', 'develop', 'design', 'plan', 'manage', 'use', 'start'];
  return actionWords.find(word => text.includes(word)) || null;
}

function extractComparisonSubjects(text: string): string[] {
  const vsMatch = text.match(/(.+?)\s+(?:vs|versus|compared?\s+to)\s+(.+)/);
  if (vsMatch) {
    return [vsMatch[1].trim(), vsMatch[2].trim()].map(s => s.replace(/[^\w\s]/g, '').trim());
  }
  return [];
}

function extractProblem(text: string): string | null {
  const problemWords = ['error', 'issue', 'problem', 'bug', 'fail', 'broken', 'not working'];
  const found = problemWords.find(word => text.includes(word));
  if (found) {
    const words = text.split(' ');
    const index = words.findIndex((w: string) => w.includes(found));
    return words.slice(Math.max(0, index - 1), index + 2).join(' ');
  }
  return null;
}

function extractBusinessFocus(productsServices: string): string {
  if (!productsServices) return 'business';
  const focus = productsServices.toLowerCase();
  if (focus.includes('marketing')) return 'marketing';
  if (focus.includes('sales')) return 'sales';
  if (focus.includes('software') || focus.includes('tech')) return 'technology';
  if (focus.includes('consult')) return 'consulting';
  return 'business';
}

function formatTitle(title: string): string {
  // Ensure proper capitalization and length limits
  const formatted = title.replace(/\b\w/g, (l: string) => l.toUpperCase())
    .replace(/\s+/g, ' ')
    .trim();
  
  // Truncate if too long but keep it meaningful
  if (formatted.length > 80) {
    const truncated = formatted.substring(0, 77) + '...';
    return truncated;
  }
  
  return formatted;
}

function extractEnhancedKeywords(text: string): string[] {
  // Expanded stop words list for better keyword extraction
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
    'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
    'will', 'would', 'should', 'could', 'can', 'may', 'might', 'must', 'what', 'how', 'when',
    'where', 'why', 'which', 'who', 'whom', 'whose', 'this', 'that', 'these', 'those', 'they',
    'them', 'their', 'there', 'then', 'than', 'from', 'into', 'about', 'after', 'before',
    'during', 'while', 'since', 'until', 'between', 'among', 'through', 'over', 'under'
  ]);
  
  const words = text.toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word))
    .filter(word => !/^\d+$/.test(word)); // Remove pure numbers
  
  // Get unique words and prioritize longer, more meaningful terms
  const uniqueWords = [...new Set(words)]
    .sort((a, b) => b.length - a.length)
    .slice(0, 10);
  
  return uniqueWords;
}

function generateEnhancedHashtags(productsServices: string | null, keywords: string[]): string[] {
  const baseHashtags = ['#MarketingTips', '#BusinessGrowth', '#DigitalStrategy'];
  
  if (productsServices) {
    const productKeywords = productsServices.toLowerCase()
      .split(/[\s,]+/)
      .filter(word => word.length > 3)
      .map(word => `#${word.charAt(0).toUpperCase() + word.slice(1).replace(/[^a-zA-Z0-9]/g, '')}`)
      .slice(0, 2);
    baseHashtags.push(...productKeywords);
  }
  
  const keywordHashtags = keywords.slice(0, 3).map((keyword: string) => 
    `#${keyword.charAt(0).toUpperCase() + keyword.slice(1).replace(/[^a-zA-Z0-9]/g, '')}`
  );
  
  return [...new Set([...baseHashtags, ...keywordHashtags])].slice(0, 8);
}

function clusterPromptsByTopic(prompts: PromptPerformance[]): { dominantTopic: string; keywords: string[] } {
  // Analyze all prompts to find the dominant topic/theme
  const allText = prompts.map(p => p.text).join(' ');
  const keywords = extractEnhancedKeywords(allText);
  
  // Simple topic detection based on keywords
  const topics = [
    { name: 'marketing automation', keywords: ['marketing', 'automation', 'campaign', 'email', 'lead'] },
    { name: 'project management', keywords: ['project', 'management', 'task', 'team', 'workflow'] },
    { name: 'customer support', keywords: ['customer', 'support', 'service', 'help', 'ticket'] },
    { name: 'sales optimization', keywords: ['sales', 'revenue', 'conversion', 'pipeline', 'crm'] },
    { name: 'content marketing', keywords: ['content', 'blog', 'seo', 'social', 'engagement'] },
    { name: 'data analysis', keywords: ['data', 'analytics', 'metrics', 'reporting', 'insights'] },
    { name: 'software development', keywords: ['software', 'development', 'coding', 'api', 'integration'] }
  ];
  
  let bestMatch = { name: 'business solutions', score: 0 };
  
  for (const topic of topics) {
    const score = topic.keywords.reduce((sum, keyword) => {
      return sum + (keywords.includes(keyword) ? 1 : 0);
    }, 0);
    
    if (score > bestMatch.score) {
      bestMatch = { name: topic.name, score };
    }
  }
  
  return {
    dominantTopic: bestMatch.name,
    keywords: keywords.slice(0, 5)
  };
}

function generateContentOutline(contentType: string, orgName: string, keywords: string[]): string[] {
  const mainKeyword = keywords[0] || 'solution';
  
  switch (contentType) {
    case 'how-to':
      return [
        `Introduction: Why ${mainKeyword} matters for your business`,
        'Prerequisites and what you\'ll need to get started',
        'Step-by-step implementation guide with screenshots',
        `Common mistakes to avoid when implementing ${mainKeyword}`,
        `How ${orgName} customers achieve better results`,
        'Troubleshooting tips and advanced techniques',
        'Measuring success and key performance indicators',
        'Next steps and additional resources'
      ];
      
    case 'best-of':
      return [
        `Introduction: The ${mainKeyword} landscape in 2024`,
        'Our evaluation criteria and methodology',
        `Top ${mainKeyword} options with detailed analysis`,
        'Feature comparison matrix and pricing breakdown',
        `Why ${orgName} customers prefer our approach`,
        'Implementation considerations and migration tips',
        'ROI analysis and cost-benefit breakdown',
        'Final recommendations and decision framework'
      ];
      
    case 'comparison':
      return [
        `Market overview: Understanding ${mainKeyword} options`,
        'Head-to-head feature comparison',
        'Pricing and total cost of ownership analysis',
        'User experience and ease of implementation',
        'Customer support and training resources',
        'Integration capabilities and ecosystem',
        'Security, compliance, and scalability factors',
        'Final verdict and recommendations by use case'
      ];
      
    case 'troubleshooting':
      return [
        `Common ${mainKeyword} problems and their root causes`,
        'Quick diagnostic checklist and tools',
        'Step-by-step troubleshooting methodology',
        'Advanced debugging techniques',
        'When to escalate and seek professional help',
        `How ${orgName} prevents these issues`,
        'Long-term solutions and best practices',
        'Resources for ongoing maintenance'
      ];
      
    default: // guide
      return [
        `Introduction: Understanding ${mainKeyword} fundamentals`,
        'Current market trends and opportunities',
        `${orgName}'s proven approach and methodology`,
        'Implementation roadmap and timeline',
        'Best practices and success strategies',
        'Common challenges and how to overcome them',
        'Measuring results and optimizing performance',
        'Future trends and preparing for what\'s next'
      ];
  }
}

function generateImplementationSteps(contentType: string, keywords: string[], orgName: string): string[] {
  const mainKeyword = keywords[0] || 'solution';
  
  switch (contentType) {
    case 'how-to':
      return [
        `Research the top 10 search results for "${mainKeyword}" to identify content gaps`,
        'Create detailed step-by-step instructions with numbered lists',
        'Include screenshots, diagrams, or video walkthroughs for complex steps',
        'Add code snippets, templates, or downloadable resources',
        `Include a section on how ${orgName} simplifies this process`,
        'Create companion resources (checklists, templates, tools)',
        'Optimize for featured snippets and voice search',
        'Build internal links to relevant product/service pages'
      ];
      
    case 'best-of':
      return [
        `Research and test the top 8-10 ${mainKeyword} options in the market`,
        'Create standardized evaluation criteria and scoring system',
        'Build detailed comparison matrices with feature breakdowns',
        'Include real pricing data and total cost calculations',
        `Position ${orgName} solution within the competitive landscape`,
        'Add customer testimonials and case studies for social proof',
        'Create interactive comparison tools or calculators',
        'Develop supporting content for each recommended option'
      ];
      
    case 'comparison':
      return [
        `Identify the top 3-5 alternatives to compare for ${mainKeyword}`,
        'Create side-by-side feature comparison tables',
        'Test each solution hands-on and document the experience',
        'Interview customers who have switched between these solutions',
        'Calculate total cost of ownership for different scenarios',
        'Build interactive comparison calculator or decision tree',
        'Create migration guides for switching between solutions',
        'Develop battle cards for sales team reference'
      ];
      
    default:
      return [
        `Conduct comprehensive research on ${mainKeyword} best practices`,
        'Interview 3-5 customers about their experiences and challenges',
        'Document your unique methodology and framework',
        'Create original data through surveys or case studies',
        'Include actionable templates, checklists, and resources',
        'Optimize content for search with long-tail keyword variations',
        'Build topic clusters with supporting pillar content',
        'Create multiple content formats (blog, video, podcast, infographic)'
      ];
  }
}

function getTimeEstimate(contentType: string): string {
  switch (contentType) {
    case 'how-to':
      return '1-2 weeks';
    case 'best-of':
      return '2-3 weeks';
    case 'comparison':
      return '2-3 weeks';
    case 'troubleshooting':
      return '1 week';
    default:
      return '1-2 weeks';
  }
}

// Function to clean up old recommendations, keeping only the latest 20
async function cleanupOldRecommendations(supabase: any, orgId: string) {
  try {
    // Get all recommendations for this org, ordered by creation date (newest first)
    const { data: allRecommendations } = await supabase
      .from('recommendations')
      .select('id, created_at')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });

    if (allRecommendations && allRecommendations.length > 20) {
      // Get IDs of recommendations beyond the first 20 (oldest ones to delete)
      const idsToDelete = allRecommendations.slice(20).map((r: any) => r.id);
      
      // Delete the old recommendations
      const { error } = await supabase
        .from('recommendations')
        .delete()
        .in('id', idsToDelete);

      if (error) {
        console.error('Error cleaning up old recommendations:', error);
      } else {
        console.log(`Cleaned up ${idsToDelete.length} old recommendations, keeping latest 20`);
      }
    }
  } catch (error: unknown) {
    console.error('Error in cleanup process:', error);
  }
}