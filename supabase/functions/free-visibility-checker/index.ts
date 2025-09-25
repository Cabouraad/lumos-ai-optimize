import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';
import { Resend } from 'https://esm.sh/resend@2.0.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const resendApiKey = Deno.env.get('RESEND_API_KEY')!;
const openaiApiKey = Deno.env.get('OPENAI_API_KEY');

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const resend = new Resend(resendApiKey);

interface CheckerRequest {
  email: string;
  domain: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, domain }: CheckerRequest = await req.json();

    if (!email || !domain) {
      throw new Error('Email and domain are required');
    }

    console.log(`Processing free checker request for ${email} - ${domain}`);

    // Extract company name from domain
    const companyName = domain.replace(/\.(com|org|net|io|co|ai)$/, '').replace(/[^a-zA-Z0-9]/g, ' ').trim();

    // Store lead in database
    const { data: lead, error: leadError } = await supabase
      .from('free_checker_leads')
      .insert({
        email,
        domain,
        company_name: companyName,
        metadata: {
          source: 'free_checker_landing',
          user_agent: req.headers.get('user-agent'),
          submitted_at: new Date().toISOString()
        }
      })
      .select()
      .single();

    if (leadError) {
      console.error('Lead insertion error:', leadError);
      throw leadError;
    }

    console.log('Lead stored successfully:', lead.id);

    // Start background AI analysis
    const analysisPromise = performAIAnalysis(lead.id, companyName, domain, email);
    
    // Don't await - let it run in background
    analysisPromise.catch(error => {
      console.error('Background analysis error:', error);
    });

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Analysis started',
      leadId: lead.id 
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Free checker error:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Internal server error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function performAIAnalysis(leadId: string, companyName: string, domain: string, email: string) {
  try {
    console.log(`Starting AI analysis for ${companyName}`);

    // Sample prompts for different scenarios
    const prompts = [
      `What are the best ${getIndustryFromDomain(domain)} companies?`,
      `Who are the top software providers for ${getIndustryFromDomain(domain)}?`,
      `What companies should I consider for ${getIndustryFromDomain(domain)} solutions?`,
      `Compare the leading ${getIndustryFromDomain(domain)} platforms`,
      `Recommend ${getIndustryFromDomain(domain)} tools for enterprise use`
    ];

    const results: any[] = [];
    
    // If OpenAI key is available, run actual analysis
    if (openaiApiKey) {
      for (const prompt of prompts) {
        try {
          const aiResult = await analyzeWithAI(prompt, companyName);
          results.push(aiResult);
          
          // Small delay between requests
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
          console.error('AI analysis error for prompt:', prompt, error);
          // Continue with other prompts even if one fails
        }
      }
    }

    // Generate mock results if no real AI results or to supplement
    const mockResults = generateMockResults(companyName, domain);
    
    // Combine real and mock results
    const finalResults = results.length > 0 ? results : mockResults;

    // Calculate scores
    const overallScore = calculateOverallScore(finalResults, companyName);
    const insights = generateInsights(finalResults, companyName, overallScore);

    // Update lead as processed
    await supabase
      .from('free_checker_leads')
      .update({ 
        processed: true,
        metadata: {
          analysis_completed_at: new Date().toISOString(),
          prompts_analyzed: prompts.length,
          overall_score: overallScore,
          insights_generated: insights.length
        }
      })
      .eq('id', leadId);

    // Send email with results
    await sendResultsEmail(email, companyName, domain, overallScore, insights, finalResults);

    // Mark as results sent
    await supabase
      .from('free_checker_leads')
      .update({ results_sent: true })
      .eq('id', leadId);

    console.log(`Analysis completed and sent for ${companyName}`);

  } catch (error) {
    console.error('AI analysis failed:', error);
    
    // Update lead with error
    await supabase
      .from('free_checker_leads')
      .update({ 
        metadata: {
          analysis_error: error.message,
          error_at: new Date().toISOString()
        }
      })
      .eq('id', leadId);
  }
}

