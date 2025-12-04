import { createClient } from 'npm:@supabase/supabase-js@2'

const ORIGIN = Deno.env.get("APP_ORIGIN") ?? "https://llumos.app";

// Smart filtering logic (inline for edge function)
const GENERIC_TERMS = new Set([
  // Common words that appear capitalized but aren't brands
  'the', 'and', 'or', 'but', 'for', 'with', 'by', 'from', 'to', 'in', 'on', 'at',
  'some', 'many', 'most', 'all', 'every', 'each', 'few', 'several', 'various',
  'when', 'where', 'what', 'how', 'why', 'who', 'which', 'here', 'there', 'this', 'that',
  'business', 'company', 'corporation', 'enterprise', 'organization', 'firm', 'agency',
  'service', 'solution', 'product', 'platform', 'system', 'tool', 'software',
  'application', 'app', 'website', 'site', 'portal', 'dashboard', 'search', 'email',
  'mobile', 'web', 'online', 'digital', 'smart', 'pro', 'plus', 'premium', 'standard',
  'basic', 'free', 'paid', 'custom', 'advanced', 'data', 'database', 'server', 'cloud',
  
  // Problematic terms from responses
  'platforms', 'specific', 'consider', 'businesses', 'needs', 'options', 'features',
  'capabilities', 'functionality', 'integration', 'integrations', 'automation',
  'analytics', 'insights', 'reporting', 'management', 'marketing', 'sales', 'crm',
  'content', 'social', 'media', 'campaigns', 'leads', 'customers', 'users',
  
  // Action words often capitalized incorrectly
  'create', 'build', 'make', 'develop', 'design', 'manage', 'handle', 'process',
  'analyze', 'review', 'update', 'improve', 'optimize', 'enhance', 'track', 'monitor'
]);

