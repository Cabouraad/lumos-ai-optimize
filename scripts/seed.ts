#!/usr/bin/env node

/**
 * Seed script for development environment
 * Creates a sample organization with test data
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://cgocsffxqyhojtyzniyz.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnb2NzZmZ4cXlob2p0eXpuaXl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwNDI1MDksImV4cCI6MjA3MDYxODUwOX0.Rn2lVaTcuu0TEn7S20a_56mkEBkG3_a7CT16CpEfirk'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

async function seed() {
  try {
    console.log('🌱 Starting seed process...')

    // Check if org already exists
    const { data: existingOrg } = await supabase
      .from('organizations')
      .select('id')
      .eq('name', 'Acme')
      .single()

    if (existingOrg) {
      console.log('✅ Acme organization already exists, skipping creation')
      return
    }

    const orgId = crypto.randomUUID()
    const userId = crypto.randomUUID()

    // Create organization
    console.log('📋 Creating Acme organization...')
    const { error: orgError } = await supabase
      .from('organizations')
      .insert([{
        id: orgId,
        name: 'Acme',
        domain: 'acme.example',
        plan_tier: 'starter',
        industry: 'Technology',
        keywords: 'software development, consulting, automation',
        competitors: 'TechCorp, InnovateCo, BuildSoft'
      }])

    if (orgError) {
      console.error('❌ Failed to create organization:', orgError.message)
      return
    }

    // Create user (Note: In real app, this would be tied to authenticated user)
    console.log('👤 Creating owner user...')
    const { error: userError } = await supabase
      .from('users')
      .insert([{
        id: userId,
        organization_id: orgId,
        email: 'owner@acme.example',
        role: 'owner'
      }])

    if (userError) {
      console.error('❌ Failed to create user:', userError.message)
      return
    }

    // Create brand catalog
    console.log('🏷️  Creating brand catalog...')
    const { error: brandError } = await supabase
      .from('brand_catalog')
      .insert([{
        organization_id: orgId,
        name: 'Acme',
        variants_json: ['Acme Co', 'Acme Inc'],
        is_org_brand: true
      }])

    if (brandError) {
      console.error('❌ Failed to create brand catalog:', brandError.message)
      return
    }

    // Enable LLM providers
    console.log('🤖 Setting up LLM providers...')
    const providers = [
      { organization_id: orgId, provider: 'openai', enabled: true },
      { organization_id: orgId, provider: 'perplexity', enabled: true }
    ]

    const { error: providerError } = await supabase
      .from('llm_providers')
      .insert(providers)

    if (providerError) {
      console.error('❌ Failed to create providers:', providerError.message)
      return
    }

    // Create sample prompts
    console.log('💭 Creating sample prompts...')
    const prompts = [
      'What are the best software development companies for enterprise automation?',
      'Compare top consulting firms specializing in digital transformation',
      'Who are the leading providers of business automation solutions?',
      'What companies offer the best custom software development services?',
      'Which firms excel at technology consulting for mid-market businesses?'
    ]

    const promptInserts = prompts.map(text => ({
      organization_id: orgId,
      text,
      active: true
    }))

    const { error: promptError } = await supabase
      .from('prompts')
      .insert(promptInserts)

    if (promptError) {
      console.error('❌ Failed to create prompts:', promptError.message)
      return
    }

    console.log('\n🎉 Seed completed successfully!')
    console.log(`📋 Organization ID: ${orgId}`)
    console.log(`👤 User ID: ${userId}`)
    console.log(`🏷️  Brand catalog: Acme (with variants: Acme Co, Acme Inc)`)
    console.log(`🤖 Providers: OpenAI, Perplexity (both enabled)`)
    console.log(`💭 Prompts: ${prompts.length} sample prompts created`)

    console.log('\nℹ️  To use this organization:')
    console.log('1. Implement authentication in your app')
    console.log('2. Associate authenticated users with the organization')
    console.log('3. Run the daily-run function to generate initial data')

  } catch (error) {
    console.error('❌ Seed failed:', error)
  }
}

seed()