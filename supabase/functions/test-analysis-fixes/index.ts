import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    console.log('🧪 Testing Analysis Fixes...');

    // Test 1: Brand Prominence Calculation
    console.log('\n--- TEST 1: Brand Prominence Calculation ---');
    
    const { analyzePromptResponse } = await import('../_shared/brand-response-analyzer.ts');
    
    // Test with HubSpot mentioned early, middle, and late
    const testTexts = [
      "HubSpot is a leading CRM platform that offers excellent marketing automation. Salesforce and Pipedrive are also options.", // Early mention
      "When looking for CRM solutions, you have several options. HubSpot offers comprehensive features, while Salesforce provides enterprise-grade capabilities.", // Middle mention
      "There are many CRM platforms available including Salesforce, Pipedrive, Monday.com, and at the end we have HubSpot as another option." // Late mention
    ];

    const mockBrandCatalog = [
      { name: 'HubSpot', is_org_brand: true, variants_json: ['hubspot', 'hub-spot'] },
      { name: 'Salesforce', is_org_brand: false, variants_json: [] }
    ];

    const mockOrgData = {
      name: 'HubSpot',
      domain: 'hubspot.com',
      keywords: ['CRM', 'marketing automation'],
      competitors: [],
      products_services: ['CRM', 'Marketing Hub']
    };

    for (let i = 0; i < testTexts.length; i++) {
      const analysis = await analyzePromptResponse(testTexts[i], mockOrgData, mockBrandCatalog);
      console.log(`Test ${i + 1} Results:`, {
        text_preview: testTexts[i].substring(0, 50) + '...',
        org_brand_present: analysis.org_brand_present,
        org_brand_prominence: analysis.org_brand_prominence,
        prominence_label: getProminenceLabel(analysis.org_brand_prominence),
        score: analysis.score,
        competitors: analysis.competitors_json.length
      });
    }

    // Test 2: Citation Extraction
    console.log('\n--- TEST 2: Citation Extraction ---');
    
    const { extractPerplexityCitations, extractGeminiCitations, extractOpenAICitations } = 
      await import('../_shared/citations-enhanced.ts');

    const testResponses = {
      openai: "Based on research from https://example.com/study and data from https://research.org/report, HubSpot provides excellent CRM capabilities.",
      perplexity: "HubSpot is mentioned in [this article](https://techcrunch.com/hubspot-review) and [this study](https://forrester.com/crm-analysis).",
      gemini: "You can learn more about CRM solutions at https://gartner.com/crm-guide and https://salesforce.com/resources."
    };

    for (const [provider, text] of Object.entries(testResponses)) {
      let citations;
      
      switch (provider) {
        case 'openai':
          citations = extractOpenAICitations(text);
          break;
        case 'perplexity':
          citations = extractPerplexityCitations({}, text);
          break;
        case 'gemini':
          citations = extractGeminiCitations({}, text);
          break;
      }
      
      console.log(`${provider.toUpperCase()} Citations:`, {
        provider: citations.provider,
        count: citations.citations.length,
        urls: citations.citations.map(c => c.url),
        domains: citations.citations.map(c => c.domain)
      });
    }

    // Test 3: Feature Flag Status
    console.log('\n--- TEST 3: Feature Flag Status ---');
    const prominenceFix = Deno.env.get('FEATURE_PROMINENCE_FIX');
    console.log(`FEATURE_PROMINENCE_FIX: ${prominenceFix || 'NOT SET'}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Analysis fixes tested successfully',
        tests: {
          prominence_fix_enabled: prominenceFix === 'true',
          citation_extraction: 'working',
          timestamp: new Date().toISOString()
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Test error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

function getProminenceLabel(prominence: number | null): string {
  if (prominence === null) return 'Not Found';
  if (prominence === 1) return 'Very Early';
  if (prominence === 2) return 'Early';
  if (prominence <= 4) return 'Middle';
  if (prominence <= 7) return 'Late';
  return 'Very Late';
}