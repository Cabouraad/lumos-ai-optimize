#!/usr/bin/env -S deno run --allow-all

/**
 * E2E Test Data Cleanup Script
 * Removes synthetic test data created by e2e-seed.ts
 * Usage: deno run --allow-all scripts/e2e-clean.ts [--keep-users]
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

const TEST_EMAILS = [
  'starter_e2e@test.app',
  'growth_e2e@test.app'
];

const TEST_DOMAINS = [
  'starter-e2e.test',
  'growth-e2e.test'
];

async function parseArgs() {
  const keepUsers = Deno.args.includes('--keep-users');
  return { keepUsers };
}

async function getTestOrgIds(): Promise<string[]> {
  const { data: orgs, error } = await supabase
    .from('organizations')
    .select('id')
    .in('domain', TEST_DOMAINS);
    
  if (error) {
    throw new Error(`Failed to fetch test orgs: ${error.message}`);
  }
  
  return orgs?.map(org => org.id) || [];
}

async function getTestUserIds(): Promise<string[]> {
  const { data: users, error } = await supabase
    .from('users')
    .select('id')
    .in('email', TEST_EMAILS);
    
  if (error) {
    throw new Error(`Failed to fetch test users: ${error.message}`);
  }
  
  return users?.map(user => user.id) || [];
}

async function cleanupTestData(keepUsers: boolean = false) {
  console.log('🧹 Starting E2E test data cleanup...');
  
  const orgIds = await getTestOrgIds();
  const userIds = await getTestUserIds();
  
  console.log(`Found ${orgIds.length} test orgs and ${userIds.length} test users to clean`);
  
  // Delete org-related data
  if (orgIds.length > 0) {
    console.log('📝 Cleaning org-related data...');
    
    // Delete prompt provider responses
    const { error: pprError } = await supabase
      .from('prompt_provider_responses')
      .delete()
      .in('org_id', orgIds);
    if (pprError) console.warn(`Warning cleaning responses: ${pprError.message}`);
    
    // Delete prompts
    const { error: promptError } = await supabase
      .from('prompts')
      .delete()
      .in('org_id', orgIds);
    if (promptError) console.warn(`Warning cleaning prompts: ${promptError.message}`);
    
    // Delete brand catalog
    const { error: brandError } = await supabase
      .from('brand_catalog')
      .delete()
      .in('org_id', orgIds);
    if (brandError) console.warn(`Warning cleaning brands: ${brandError.message}`);
    
    // Delete brand candidates
    const { error: candidatesError } = await supabase
      .from('brand_candidates')
      .delete()
      .in('org_id', orgIds);
    if (candidatesError) console.warn(`Warning cleaning candidates: ${candidatesError.message}`);
    
    // Delete suggested prompts
    const { error: suggestedError } = await supabase
      .from('suggested_prompts')
      .delete()
      .in('org_id', orgIds);
    if (suggestedError) console.warn(`Warning cleaning suggestions: ${suggestedError.message}`);
    
    // Delete recommendations
    const { error: recoError } = await supabase
      .from('recommendations')
      .delete()
      .in('org_id', orgIds);
    if (recoError) console.warn(`Warning cleaning recommendations: ${recoError.message}`);
    
    // Delete reports
    const { error: reportError } = await supabase
      .from('reports')
      .delete()
      .in('org_id', orgIds);
    if (reportError) console.warn(`Warning cleaning reports: ${reportError.message}`);
    
    // Delete weekly reports
    const { error: weeklyError } = await supabase
      .from('weekly_reports')
      .delete()
      .in('org_id', orgIds);
    if (weeklyError) console.warn(`Warning cleaning weekly reports: ${weeklyError.message}`);
    
    // Delete batch jobs
    const { error: batchError } = await supabase
      .from('batch_jobs')
      .delete()
      .in('org_id', orgIds);
    if (batchError) console.warn(`Warning cleaning batch jobs: ${batchError.message}`);
    
    // Delete daily usage
    const { error: usageError } = await supabase
      .from('daily_usage')
      .delete()
      .in('org_id', orgIds);
    if (usageError) console.warn(`Warning cleaning usage: ${usageError.message}`);
  }
  
  // Delete user-related data
  if (userIds.length > 0 && !keepUsers) {
    console.log('📝 Cleaning user-related data...');
    
    // Delete subscribers
    const { error: subError } = await supabase
      .from('subscribers')
      .delete()
      .in('user_id', userIds);
    if (subError) console.warn(`Warning cleaning subscribers: ${subError.message}`);
    
    // Delete users (this will cascade to auth.users)
    const { error: userError } = await supabase
      .from('users')
      .delete()
      .in('id', userIds);
    if (userError) console.warn(`Warning cleaning users: ${userError.message}`);
    
    // Delete auth users
    for (const userId of userIds) {
      try {
        const { error: authError } = await supabase.auth.admin.deleteUser(userId);
        if (authError) console.warn(`Warning deleting auth user ${userId}: ${authError.message}`);
      } catch (e) {
        console.warn(`Warning deleting auth user ${userId}: ${e.message}`);
      }
    }
  }
  
  // Delete organizations (do this last due to foreign key constraints)
  if (orgIds.length > 0 && !keepUsers) {
    console.log('📝 Cleaning organizations...');
    const { error: orgError } = await supabase
      .from('organizations')
      .delete()
      .in('id', orgIds);
    if (orgError) console.warn(`Warning cleaning orgs: ${orgError.message}`);
  }
  
  console.log(`✅ Cleanup completed! ${keepUsers ? '(Users preserved)' : ''}`);
}

async function main() {
  try {
    const { keepUsers } = await parseArgs();
    await cleanupTestData(keepUsers);
  } catch (error) {
    console.error('❌ Cleanup failed:', error.message);
    Deno.exit(1);
  }
}

if (import.meta.main) {
  main();
}