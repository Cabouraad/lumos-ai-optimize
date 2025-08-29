/**
 * Test Data and Utilities for Competitor Detection Tests
 */

export const TEST_BRAND_CATALOG = [
  { name: 'HubSpot', variants_json: ['hubspot', 'HubSpot Marketing Hub', 'Hub Spot'], is_org_brand: false },
  { name: 'Salesforce', variants_json: ['salesforce', 'Sales Force', 'SFDC'], is_org_brand: false },
  { name: 'Zoho CRM', variants_json: ['zoho', 'zoho crm', 'Zoho'], is_org_brand: false },
  { name: 'Freshworks', variants_json: ['freshworks', 'fresh works', 'Freshdesk'], is_org_brand: false },
  { name: 'Microsoft', variants_json: ['microsoft', 'MS', 'MSFT'], is_org_brand: false },
  { name: 'Google Workspace', variants_json: ['google workspace', 'g suite', 'gsuite'], is_org_brand: false },
  { name: 'Pipedrive', variants_json: ['pipedrive', 'pipe drive'], is_org_brand: false },
  { name: 'Monday.com', variants_json: ['monday', 'monday.com'], is_org_brand: false },
  { name: 'TestCorp', variants_json: ['testcorp', 'test corp', 'TestCompany'], is_org_brand: true },
  { name: 'MyBrand', variants_json: ['mybrand', 'my brand'], is_org_brand: true }
];

export const TEST_ORGANIZATION = {
  name: 'TestCorp',
  metadata: {
    competitorsSeed: ['Asana', 'Notion', 'Trello', 'ClickUp']
  }
};

export const TEST_PAST_COMPETITORS = [
  { competitors_json: ['HubSpot', 'Salesforce', 'Pipedrive'] },
  { competitors_json: ['Zoho CRM', 'Freshworks', 'Monday.com'] },
  { competitors_json: ['HubSpot', 'Microsoft', 'Google Workspace'] }
];

export const TEST_CASES = [
  {
    name: 'Basic competitor detection',
    input: 'HubSpot and Salesforce are top alternatives.',
    expected: { competitors: ['HubSpot', 'Salesforce'], orgBrands: [] }
  },
  {
    name: 'Generic words filtering',
    input: 'Using an all-in-one customer platform improves experience.',
    expected: { competitors: [], orgBrands: [] }
  },
  {
    name: 'Compound brand names',
    input: 'Zoho CRM and Freshworks are gaining traction.',
    expected: { competitors: ['Zoho CRM', 'Freshworks'], orgBrands: [] }
  },
  {
    name: 'Stopwords only',
    input: 'While making decisions, user experience is important.',
    expected: { competitors: [], orgBrands: [] }
  },
  {
    name: 'Mixed content with org brand',
    input: 'TestCorp competes with HubSpot and Salesforce while providing better experience.',
    expected: { competitors: ['HubSpot', 'Salesforce'], orgBrands: ['TestCorp'] }
  },
  {
    name: 'Case sensitivity and variants',
    input: 'hubspot and sales force are alternatives to our platform.',
    expected: { competitors: ['HubSpot', 'Salesforce'], orgBrands: [] }
  },
  {
    name: 'Domain-like mentions',
    input: 'Check out hubspot.com and salesforce.com for alternatives.',
    expected: { competitors: ['HubSpot', 'Salesforce'], orgBrands: [] }
  },
  {
    name: 'Quoted brand names',
    input: 'Companies like "HubSpot" and "Zoho CRM" offer similar solutions.',
    expected: { competitors: ['HubSpot', 'Zoho CRM'], orgBrands: [] }
  },
  {
    name: 'No false positives from action words',
    input: 'When implementing solutions, focus on user experience and making improvements.',
    expected: { competitors: [], orgBrands: [] }
  },
  {
    name: 'Complex sentence with mixed entities',
    input: 'TestCorp provides better ROI than HubSpot, Salesforce, or Zoho CRM when implementing marketing automation.',
    expected: { competitors: ['HubSpot', 'Salesforce', 'Zoho CRM'], orgBrands: ['TestCorp'] }
  },
  {
    name: 'Social media tools detection',
    input: 'HubSpot, Buffer, and Hootsuite are top tools.',
    expected: { competitors: ['HubSpot', 'Buffer', 'Hootsuite'], orgBrands: [] }
  },
  {
    name: 'Generic platform language filtering',
    input: 'Using an all-in-one customer platform improves experience.',
    expected: { competitors: [], orgBrands: [] }
  },
  {
    name: 'Email and automation tools',
    input: 'Mailchimp and Zapier both support workflows.',
    expected: { competitors: ['Mailchimp', 'Zapier'], orgBrands: [] }
  },
  {
    name: 'Generic marketing terms filtering',
    input: 'Marketing automation and customer data are important.',
    expected: { competitors: [], orgBrands: [] }
  }
];

