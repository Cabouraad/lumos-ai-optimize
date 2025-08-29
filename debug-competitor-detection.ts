#!/usr/bin/env -S deno run --allow-all

/**
 * Debug Script for Competitor Detection Pipeline
 * 
 * Usage: deno run --allow-all debug-competitor-detection.ts
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { EnhancedCompetitorDetector } from './supabase/functions/_shared/enhanced-competitor-detector.ts';

// Test cases from user requirements
const TEST_CASES = [
  {
    name: "Known Competitors",
    text: "HubSpot and Salesforce are top alternatives.",
    expected: ["HubSpot", "Salesforce"]
  },
  {
    name: "Generic Words Only", 
    text: "Using an all-in-one customer platform improves experience.",
    expected: []
  },
  {
    name: "Compound Names",
    text: "Zoho CRM and Freshworks are gaining traction.",
    expected: ["Zoho CRM", "Freshworks"]
  },
  {
    name: "Stopwords Only",
    text: "While making decisions, user experience is important.",
    expected: []
  },
  {
    name: "Mixed Valid/Invalid",
    text: "Marketing Automation platforms like HubSpot help customer data management.",
    expected: ["HubSpot"]
  },
  {
    name: "User Reported Issues",
    text: "Choose the best Marketing Automation solution for your customer data needs.",
    expected: []
  }
];

async function debugDetectionPipeline() {
  console.log('🔍 Starting Competitor Detection Pipeline Debug\n');
  
  // Mock Supabase client for testing
  const mockSupabase = {
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          single: () => ({ data: null })
        })
      })
    })
  };
  
  const detector = new EnhancedCompetitorDetector(mockSupabase);
  
  // Test each case
  for (const [index, testCase] of TEST_CASES.entries()) {
    console.log(`\n📋 Test ${index + 1}: ${testCase.name}`);
    console.log(`📝 Input: "${testCase.text}"`);
    console.log(`🎯 Expected: [${testCase.expected.join(', ')}]`);
    console.log('─'.repeat(60));
    
    try {
      // Use a test org ID
      const testOrgId = '00000000-0000-0000-0000-000000000000';
      
      const result = await detector.detectCompetitors(
        testCase.text,
        testOrgId,
        { useNERFallback: false } // Disable NER to test regex/gazetteer only
      );
      
      const detectedNames = result.competitors.map(c => c.name);
      
      console.log(`🔍 Raw Candidates: ${result.metadata.total_candidates}`);
      console.log(`✅ Valid Competitors: [${detectedNames.join(', ')}]`);
      console.log(`❌ Rejected Terms: [${result.rejectedTerms.slice(0, 5).join(', ')}${result.rejectedTerms.length > 5 ? '...' : ''}]`);
      
      // Check if matches expected
      const matches = detectedNames.length === testCase.expected.length &&
                     detectedNames.every(name => testCase.expected.includes(name));
      
      console.log(`🏆 Result: ${matches ? '✅ PASS' : '❌ FAIL'}`);
      
      if (!matches) {
        console.log(`   Expected: [${testCase.expected.join(', ')}]`);
        console.log(`   Got:      [${detectedNames.join(', ')}]`);
      }
      
    } catch (error) {
      console.log(`💥 Error: ${error.message}`);
    }
  }
}

// Database debugging function
async function debugDatabaseQueries() {
  console.log('\n\n🗄️  Database Query Debug\n');
  
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  
  if (!supabaseUrl || !supabaseKey) {
    console.log('❌ Missing Supabase environment variables');
    return;
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  try {
    // Test the problematic RPC function
    console.log('📞 Testing get_prompt_competitors RPC...');
    
    const { data, error } = await supabase
      .rpc('get_prompt_competitors', { 
        p_prompt_id: '8d8018e5-f279-470e-ab6b-d137f153d8bd', // From console logs
        p_days: 30 
      });
    
    if (error) {
      console.log(`❌ RPC Error: ${error.message}`);
      console.log(`   Code: ${error.code}`);
      console.log(`   Details: ${error.details}`);
    } else {
      console.log(`✅ RPC Success: ${data?.length || 0} competitors returned`);
      if (data && data.length > 0) {
        console.log('   Sample:', data.slice(0, 3));
      }
    }
    
    // Check latest prompt_runs data
    console.log('\n📊 Checking prompt_runs data...');
    const { data: runs, error: runsError } = await supabase
      .from('prompt_runs')
      .select('id, competitors, created_at')
      .order('created_at', { ascending: false })
      .limit(3);
    
    if (runsError) {
      console.log(`❌ Query Error: ${runsError.message}`);
    } else {
      console.log(`✅ Found ${runs?.length || 0} recent runs`);
      runs?.forEach((run, index) => {
        console.log(`   Run ${index + 1}: ${run.competitors?.length || 0} competitors - ${run.created_at}`);
        if (run.competitors) {
          console.log(`      Competitors: [${run.competitors.slice(0, 3).map((c: any) => c.name || c).join(', ')}...]`);
        }
      });
    }
    
  } catch (error) {
    console.log(`💥 Database Error: ${error.message}`);
  }
}

// Main execution
async function main() {
  console.log('🚀 Competitor Detection Debug Script');
  console.log('=' .repeat(50));
  
  // Run detection pipeline tests
  await debugDetectionPipeline();
  
  // Run database tests
  await debugDatabaseQueries();
  
  console.log('\n✅ Debug Complete - Check COMPETITOR_DETECTION_AUDIT_REPORT.md for analysis');
}

if (import.meta.main) {
  main().catch(console.error);
}