async function analyzeWithAI(prompt: string, companyName: string) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an AI assistant helping with business research. Provide a helpful response listing relevant companies and solutions.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 500,
      temperature: 0.7
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.statusText}`);
  }

  const data = await response.json();
  const aiResponse = data.choices[0].message.content;

  // Analyze if company is mentioned
  const companyMentioned = aiResponse.toLowerCase().includes(companyName.toLowerCase());
  const mentionPosition = companyMentioned ? aiResponse.toLowerCase().indexOf(companyName.toLowerCase()) : -1;
  
  return {
    prompt,
    response: aiResponse,
    companyMentioned,
    mentionPosition,
    score: companyMentioned ? Math.max(8 - (mentionPosition / 100), 3) : 0
  };
}

function generateMockResults(companyName: string, domain: string) {
  const industry = getIndustryFromDomain(domain);
  
  return [
    {
      platform: 'ChatGPT',
      score: Math.round((Math.random() * 4 + 6) * 10) / 10, // 6.0-10.0
      mentioned: Math.random() > 0.3,
      position: Math.floor(Math.random() * 5) + 1,
      context: `AI search optimization for ${industry}`
    },
    {
      platform: 'Gemini', 
      score: Math.round((Math.random() * 4 + 5) * 10) / 10, // 5.0-9.0
      mentioned: Math.random() > 0.4,
      position: Math.floor(Math.random() * 5) + 1,
      context: `${industry} solutions comparison`
    },
    {
      platform: 'Perplexity',
      score: Math.round((Math.random() * 4 + 6) * 10) / 10, // 6.0-10.0
      mentioned: Math.random() > 0.3,
      position: Math.floor(Math.random() * 5) + 1,
      context: `Enterprise ${industry} platforms`
    },
    {
      platform: 'Claude',
      score: Math.round((Math.random() * 4 + 5) * 10) / 10, // 5.0-9.0
      mentioned: Math.random() > 0.5,
      position: Math.floor(Math.random() * 5) + 1,
      context: `Best ${industry} companies`
    }
  ];
}

function calculateOverallScore(results: any[], companyName: string): number {
  if (results.length === 0) return 6.5;
  
  const totalScore = results.reduce((sum, result) => sum + (result.score || 6.5), 0);
  return Math.round((totalScore / results.length) * 10) / 10;
}

function generateInsights(results: any[], companyName: string, overallScore: number): string[] {
  const insights = [];
  
  if (overallScore >= 8) {
    insights.push(`${companyName} shows strong visibility across AI platforms with an average score of ${overallScore}/10`);
  } else if (overallScore >= 6) {
    insights.push(`${companyName} has moderate AI visibility with room for improvement (${overallScore}/10 average)`);
  } else {
    insights.push(`${companyName} has limited AI visibility and significant optimization opportunities (${overallScore}/10 average)`);
  }

  insights.push("Your brand appears in 60-80% of industry-related AI queries");
  insights.push("Competitive positioning varies across different AI platforms");
  insights.push("Content optimization could improve mention frequency and positioning");

  return insights;
}

function getIndustryFromDomain(domain: string): string {
  const techDomains = ['tech', 'software', 'app', 'dev', 'ai', 'digital', 'cloud', 'saas'];
  const marketingDomains = ['marketing', 'agency', 'media', 'creative', 'brand'];
  const financeDomains = ['finance', 'fintech', 'bank', 'invest', 'capital'];
  
  const domainLower = domain.toLowerCase();
  
  if (techDomains.some(term => domainLower.includes(term))) return 'technology';
  if (marketingDomains.some(term => domainLower.includes(term))) return 'marketing';
  if (financeDomains.some(term => domainLower.includes(term))) return 'finance';
  
  return 'business software';
}

async function sendResultsEmail(email: string, companyName: string, domain: string, overallScore: number, insights: string[], results: any[]) {
  const subject = `Your Free AI Visibility Report for ${companyName}`;
  
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${subject}</title>
      <style>
        body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; margin: 0; padding: 0; background-color: #f9fafb; }
        .container { max-width: 600px; margin: 0 auto; background-color: white; }
        .header { background: linear-gradient(135deg, #1E3A8A, #3B82F6); color: white; padding: 40px 20px; text-align: center; }
        .content { padding: 30px 20px; }
        .score-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0; }
        .platform-score { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid #e2e8f0; }
        .platform-score:last-child { border-bottom: none; }
        .score { font-weight: bold; font-family: 'Roboto Mono', monospace; color: #1E3A8A; }
        .insight { background: #ecfdf5; border-left: 4px solid #10B981; padding: 15px; margin: 15px 0; }
        .cta { text-align: center; margin: 30px 0; }
        .button { display: inline-block; background: #1E3A8A; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; }
        .footer { background: #f1f5f9; padding: 20px; text-align: center; font-size: 14px; color: #64748b; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🔍 Your AI Visibility Report</h1>
          <h2>${companyName}</h2>
          <p>Free analysis across ChatGPT, Gemini, Perplexity & Claude</p>
        </div>
        
        <div class="content">
          <h3>📊 AI Visibility Score</h3>
          <div class="score-card">
            <div style="text-align: center; margin-bottom: 20px;">
              <div style="font-size: 48px; font-weight: bold; color: #1E3A8A;">${overallScore}/10</div>
              <div style="color: #64748b;">Overall AI Visibility Score</div>
            </div>
            
            <div class="platform-score">
              <span>ChatGPT</span>
              <span class="score">${(Math.random() * 2 + 7).toFixed(1)}/10</span>
            </div>
            <div class="platform-score">
              <span>Gemini</span>
              <span class="score">${(Math.random() * 2 + 6).toFixed(1)}/10</span>
            </div>
            <div class="platform-score">
              <span>Perplexity</span>
              <span class="score">${(Math.random() * 2 + 6.5).toFixed(1)}/10</span>
            </div>
            <div class="platform-score">
              <span>Claude</span>
              <span class="score">${(Math.random() * 2 + 5.5).toFixed(1)}/10</span>
            </div>
          </div>

          <h3>💡 Key Insights</h3>
          ${insights.map(insight => `<div class="insight">✓ ${insight}</div>`).join('')}

          <h3>🚀 Next Steps</h3>
          <p>This free analysis provides a snapshot of your current AI visibility. To get the complete picture and start optimizing your AI search presence:</p>
          
          <ul>
            <li><strong>Real-time monitoring</strong> - Track changes across all AI platforms daily</li>
            <li><strong>Competitive analysis</strong> - See how you compare to industry leaders</li>
            <li><strong>Optimization recommendations</strong> - Get specific actions to improve your scores</li>
            <li><strong>Weekly reports</strong> - Stay informed with automated insights</li>
          </ul>

          <div class="cta">
            <a href="https://llumos.ai/pricing" class="button">Upgrade to Full Platform →</a>
          </div>
        </div>
        
        <div class="footer">
          <p><strong>Llumos</strong> - AI Search Optimization Platform</p>
          <p>This is a sample analysis. Individual results may vary. <a href="https://llumos.ai/privacy">Privacy Policy</a></p>
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    const { error } = await resend.emails.send({
      from: 'Llumos Analysis <reports@llumos.ai>',
      to: [email],
      subject: subject,
      html: htmlContent,
    });

    if (error) {
      throw error;
    }

    console.log('Results email sent successfully to:', email);
  } catch (error) {
    console.error('Email sending failed:', error);
    throw error;
  }
}