function isValidCompetitor(name: string): boolean {
  if (!name || typeof name !== 'string') return false;
  
  const normalized = name.toLowerCase().trim();
  
  // Length check
  if (normalized.length < 3 || normalized.length > 50) return false;
  
  // Generic terms check
  if (GENERIC_TERMS.has(normalized)) return false;
  
  // Numbers only check
  if (/^\d+$/.test(normalized)) return false;
  
  // Special characters check (some punctuation is OK for domains)
  if (/[<>{}[\]()"`''""''„"‚'']/.test(name)) return false;
  
  // Must contain at least one letter
  if (!/[a-zA-Z]/.test(name)) return false;
  
  // Common business software patterns (positive indicators)
  const businessSoftwarePatterns = [
    /\.(com|io|org|net|co|ai)$/i,  // Domain patterns
    /^[A-Z][a-z]+([A-Z][a-z]+)*$/,  // CamelCase (like HubSpot, SaleForce)
    /Hub$|Force$|Spot$|Works?$|Pro$|Analytics$|CRM$/i  // Common business software suffixes
  ];
  
  const hasBusinessPattern = businessSoftwarePatterns.some(pattern => pattern.test(name));
  if (hasBusinessPattern) return true;
  
  // Well-known business software brands (case-insensitive check)
  const knownBusinessBrands = new Set([
    'salesforce', 'hubspot', 'mailchimp', 'zapier', 'slack', 'zoom', 'dropbox',
    'notion', 'asana', 'trello', 'monday', 'clickup', 'airtable', 'basecamp',
    'shopify', 'woocommerce', 'magento', 'bigcommerce', 'squarespace', 'wix',
    'stripe', 'paypal', 'square', 'quickbooks', 'xero', 'freshbooks',
    'adobe', 'figma', 'canva', 'sketch', 'invision', 'github', 'gitlab',
    'atlassian', 'jira', 'confluence', 'bitbucket', 'microsoft', 'google',
    'oracle', 'ibm', 'aws', 'azure', 'digitalocean', 'heroku', 'netlify',
    'marketo', 'pardot', 'klaviyo', 'constant contact', 'activecampaign',
    'pipedrive', 'zoho', 'dynamics', 'netsuite', 'workday', 'servicenow'
  ]);
  
  if (knownBusinessBrands.has(normalized)) return true;
  
  // If it's not obviously business software, require strong indicators
  // This helps filter out generic terms that made it through
  return false;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client with service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    console.log('Starting organization-specific competitor detection sync...');

    // Get recent responses grouped by organization
    const { data: responses, error: responsesError } = await supabase
      .from('prompt_provider_responses')
      .select(`
        org_id,
        competitors_json,
        score,
        run_at
      `)
      .not('competitors_json', 'is', null)
      .gte('run_at', new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()) // Last 14 days
      .eq('status', 'success')
      .order('run_at', { ascending: false });

    if (responsesError) {
      console.error('Error fetching responses:', responsesError);
      throw responsesError;
    }

    console.log(`Found ${responses?.length || 0} responses to process`);

    // Group by organization and analyze competitor patterns
    const orgCompetitorData = new Map<string, Map<string, { 
      mentions: number; 
      scores: number[]; 
      firstSeen: string; 
      lastSeen: string; 
    }>>();

    // Process responses to build competitor frequency maps per org
    for (const response of responses || []) {
      if (!response.competitors_json || !Array.isArray(response.competitors_json)) {
        continue;
      }

      const orgId = response.org_id;
      if (!orgCompetitorData.has(orgId)) {
        orgCompetitorData.set(orgId, new Map());
      }

      const orgMap = orgCompetitorData.get(orgId)!;

      for (const competitor of response.competitors_json) {
        if (typeof competitor !== 'string') continue;
        
        const competitorName = competitor.trim();
        
        // Apply smart filtering
        if (!isValidCompetitor(competitorName)) {
          continue;
        }

        if (!orgMap.has(competitorName)) {
          orgMap.set(competitorName, {
            mentions: 0,
            scores: [],
            firstSeen: response.run_at,
            lastSeen: response.run_at
          });
        }

        const data = orgMap.get(competitorName)!;
        data.mentions++;
        data.scores.push(response.score || 0);
        data.lastSeen = response.run_at;
        
        // Keep first seen as the earliest
        if (response.run_at < data.firstSeen) {
          data.firstSeen = response.run_at;
        }
      }
    }

    let totalOrgsProcessed = 0;
    let totalCompetitorsAdded = 0;
    let totalCompetitorsUpdated = 0;
    let totalCompetitorsRemoved = 0;

    // Process each organization
    for (const [orgId, competitorMap] of orgCompetitorData) {
      console.log(`Processing org ${orgId} with ${competitorMap.size} unique competitors`);
      
      totalOrgsProcessed++;

      // Get excluded competitors for this org
      const { data: exclusions } = await supabase
        .from('org_competitor_exclusions')
        .select('competitor_name')
        .eq('org_id', orgId);
      
      const excludedCompetitors = new Set(
        exclusions?.map(e => e.competitor_name.toLowerCase().trim()) || []
      );
      
      if (excludedCompetitors.size > 0) {
        console.log(`Found ${excludedCompetitors.size} excluded competitors for org ${orgId}`);
      }

      // CRITICAL: Get org brands to prevent adding them as competitors
      const { data: orgBrands } = await supabase
        .from('brand_catalog')
        .select('name, variants_json')
        .eq('org_id', orgId)
        .eq('is_org_brand', true);
      
      // Build set of all org brand names and variants (lowercase)
      const orgBrandNames = new Set<string>();
      for (const brand of orgBrands || []) {
        orgBrandNames.add(brand.name.toLowerCase().trim());
        for (const variant of brand.variants_json || []) {
          if (typeof variant === 'string') {
            orgBrandNames.add(variant.toLowerCase().trim());
          }
        }
      }
      
      // Also add org name and domain from organizations table
      const { data: orgDetails } = await supabase
        .from('organizations')
        .select('name, domain')
        .eq('id', orgId)
        .single();
      
      if (orgDetails) {
        orgBrandNames.add(orgDetails.name.toLowerCase().trim());
        if (orgDetails.domain) {
          // Add domain without TLD as potential brand match
          const domainName = orgDetails.domain.toLowerCase().replace(/\.(com|org|net|io|co|ai).*$/, '').trim();
          orgBrandNames.add(domainName);
        }
      }
      
      if (orgBrandNames.size > 0) {
        console.log(`Found ${orgBrandNames.size} org brand names/variants to exclude for org ${orgId}`);
      }

      // Get existing competitors for this org
      const { data: existingCompetitors, error: existingError } = await supabase
        .from('brand_catalog')
        .select('id, name, total_appearances, last_seen_at')
        .eq('org_id', orgId)
        .eq('is_org_brand', false);

      if (existingError) {
        console.error(`Error fetching existing competitors for org ${orgId}:`, existingError);
        continue;
      }

      const existingMap = new Map(existingCompetitors?.map(c => [c.name.toLowerCase(), c]) || []);

      // Process competitors with frequency threshold
      for (const [competitorName, data] of competitorMap) {
        const normalizedName = competitorName.toLowerCase().trim();
        
        // CRITICAL: Skip if this is an org brand (prevent self-competitor)
        if (orgBrandNames.has(normalizedName)) {
          console.log(`Skipping org brand detected as competitor: ${competitorName}`);
          continue;
        }
        
        // Check if competitor is excluded - if so, delete it from catalog if it exists
        if (excludedCompetitors.has(normalizedName)) {
          console.log(`Competitor is excluded: ${competitorName}`);
          
          const existingKey = competitorName.toLowerCase();
          const existing = existingMap.get(existingKey);
          
          if (existing) {
            // Delete excluded competitor from catalog
            const { error: deleteError } = await supabase
              .from('brand_catalog')
              .delete()
              .eq('id', existing.id);
            
            if (!deleteError) {
              console.log(`Deleted excluded competitor from catalog: ${competitorName}`);
              totalCompetitorsRemoved++;
            } else {
              console.error(`Error deleting excluded competitor ${competitorName}:`, deleteError);
            }
          }
          
          continue;
        }

        const avgScore = data.scores.reduce((a, b) => a + b, 0) / data.scores.length;
        
        // Frequency threshold: must be mentioned at least 3 times OR have high confidence
        const meetsFrequencyThreshold = data.mentions >= 3 || avgScore >= 7.0;
        
        if (!meetsFrequencyThreshold) {
          console.log(`Skipping ${competitorName}: only ${data.mentions} mentions (threshold: 3)`);
          continue;
        }

        const existingKey = competitorName.toLowerCase();
        const existing = existingMap.get(existingKey);

        if (existing) {
          // Update existing competitor
          const newAppearances = Math.max(existing.total_appearances || 0, data.mentions);
          
          const { error: updateError } = await supabase
            .from('brand_catalog')
            .update({
              last_seen_at: data.lastSeen,
              total_appearances: newAppearances,
              average_score: avgScore
            })
            .eq('id', existing.id);

          if (!updateError) {
            totalCompetitorsUpdated++;
            console.log(`Updated competitor: ${competitorName} (${data.mentions} mentions, avg score: ${avgScore.toFixed(1)})`);
          }
        } else {
          // Add new legitimate competitor
          const { error: insertError } = await supabase
            .from('brand_catalog')
            .insert({
              org_id: orgId,
              name: competitorName,
              is_org_brand: false,
              variants_json: [],
              first_detected_at: data.firstSeen,
              last_seen_at: data.lastSeen,
              total_appearances: data.mentions,
              average_score: avgScore
            });

          if (!insertError) {
            totalCompetitorsAdded++;
            console.log(`Added new competitor: ${competitorName} (${data.mentions} mentions, avg score: ${avgScore.toFixed(1)})`);
          } else {
            console.error(`Error adding competitor ${competitorName}:`, insertError);
          }
        }

        // Remove from existing map to track what wasn't updated
        existingMap.delete(existingKey);
      }

      // Clean up stale competitors (not seen in last 14 days)
      const cutoffDate = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
      
      for (const [_, existing] of existingMap) {
        if (existing.last_seen_at && existing.last_seen_at < cutoffDate) {
          const { error: deleteError } = await supabase
            .from('brand_catalog')
            .delete()
            .eq('id', existing.id);

          if (!deleteError) {
            totalCompetitorsRemoved++;
            console.log(`Removed stale competitor: ${existing.name} (last seen: ${existing.last_seen_at})`);
          }
        }
      }
    }

    const result = {
      message: 'Organization-specific competitor sync completed',
      orgsProcessed: totalOrgsProcessed,
      competitorsAdded: totalCompetitorsAdded,
      competitorsUpdated: totalCompetitorsUpdated,
      competitorsRemoved: totalCompetitorsRemoved,
      responsesAnalyzed: responses?.length || 0,
      timestamp: new Date().toISOString()
    };

    console.log('Sync completed:', result);

    return new Response(
      JSON.stringify(result),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error: unknown) {
    console.error('Competitor sync error:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Competitor sync failed',
        message: error.message,
        timestamp: new Date().toISOString()
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});