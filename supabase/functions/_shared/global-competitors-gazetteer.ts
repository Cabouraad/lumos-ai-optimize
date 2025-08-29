/**
 * Global SaaS Competitors Gazetteer
 * Comprehensive list of known CRM, marketing, and business software competitors
 */

export interface GlobalCompetitor {
  name: string;
  normalized: string;
  category: string;
  aliases: string[];
}

/**
 * Global competitors database with normalized names and aliases
 */
export const GLOBAL_COMPETITORS: GlobalCompetitor[] = [
  // CRM Platforms
  { name: 'HubSpot', normalized: 'hubspot', category: 'crm', aliases: ['hubspot', 'hub spot', 'hubspot crm', 'marketing hub', 'sales hub', 'service hub'] },
  { name: 'Salesforce', normalized: 'salesforce', category: 'crm', aliases: ['salesforce', 'sales force', 'sfdc', 'salesforce crm'] },
  { name: 'Zoho CRM', normalized: 'zoho crm', category: 'crm', aliases: ['zoho', 'zoho crm', 'zoho one'] },
  { name: 'Pipedrive', normalized: 'pipedrive', category: 'crm', aliases: ['pipedrive', 'pipe drive'] },
  { name: 'Freshworks', normalized: 'freshworks', category: 'crm', aliases: ['freshworks', 'freshsales', 'freshdesk'] },
  { name: 'Monday.com', normalized: 'monday.com', category: 'project', aliases: ['monday', 'monday.com', 'mondaycom'] },
  { name: 'Asana', normalized: 'asana', category: 'project', aliases: ['asana'] },
  { name: 'Trello', normalized: 'trello', category: 'project', aliases: ['trello'] },
  { name: 'ClickUp', normalized: 'clickup', category: 'project', aliases: ['clickup', 'click up'] },
  { name: 'Notion', normalized: 'notion', category: 'productivity', aliases: ['notion'] },

  // Email Marketing
  { name: 'Mailchimp', normalized: 'mailchimp', category: 'email', aliases: ['mailchimp', 'mail chimp'] },
  { name: 'Constant Contact', normalized: 'constant contact', category: 'email', aliases: ['constant contact', 'constantcontact'] },
  { name: 'ActiveCampaign', normalized: 'activecampaign', category: 'email', aliases: ['activecampaign', 'active campaign'] },
  { name: 'ConvertKit', normalized: 'convertkit', category: 'email', aliases: ['convertkit', 'convert kit'] },
  { name: 'Klaviyo', normalized: 'klaviyo', category: 'email', aliases: ['klaviyo'] },
  { name: 'GetResponse', normalized: 'getresponse', category: 'email', aliases: ['getresponse', 'get response'] },
  { name: 'AWeber', normalized: 'aweber', category: 'email', aliases: ['aweber'] },
  { name: 'Campaign Monitor', normalized: 'campaign monitor', category: 'email', aliases: ['campaign monitor', 'campaignmonitor'] },

  // Marketing Automation
  { name: 'Marketo', normalized: 'marketo', category: 'automation', aliases: ['marketo', 'adobe marketo'] },
  { name: 'Pardot', normalized: 'pardot', category: 'automation', aliases: ['pardot', 'salesforce pardot'] },
  { name: 'Eloqua', normalized: 'eloqua', category: 'automation', aliases: ['eloqua', 'oracle eloqua'] },
  { name: 'SharpSpring', normalized: 'sharpspring', category: 'automation', aliases: ['sharpspring', 'sharp spring'] },

  // SEO & Analytics
  { name: 'SEMrush', normalized: 'semrush', category: 'seo', aliases: ['semrush', 'sem rush'] },
  { name: 'Ahrefs', normalized: 'ahrefs', category: 'seo', aliases: ['ahrefs'] },
  { name: 'Moz', normalized: 'moz', category: 'seo', aliases: ['moz', 'moz pro'] },
  { name: 'Google Analytics', normalized: 'google analytics', category: 'analytics', aliases: ['google analytics', 'ga', 'ga4', 'universal analytics'] },
  { name: 'Adobe Analytics', normalized: 'adobe analytics', category: 'analytics', aliases: ['adobe analytics', 'omniture'] },
  { name: 'Mixpanel', normalized: 'mixpanel', category: 'analytics', aliases: ['mixpanel'] },
  { name: 'Amplitude', normalized: 'amplitude', category: 'analytics', aliases: ['amplitude'] },

  // Social Media Management
  { name: 'Buffer', normalized: 'buffer', category: 'social', aliases: ['buffer'] },
  { name: 'Hootsuite', normalized: 'hootsuite', category: 'social', aliases: ['hootsuite', 'hoot suite'] },
  { name: 'Sprout Social', normalized: 'sprout social', category: 'social', aliases: ['sprout social', 'sproutsocial'] },
  { name: 'Later', normalized: 'later', category: 'social', aliases: ['later'] },
  { name: 'SocialBee', normalized: 'socialbee', category: 'social', aliases: ['socialbee', 'social bee'] },
  { name: 'CoSchedule', normalized: 'coschedule', category: 'social', aliases: ['coschedule', 'co schedule'] },

  // Content Marketing
  { name: 'BuzzSumo', normalized: 'buzzsumo', category: 'content', aliases: ['buzzsumo', 'buzz sumo'] },
  { name: 'ContentCal', normalized: 'contentcal', category: 'content', aliases: ['contentcal', 'content cal'] },
  { name: 'Canva', normalized: 'canva', category: 'design', aliases: ['canva'] },
  { name: 'Figma', normalized: 'figma', category: 'design', aliases: ['figma'] },

  // Automation & Integration
  { name: 'Zapier', normalized: 'zapier', category: 'automation', aliases: ['zapier'] },
  { name: 'Make', normalized: 'make', category: 'automation', aliases: ['make', 'integromat'] },
  { name: 'IFTTT', normalized: 'ifttt', category: 'automation', aliases: ['ifttt', 'if this then that'] },

  // Website Analytics & Optimization
  { name: 'Hotjar', normalized: 'hotjar', category: 'analytics', aliases: ['hotjar', 'hot jar'] },
  { name: 'Crazy Egg', normalized: 'crazy egg', category: 'analytics', aliases: ['crazy egg', 'crazyegg'] },
  { name: 'Optimizely', normalized: 'optimizely', category: 'optimization', aliases: ['optimizely'] },
  { name: 'VWO', normalized: 'vwo', category: 'optimization', aliases: ['vwo', 'visual website optimizer'] },

  // Communication & Support
  { name: 'Slack', normalized: 'slack', category: 'communication', aliases: ['slack'] },
  { name: 'Microsoft Teams', normalized: 'microsoft teams', category: 'communication', aliases: ['teams', 'microsoft teams', 'ms teams'] },
  { name: 'Zoom', normalized: 'zoom', category: 'communication', aliases: ['zoom'] },
  { name: 'Intercom', normalized: 'intercom', category: 'support', aliases: ['intercom'] },
  { name: 'Zendesk', normalized: 'zendesk', category: 'support', aliases: ['zendesk', 'zen desk'] },
  { name: 'LiveChat', normalized: 'livechat', category: 'support', aliases: ['livechat', 'live chat'] },
];

/**
 * Create a normalized lookup map for fast matching
 */
export function createGlobalCompetitorsMap(): Map<string, GlobalCompetitor> {
  const map = new Map<string, GlobalCompetitor>();
  
  for (const competitor of GLOBAL_COMPETITORS) {
    // Add main normalized name
    map.set(competitor.normalized, competitor);
    
    // Add all aliases
    for (const alias of competitor.aliases) {
      map.set(alias.toLowerCase().trim(), competitor);
    }
  }
  
  return map;
}

/**
 * Get competitor by normalized name or alias
 */
export function findGlobalCompetitor(name: string): GlobalCompetitor | null {
  const competitorsMap = createGlobalCompetitorsMap();
  const normalized = name.toLowerCase().trim();
  return competitorsMap.get(normalized) || null;
}

/**
 * Check if a name is a known global competitor
 */
export function isGlobalCompetitor(name: string): boolean {
  return findGlobalCompetitor(name) !== null;
}