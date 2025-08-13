#!/usr/bin/env node

/**
 * Smoke test script for edge functions
 * Tests the daily runner by creating test data and verifying results
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

// Load environment variables
config({ path: '.env.local' })

const SUPABASE_URL = 'https://cgocsffxqyhojtyzniyz.supabase.co'
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

async function cleanup() {
  console.log('🧹 Cleaning up test data...')
  
  // Clean up in reverse dependency order
  await supabase.from('visibility_results').delete().match({ organization_id: 'smoke-test-org' })
  await supabase.from('prompt_runs').delete().match({ organization_id: 'smoke-test-org' })
  await supabase.from('prompts').delete().match({ organization_id: 'smoke-test-org' })
  await supabase.from('brand_catalog').delete().match({ organization_id: 'smoke-test-org' })
  await supabase.from('llm_providers').delete().match({ organization_id: 'smoke-test-org' })
  await supabase.from('users').delete().match({ organization_id: 'smoke-test-org' })
  await supabase.from('organizations').delete().match({ id: 'smoke-test-org' })
}

async function seedTestData() {
  console.log('🌱 Seeding test data...')

  // Create test organization
  const { error: orgError } = await supabase
    .from('organizations')
    .insert([{
      id: 'smoke-test-org',
      name: 'Test Corp',
      domain: 'testcorp.example',
      plan_tier: 'starter',
      industry: 'Technology'
    }])

  if (orgError) throw new Error(`Failed to create org: ${orgError.message}`)

  // Create test user
  const { error: userError } = await supabase
    .from('users')
    .insert([{
      id: 'smoke-test-user',
      organization_id: 'smoke-test-org',
      email: 'test@testcorp.example',
      role: 'owner'
    }])

  if (userError) throw new Error(`Failed to create user: ${userError.message}`)

  // Create brand catalog
  const { error: brandError } = await supabase
    .from('brand_catalog')
    .insert([{
      organization_id: 'smoke-test-org',
      name: 'Test Corp',
      variants_json: ['TestCorp', 'Test Company'],
      is_org_brand: true
    }])

  if (brandError) throw new Error(`Failed to create brand catalog: ${brandError.message}`)

  // Enable LLM providers
  const providers = [
    { organization_id: 'smoke-test-org', provider: 'openai', enabled: true },
    { organization_id: 'smoke-test-org', provider: 'perplexity', enabled: true }
  ]

  const { error: providerError } = await supabase
    .from('llm_providers')
    .insert(providers)

  if (providerError) throw new Error(`Failed to create providers: ${providerError.message}`)

  // Create test prompts
  const prompts = [
    {
      organization_id: 'smoke-test-org',
      text: 'What are the best software companies like Test Corp?',
      active: true
    },
    {
      organization_id: 'smoke-test-org', 
      text: 'Compare cloud computing solutions from major providers',
      active: true
    },
    {
      organization_id: 'smoke-test-org',
      text: 'Latest trends in artificial intelligence development',
      active: true
    }
  ]

  const { error: promptError } = await supabase
    .from('prompts')
    .insert(prompts)

  if (promptError) throw new Error(`Failed to create prompts: ${promptError.message}`)

  console.log('✅ Test data seeded successfully')
}

async function runDailyFunction() {
  console.log('🚀 Calling daily-run function...')

  const { data, error } = await supabase.functions.invoke('daily-run', {
    body: { test_org_filter: 'smoke-test-org' }
  })

  if (error) throw new Error(`Daily run failed: ${error.message}`)

  console.log('📊 Daily run result:', data)
  return data
}

async function verifyResults() {
  console.log('🔍 Verifying results...')

  // Check prompt runs were created
  const { data: runs, error: runsError } = await supabase
    .from('prompt_runs')
    .select('*')
    .eq('organization_id', 'smoke-test-org')

  if (runsError) throw new Error(`Failed to fetch runs: ${runsError.message}`)

  console.log(`📈 Found ${runs.length} prompt runs`)

  if (runs.length === 0) {
    throw new Error('No prompt runs were created')
  }

  // Check visibility results were created
  const { data: results, error: resultsError } = await supabase
    .from('visibility_results')
    .select('*')
    .eq('organization_id', 'smoke-test-org')

  if (resultsError) throw new Error(`Failed to fetch results: ${resultsError.message}`)

  console.log(`📊 Found ${results.length} visibility results`)

  if (results.length === 0) {
    throw new Error('No visibility results were created')
  }

  // Verify scores are in valid range
  for (const result of results) {
    if (result.score < 0 || result.score > 130) {
      throw new Error(`Invalid score: ${result.score}`)
    }
  }

  // Check that we have runs for each prompt
  const { data: prompts, error: promptsError } = await supabase
    .from('prompts')
    .select('id')
    .eq('organization_id', 'smoke-test-org')

  if (promptsError) throw new Error(`Failed to fetch prompts: ${promptsError.message}`)

  const promptIds = prompts.map(p => p.id)
  const runPromptIds = [...new Set(runs.map(r => r.prompt_id))]

  for (const promptId of promptIds) {
    if (!runPromptIds.includes(promptId)) {
      console.warn(`⚠️  No runs found for prompt ${promptId}`)
    }
  }

  console.log('✅ All verifications passed!')
  
  // Print summary
  console.log('\n📋 Test Summary:')
  console.log(`   Organizations: 1`)
  console.log(`   Prompts: ${prompts.length}`) 
  console.log(`   Runs: ${runs.length}`)
  console.log(`   Results: ${results.length}`)
  console.log(`   Score range: ${Math.min(...results.map(r => r.score))} - ${Math.max(...results.map(r => r.score))}`)
}

async function main() {
  try {
    console.log('🧪 Starting smoke test...\n')

    await cleanup()
    await seedTestData()
    await runDailyFunction()
    await verifyResults()
    
    console.log('\n🎉 Smoke test passed!')
    
  } catch (error) {
    console.error('\n❌ Smoke test failed:', error.message)
    process.exit(1)
  } finally {
    await cleanup()
    console.log('🧹 Cleanup completed')
  }
}

main()