export const EXPECTED_STOPWORDS = [
  'using', 'making', 'while', 'experience', 'implementing', 'focus', 'providing',
  'when', 'than', 'better', 'improving', 'solutions', 'platform', 'customer',
  'user', 'marketing', 'automation', 'decisions', 'important'
];

export const EXPECTED_VALID_BRANDS = [
  'HubSpot', 'Salesforce', 'Zoho CRM', 'Freshworks', 'Microsoft', 
  'Google Workspace', 'Pipedrive', 'Monday.com', 'TestCorp', 'MyBrand'
];

/**
 * Helper function to normalize competitor names for comparison
 */
export function normalizeCompetitorName(name: string): string {
  return name.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/\s+/g, ' ');
}

/**
 * Helper function to validate competitor detection result structure
 */
export function validateDetectionResult(result: any): string[] {
  const errors: string[] = [];

  if (!result || typeof result !== 'object') {
    errors.push('Result must be an object');
    return errors;
  }

  if (!Array.isArray(result.competitors)) {
    errors.push('competitors must be an array');
  }

  if (!Array.isArray(result.orgBrands)) {
    errors.push('orgBrands must be an array');
  }

  if (!Array.isArray(result.rejectedTerms)) {
    errors.push('rejectedTerms must be an array');
  }

  if (!result.metadata || typeof result.metadata !== 'object') {
    errors.push('metadata must be an object');
  } else {
    const requiredMetadataFields = [
      'gazetteer_matches',
      'ner_matches', 
      'total_candidates',
      'processing_time_ms'
    ];

    requiredMetadataFields.forEach(field => {
      if (typeof result.metadata[field] !== 'number') {
        errors.push(`metadata.${field} must be a number`);
      }
    });
  }

  // Validate competitor objects structure
  if (Array.isArray(result.competitors)) {
    result.competitors.forEach((comp: any, index: number) => {
      if (!comp || typeof comp !== 'object') {
        errors.push(`competitors[${index}] must be an object`);
        return;
      }

      const requiredFields = ['name', 'normalized', 'mentions', 'first_pos_ratio', 'confidence', 'source'];
      requiredFields.forEach(field => {
        if (comp[field] === undefined || comp[field] === null) {
          errors.push(`competitors[${index}].${field} is required`);
        }
      });

      if (typeof comp.name !== 'string') {
        errors.push(`competitors[${index}].name must be a string`);
      }

      if (typeof comp.confidence !== 'number' || comp.confidence < 0 || comp.confidence > 1) {
        errors.push(`competitors[${index}].confidence must be a number between 0 and 1`);
      }

      if (typeof comp.first_pos_ratio !== 'number' || comp.first_pos_ratio < 0 || comp.first_pos_ratio > 1) {
        errors.push(`competitors[${index}].first_pos_ratio must be a number between 0 and 1`);
      }

      if (!['gazetteer', 'ner', 'catalog'].includes(comp.source)) {
        errors.push(`competitors[${index}].source must be 'gazetteer', 'ner', or 'catalog'`);
      }
    });
  }

  return errors;
}