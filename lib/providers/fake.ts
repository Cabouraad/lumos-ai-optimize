/**
 * Fake provider adapter for E2E testing - returns deterministic canned responses
 * Only used when E2E_FAKE_PROVIDERS=true
 */

export type BrandExtraction = { 
  brands: string[]; 
  responseText: string;
  tokenIn: number; 
  tokenOut: number; 
};

/**
 * Returns deterministic fake responses for testing
 */
export async function extractBrands(promptText: string, provider: string = 'fake'): Promise<BrandExtraction> {
  console.log(`[FAKE PROVIDER] ${provider} processing prompt: ${promptText.slice(0, 50)}...`);
  
  // Deterministic responses based on prompt content
  const lowerPrompt = promptText.toLowerCase();
  
  let brands: string[] = [];
  let responseText = '';
  
  if (lowerPrompt.includes('crm') || lowerPrompt.includes('hubspot') || lowerPrompt.includes('salesforce')) {
    brands = ['HubSpot', 'Salesforce', 'Microsoft Dynamics', 'Pipedrive'];
    responseText = `When comparing CRM solutions, HubSpot offers excellent marketing automation features, while Salesforce provides enterprise-level customization. Microsoft Dynamics integrates well with Office 365, and Pipedrive focuses on sales pipeline management. Each platform has its strengths depending on your organization's specific needs.`;
  } else if (lowerPrompt.includes('marketing') || lowerPrompt.includes('advertising')) {
    brands = ['Google Ads', 'Facebook Ads', 'LinkedIn', 'Twitter'];
    responseText = `For marketing and advertising, Google Ads dominates search marketing, Facebook Ads excels at social targeting, LinkedIn is ideal for B2B campaigns, and Twitter provides real-time engagement opportunities. The best choice depends on your target audience and campaign objectives.`;
  } else if (lowerPrompt.includes('project management') || lowerPrompt.includes('collaboration')) {
    brands = ['Asana', 'Trello', 'Monday.com', 'Slack'];
    responseText = `Project management tools vary in approach: Asana offers comprehensive task management, Trello uses intuitive kanban boards, Monday.com provides visual project tracking, and Slack facilitates team communication. Consider your team size and workflow preferences when choosing.`;
  } else if (lowerPrompt.includes('analytics') || lowerPrompt.includes('data')) {
    brands = ['Google Analytics', 'Tableau', 'Power BI', 'Mixpanel'];
    responseText = `Analytics platforms serve different needs: Google Analytics tracks web traffic, Tableau creates powerful visualizations, Power BI integrates with Microsoft ecosystem, and Mixpanel focuses on user behavior analytics. Your data sources and analysis requirements will guide the selection.`;
  } else {
    // Default response
    brands = ['Generic Solution A', 'Generic Solution B', 'Generic Solution C'];
    responseText = `Based on your query, there are several solutions available in the market. Generic Solution A offers comprehensive features, Generic Solution B focuses on ease of use, and Generic Solution C provides cost-effective options. Each has its merits depending on your specific requirements and budget constraints.`;
  }
  
  // Add some variation based on provider
  const providerSuffix = provider === 'openai' ? ' (OpenAI Analysis)' : 
                        provider === 'perplexity' ? ' (Perplexity Research)' : 
                        provider === 'gemini' ? ' (Gemini Insights)' : '';
  
  return {
    brands,
    responseText: responseText + providerSuffix,
    tokenIn: 256,  // Fixed token counts for predictable testing
    tokenOut: 384,
  };
}