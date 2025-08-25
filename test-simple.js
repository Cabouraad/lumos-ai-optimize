// Quick test of new brand analysis
const response = `Yes, there are several marketing platforms that offer both email automation and content management capabilities. Here are some popular options:

1. **HubSpot**: HubSpot is an all-in-one marketing platform that includes email marketing automation, content management (CMS), customer relationship management (CRM), and more.

2. **Mailchimp**: While primarily known for its email marketing services, Mailchimp also offers a basic content management system.

3. **ActiveCampaign**: ActiveCampaign combines email marketing automation with CRM features.`;

// Only real brands from catalog (not generic terms)
const realBrands = [
  { name: "HubSpot", variants_json: ["hubspot"], is_org_brand: true },
  { name: "Mailchimp", variants_json: [], is_org_brand: false },
  { name: "ActiveCampaign", variants_json: [], is_org_brand: false }
];

function findExactMatches(text, brandName) {
  const regex = new RegExp(`\\b${brandName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
  const matches = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    matches.push(match.index);
  }
  return matches;
}

console.log('🧪 NEW SYSTEM TEST RESULTS:');
console.log('===========================');

realBrands.forEach(brand => {
  const matches = findExactMatches(response, brand.name);
  console.log(`${brand.name} (${brand.is_org_brand ? 'ORG' : 'COMPETITOR'}): ${matches.length} matches`);
});

console.log('\n✅ Expected Results:');
console.log('- HubSpot: 2 matches (org brand found)');
console.log('- Mailchimp: 1 match (competitor)');  
console.log('- ActiveCampaign: 1 match (competitor)');
console.log('- Score: ~6-7 (org brand present + good prominence)');
console.log('- Prominence: 1 (HubSpot appears first among brands)');

console.log('\n🔧 Key Fixes Applied:');
console.log('- Exact word boundaries (no partial matches)');
console.log('- Real brands only (no "Popular", "Tools", etc.)');
console.log('- Position-based prominence calculation');
console.log('- Limited competitor count (max 10)');