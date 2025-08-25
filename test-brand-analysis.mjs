#!/usr/bin/env node

/**
 * Test the new simple brand analyzer against existing response data
 */

// Simulate the new brand analysis logic
function findBrandMentions(text, brandName) {
  if (!brandName || brandName.length < 2) return [];
  
  const positions = [];
  const escapedName = brandName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  
  // Use word boundary regex for exact matches
  const regex = new RegExp(`\\b${escapedName}\\b`, 'gi');
  let match;
  
  while ((match = regex.exec(text)) !== null) {
    positions.push(match.index);
    // Prevent infinite loop on zero-length matches
    if (match.index === regex.lastIndex) {
      regex.lastIndex++;
    }
  }
  
  return positions;
}

function analyzeResponse(responseText, brandCatalog) {
  const text = responseText || '';
  
  // Get org brands and competitors from catalog
  const orgBrands = brandCatalog.filter(b => b.is_org_brand === true);
  const competitorBrands = brandCatalog.filter(b => b.is_org_brand === false);

  // Find all brand mentions with positions
  const allMentions = [];

  // Check for org brand mentions
  let orgBrandFound = false;
  const foundOrgBrands = [];

  for (const orgBrand of orgBrands) {
    const brandTerms = [orgBrand.name, ...(orgBrand.variants_json || [])];
    
    for (const term of brandTerms) {
      const positions = findBrandMentions(text, term);
      if (positions.length > 0) {
        orgBrandFound = true;
        if (!foundOrgBrands.includes(orgBrand.name)) {
          foundOrgBrands.push(orgBrand.name);
        }
        positions.forEach(pos => {
          allMentions.push({ name: orgBrand.name, position: pos, isOrgBrand: true });
        });
      }
    }
  }

  // Check for competitor mentions
  const foundCompetitors = [];
  
  for (const competitor of competitorBrands) {
    const brandTerms = [competitor.name, ...(competitor.variants_json || [])];
    
    for (const term of brandTerms) {
      const positions = findBrandMentions(text, term);
      if (positions.length > 0) {
        if (!foundCompetitors.includes(competitor.name)) {
          foundCompetitors.push(competitor.name);
        }
        positions.forEach(pos => {
          allMentions.push({ name: competitor.name, position: pos, isOrgBrand: false });
        });
      }
    }
  }

  // Calculate org brand prominence (position among all brand mentions)
  let orgBrandProminence = null;
  
  if (orgBrandFound && allMentions.length > 0) {
    // Sort all mentions by position
    allMentions.sort((a, b) => a.position - b.position);
    
    // Find first org brand mention
    const firstOrgIndex = allMentions.findIndex(m => m.isOrgBrand);
    if (firstOrgIndex >= 0) {
      orgBrandProminence = firstOrgIndex + 1; // 1-based position
    }
  }

  // Calculate score
  let score = 0;
  
  if (orgBrandFound) {
    // Base score for org brand presence
    score = 6;
    
    // Bonus for good prominence (top 3 positions)
    if (orgBrandProminence && orgBrandProminence <= 3) {
      score += 2;
    } else if (orgBrandProminence && orgBrandProminence <= 5) {
      score += 1;
    }
    
    // Penalty for too many competitors
    const competitorPenalty = Math.min(2, foundCompetitors.length * 0.2);
    score -= competitorPenalty;
  } else {
    // No org brand found
    if (foundCompetitors.length === 0) {
      score = 2; // Neutral response
    } else {
      score = 0; // Competitors mentioned but not us
    }
  }

  // Ensure score is within bounds
  score = Math.max(0, Math.min(10, score));

  return {
    score: Number(score.toFixed(1)),
    orgBrandPresent: orgBrandFound,
    orgBrandProminence,
    brands: foundOrgBrands.slice(0, 3), // Limit to top 3
    competitors: foundCompetitors.slice(0, 10) // Limit to top 10
  };
}

// Test data from the actual database response
const testResponse = `Yes, there are several marketing platforms that offer both email automation and content management capabilities. Here are some popular options:

1. **HubSpot**: HubSpot is an all-in-one marketing platform that includes email marketing automation, content management (CMS), customer relationship management (CRM), and more. It allows users to create, manage, and optimize content while automating email campaigns.

2. **Mailchimp**: While primarily known for its email marketing services, Mailchimp also offers a basic content management system. Users can create landing pages and manage website content alongside their email campaigns.

3. **WordPress with Plugins**: WordPress itself is a powerful content management system, and with plugins like Mailchimp for WordPress or other email marketing plugins, you can integrate email automation functionalities.

4. **Marketo**: Marketo, part of Adobe Experience Cloud, provides robust email marketing automation and has capabilities for managing content, particularly for lead nurturing and engagement.

5. **ActiveCampaign**: ActiveCampaign combines email marketing automation with CRM features and allows users to manage content for their campaigns, making it easier to create targeted messaging.

6. **Sendinblue**: Sendinblue offers email marketing automation along with a simple content management system for landing pages and forms, making it a versatile choice for marketers.

7. **GetResponse**: GetResponse provides email marketing automation, landing page creation, and webinar hosting, along with tools for managing content.

8. **Contentful**: While primarily a content management system, Contentful can be integrated with email marketing tools to create a comprehensive marketing solution.

When choosing a platform, consider your specific needs, such as the scale of your email marketing efforts, the complexity of your content management requirements, and your budget.`;

// Sample brand catalog (based on what we can infer)
const brandCatalog = [
  { name: "HubSpot", variants_json: ["hubspot"], is_org_brand: true },
  { name: "Mailchimp", variants_json: [], is_org_brand: false },
  { name: "ActiveCampaign", variants_json: [], is_org_brand: false },
  { name: "Marketo", variants_json: [], is_org_brand: false },
  { name: "GetResponse", variants_json: [], is_org_brand: false },
  { name: "Sendinblue", variants_json: [], is_org_brand: false },
  { name: "Contentful", variants_json: [], is_org_brand: false },
  { name: "WordPress", variants_json: [], is_org_brand: false }
];

console.log('🧪 Testing new brand analysis system...\n');

console.log('📝 Response text preview:');
console.log(testResponse.substring(0, 200) + '...\n');

console.log('🏷️  Brand catalog:');
brandCatalog.forEach(brand => {
  console.log(`  - ${brand.name} (${brand.is_org_brand ? 'ORG' : 'COMPETITOR'})`);
});

console.log('\n🔍 Running analysis...\n');

const result = analyzeResponse(testResponse, brandCatalog);

console.log('✅ Analysis Results:');
console.log('==================');
console.log(`Score: ${result.score}/10`);
console.log(`Org Brand Present: ${result.orgBrandPresent}`);
console.log(`Org Brand Prominence: ${result.orgBrandProminence || 'N/A'}`);
console.log(`Org Brands Found: [${result.brands.join(', ')}]`);
console.log(`Competitors Found: [${result.competitors.join(', ')}]`);
console.log(`Competitor Count: ${result.competitors.length}`);

console.log('\n🎯 Key Changes Made:');
console.log('====================');
console.log('1. ✅ Exact word-boundary matching (\\b regex)');
console.log('2. ✅ Catalog-only brand detection (no generic terms)');
console.log('3. ✅ Position-based prominence calculation');
console.log('4. ✅ Simple scoring: 6 base + prominence bonus - competitor penalty');
console.log('5. ✅ Removed all complex extraction logic');
console.log('6. ✅ Clean data structure with limited results');