import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const openaiKey = Deno.env.get('OPENAI_API_KEY')!;
  
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { orgId } = await req.json();

    if (!orgId) {
      return new Response(JSON.stringify({ error: 'Missing orgId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Running comprehensive recommendation analysis for org: ${orgId}`);

    // Get organization details for context
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('name, business_description, keywords, target_audience')
      .eq('id', orgId)
      .single();

    if (orgError) {
      console.error('Error fetching organization:', orgError);
      throw new Error('Organization not found');
    }

    // Get current data for analysis
    const [visibilityData, competitorData, brandsData] = await Promise.all([
      // Recent visibility performance
      supabase
        .from('v_prompt_visibility_7d')
        .select('*')
        .eq('org_id', orgId),
      
      // Top competitor performance
      supabase
        .from('v_competitor_share_7d')
        .select('*')
        .eq('org_id', orgId)
        .order('mean_score', { ascending: false })
        .limit(20),
        
      // Brand catalog for context
      supabase
        .from('brand_catalog')
        .select('*')
        .eq('org_id', orgId)
    ]);

    const visibility = visibilityData.data || [];
    const competitors = competitorData.data || [];
    const brands = brandsData.data || [];

    // Generate AI-powered strategic recommendations
    const recommendations = await generateStrategicRecommendations(
      openaiKey, 
      org, 
      visibility, 
      competitors, 
      brands
    );

    // Store recommendations directly in database
    let created = 0;
    for (const reco of recommendations) {
      try {
        // Check for duplicates within cooldown period
        const cooldownDate = new Date();
        cooldownDate.setDate(cooldownDate.getDate() - 14);
        
        const { data: existing } = await supabase
          .from('recommendations')
          .select('id')
          .eq('org_id', orgId)
          .eq('type', reco.type)
          .eq('title', reco.title)
          .in('status', ['open', 'snoozed'])
          .gte('created_at', cooldownDate.toISOString())
          .limit(1);

        if (!existing || existing.length === 0) {
          const { error: insertError } = await supabase
            .from('recommendations')
            .insert({
              org_id: orgId,
              type: reco.type,
              title: reco.title,
              rationale: reco.rationale,
              status: 'open',
              metadata: reco.metadata
            });

          if (insertError) {
            console.error('Error inserting recommendation:', insertError);
          } else {
            created++;
            console.log(`✓ Created: ${reco.title}`);
          }
        } else {
          console.log(`⏭ Skipped (cooldown): ${reco.title.substring(0, 50)}...`);
        }
      } catch (error) {
        console.error('Error processing recommendation:', error);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      created,
      total: recommendations.length,
      analysisResults: {
        visibilityPromptsAnalyzed: visibility.length,
        competitorsIdentified: competitors.length,
        brandsTracked: brands.length,
        avgVisibilityScore: visibility.length > 0 
          ? Math.round(visibility.reduce((sum, v) => sum + v.avg_score_7d, 0) / visibility.length)
          : 0
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in advanced-recommendations:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      created: 0
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function generateStrategicRecommendations(
  openaiKey: string,
  org: any,
  visibility: any[],
  competitors: any[],
  brands: any[]
) {
  const recommendations = [];

  // Rule-based recommendations with enhanced logic
  
  // 1. Content Gap Analysis
  const lowPerformingPrompts = visibility.filter(v => v.avg_score_7d < 5.0);
  const highIntentPrompts = lowPerformingPrompts.filter(v => 
    /best|top|compare|vs|alternatives?|reviews?/i.test(v.text)
  );

  for (const prompt of highIntentPrompts.slice(0, 3)) {
    const topCompetitors = competitors
      .filter(c => c.prompt_id === prompt.prompt_id)
      .slice(0, 3)
      .map(c => c.brand_norm);

    recommendations.push({
      type: 'content',
      title: `Create comparison content for "${prompt.text.slice(0, 45)}..."`,
      rationale: `Low visibility (${prompt.avg_score_7d.toFixed(1)}/10) on high-intent query. ${topCompetitors.length > 0 ? `Top competitors: ${topCompetitors.join(', ')}` : 'Strong competitor presence detected'}.`,
      metadata: {
        steps: [
          "Research top 3 competitors mentioned in AI responses",
          "Create comprehensive comparison page with feature matrix",
          "Add FAQ section addressing common buying concerns",
          "Include customer testimonials and case studies",
          "Optimize for related long-tail keywords"
        ],
        estLift: 0.15,
        sourcePromptIds: [prompt.prompt_id],
        priority: 'high',
        category: 'content-gap'
      }
    });
  }

  // 2. Competitor Defense Strategy
  const dominantCompetitors = new Map();
  competitors.forEach(c => {
    if (c.mean_score >= 6.0) {
      if (!dominantCompetitors.has(c.brand_norm)) {
        dominantCompetitors.set(c.brand_norm, []);
      }
      dominantCompetitors.get(c.brand_norm).push(c);
    }
  });

  for (const [competitor, prompts] of dominantCompetitors.entries()) {
    if (prompts.length >= 3) {
      recommendations.push({
        type: 'content',
        title: `Develop "${org.name} vs ${competitor}" competitive content strategy`,
        rationale: `${competitor} dominates ${prompts.length} prompts with 6.0+ average scores. Direct competitive positioning needed.`,
        metadata: {
          steps: [
            `Create comprehensive "${org.name} vs ${competitor}" comparison page`,
            "Identify and highlight key differentiators",
            "Develop use-case specific comparison content",
            "Create social proof showcasing wins against this competitor",
            "Launch targeted competitive campaign"
          ],
          estLift: 0.20,
          sourcePromptIds: prompts.slice(0, 5).map(p => p.prompt_id),
          priority: 'high',
          category: 'competitive-defense',
          targetCompetitor: competitor
        }
      });
    }
  }

  // 3. Brand Visibility Enhancement
  const orgBrands = brands.filter(b => b.is_org_brand);
  const avgOrgScore = orgBrands.length > 0 
    ? orgBrands.reduce((sum, b) => sum + (b.average_score || 0), 0) / orgBrands.length
    : 3;

  if (avgOrgScore < 6.0) {
    recommendations.push({
      type: 'site',
      title: 'Enhance brand authority and mention optimization',
      rationale: `Current brand visibility score is ${avgOrgScore.toFixed(1)}/10. Strategic content optimization needed to improve AI mention frequency.`,
      metadata: {
        steps: [
          "Audit existing content for brand mention density",
          "Create thought leadership content series",
          "Optimize company and product pages for AI discovery",
          "Develop FAQ and help content addressing common queries",
          "Implement schema markup for better AI understanding"
        ],
        estLift: 0.12,
        priority: 'medium',
        category: 'brand-authority'
      }
    });
  }

  // 4. Social Media Amplification
  if (visibility.length > 0) {
    const recentDrops = visibility.filter(v => v.avg_score_7d < 4.0);
    if (recentDrops.length > 0) {
      recommendations.push({
        type: 'social',
        title: 'Launch social media visibility campaign for underperforming queries',
        rationale: `${recentDrops.length} prompts showing low visibility. Social amplification can provide quick wins.`,
        metadata: {
          steps: [
            "Create Twitter/LinkedIn threads addressing top low-performing queries",
            "Share quick-answer content with links to detailed resources",
            "Engage in relevant community discussions",
            "Partner with industry influencers for content amplification"
          ],
          estLift: 0.08,
          priority: 'medium',
          category: 'social-amplification',
          targetPrompts: recentDrops.slice(0, 3).map(p => p.text)
        }
      });
    }
  }

  // 5. Advanced Prompt Strategy
  const underperformingPrompts = visibility.filter(v => v.avg_score_7d < 6.0 && v.runs_7d >= 2);
  if (underperformingPrompts.length > 0) {
    recommendations.push({
      type: 'prompt',
      title: 'Expand prompt monitoring for coverage gaps',
      rationale: `${underperformingPrompts.length} prompts underperforming. Variant testing and expansion needed.`,
      metadata: {
        steps: [
          "Analyze successful prompt patterns from high-performing queries",
          "Create prompt variants with different intent modifiers",
          "Test geographic and demographic variations",
          "Monitor competitor mentions across new prompt variants"
        ],
        estLift: 0.06,
        priority: 'low',
        category: 'prompt-optimization',
        suggestedVariants: underperformingPrompts.slice(0, 5).map(p => `${p.text} [variant]`)
      }
    });
  }

  return recommendations;
}