#!/usr/bin/env -S deno run --allow-all

/**
 * E2E Test Data Seeding Script
 * Creates synthetic test users, organizations, and data for isolated testing
 * Usage: deno run --allow-all scripts/e2e-seed.ts
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = "https://cgocsffxqyhojtyzniyz.supabase.co";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_SERVICE_KEY) {
  console.error("❌ SUPABASE_SERVICE_ROLE_KEY environment variable required");
  Deno.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Test user configurations
const TEST_USERS = [
  {
    email: 'starter_e2e@test.app',
    password: 'test123456789',
    orgName: 'Starter E2E Corp',
    domain: 'starter-e2e.test',
    planTier: 'starter'
  },
  {
    email: 'growth_e2e@test.app', 
    password: 'test123456789',
    orgName: 'Growth E2E Corp',
    domain: 'growth-e2e.test',
    planTier: 'growth'
  },
  {
    email: 'aj@test.com',
    password: 'dix123',
    orgName: 'AJ Pro Test Corp',
    domain: 'aj-pro.test',
    planTier: 'pro'
  }
];

const SAMPLE_PROMPTS = [
  "Compare HubSpot vs Salesforce for CRM management",
  "What are the best project management tools for remote teams?",
  "Analyze marketing automation platforms for B2B companies"
];

async function createTestUser(config: typeof TEST_USERS[0]) {
  console.log(`📝 Creating test user: ${config.email}`);
  
  // Create auth user
  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email: config.email,
    password: config.password,
    email_confirm: true
  });
  
  if (authError && !authError.message.includes('already registered')) {
    throw new Error(`Failed to create auth user: ${authError.message}`);
  }
  
  const userId = authUser?.user?.id || (await supabase.auth.admin.listUsers()).data.users.find(u => u.email === config.email)?.id;
  
  if (!userId) {
    throw new Error(`Could not get user ID for ${config.email}`);
  }
  
  // Create organization
  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .upsert({
      name: config.orgName,
      domain: config.domain,
      plan_tier: config.planTier,
      subscription_tier: config.planTier,
      verified_at: new Date().toISOString(),
      business_description: `Test organization for E2E testing (${config.planTier} tier)`,
      keywords: ['testing', 'e2e', 'automation'],
      competitors: ['TestCompetitor1', 'TestCompetitor2']
    }, {
      onConflict: 'domain'
    })
    .select()
    .single();
    
  if (orgError) {
    throw new Error(`Failed to create organization: ${orgError.message}`);
  }
  
  // Create user record
  const { error: userError } = await supabase
    .from('users')
    .upsert({
      id: userId,
      email: config.email,
      org_id: org.id,
      role: 'owner'
    }, {
      onConflict: 'id'
    });
    
  if (userError) {
    throw new Error(`Failed to create user record: ${userError.message}`);
  }
  
  // Create subscriber record
  const trialExpiry = new Date();
  // Give AJ@test.com 12 months, others get 14 days
  const daysToAdd = config.email === 'aj@test.com' ? 365 : 14;
  trialExpiry.setDate(trialExpiry.getDate() + daysToAdd);
  
  const { error: subError } = await supabase
    .from('subscribers')
    .upsert({
      user_id: userId,
      email: config.email,
      subscription_tier: config.planTier,
      subscribed: true,
      payment_collected: true,
      trial_started_at: new Date().toISOString(),
      trial_expires_at: trialExpiry.toISOString(),
      subscription_end: trialExpiry.toISOString()
    }, {
      onConflict: 'user_id'
    });
    
  if (subError) {
    throw new Error(`Failed to create subscriber: ${subError.message}`);
  }
  
  // Create sample prompts
  for (const promptText of SAMPLE_PROMPTS) {
    const { error: promptError } = await supabase
      .from('prompts')
      .upsert({
        org_id: org.id,
        text: promptText,
        active: true
      }, {
        onConflict: 'org_id,text'
      });
      
    if (promptError && !promptError.message.includes('duplicate')) {
      console.warn(`Warning: Failed to create prompt "${promptText}": ${promptError.message}`);
    }
  }
  
  console.log(`✅ Created test user: ${config.email} (org: ${org.id})`);
  return { userId, orgId: org.id };
}

async function seedBrandCatalog(orgId: string, orgName: string) {
  console.log(`📝 Seeding brand catalog for org: ${orgId}`);
  
  // Add org brand
  const { error: orgBrandError } = await supabase
    .from('brand_catalog')
    .upsert({
      org_id: orgId,
      name: orgName,
      is_org_brand: true,
      variants_json: [orgName, orgName.replace(' E2E Corp', ''), orgName.toLowerCase()],
      first_detected_at: new Date().toISOString(),
      last_seen_at: new Date().toISOString(),
      total_appearances: 1,
      average_score: 8.0
    }, {
      onConflict: 'org_id,name'
    });
    
  if (orgBrandError) {
    console.warn(`Warning: Failed to create org brand: ${orgBrandError.message}`);
  }
  
  // Add test competitors
  const competitors = ['TestCompetitor A', 'TestCompetitor B', 'TestCompetitor C'];
  for (const competitor of competitors) {
    const { error: compError } = await supabase
      .from('brand_catalog')
      .upsert({
        org_id: orgId,
        name: competitor,
        is_org_brand: false,
        variants_json: [competitor],
        first_detected_at: new Date().toISOString(),
        last_seen_at: new Date().toISOString(),
        total_appearances: 3,
        average_score: 5.5
      }, {
        onConflict: 'org_id,name'
      });
      
    if (compError) {
      console.warn(`Warning: Failed to create competitor ${competitor}: ${compError.message}`);
    }
  }
}

async function main() {
  console.log('🚀 Starting E2E test data seeding...');
  
  try {
    for (const userConfig of TEST_USERS) {
      const { userId, orgId } = await createTestUser(userConfig);
      await seedBrandCatalog(orgId, userConfig.orgName);
    }
    
    console.log('✅ E2E test data seeding completed successfully!');
    console.log('\nTest accounts created:');
    TEST_USERS.forEach(user => {
      console.log(`  - ${user.email} (${user.planTier} tier)`);
    });
    
  } catch (error) {
    console.error('❌ Seeding failed:', error.message);
    Deno.exit(1);
  }
}

if (import.meta.main) {
  main();
}