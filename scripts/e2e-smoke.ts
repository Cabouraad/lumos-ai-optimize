#!/usr/bin/env -S deno run --allow-all

/**
 * E2E Edge Functions Smoke Tests
 * Tests all user-invokable edge functions with synthetic test accounts
 * Usage: deno run --allow-all scripts/e2e-smoke.ts
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = "https://cgocsffxqyhojtyzniyz.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnb2NzZmZ4cXlob2p0eXpuaXl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwNDI1MDksImV4cCI6MjA3MDYxODUwOX0.Rn2lVaTcuu0TEn7S20a_56mkEBkG3_a7CT16CpEfirk";

const TEST_ACCOUNTS = [
  {
    email: 'starter_e2e@test.app',
    password: 'test123456789',
    expectedTier: 'starter'
  },
  {
    email: 'growth_e2e@test.app',
    password: 'test123456789',
    expectedTier: 'growth'
  }
];

interface TestResult {
  function: string;
  user: string;
  success: boolean;
  duration: number;
  error?: string;
  response?: any;
}

class SmokeTestRunner {
  private supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  private results: TestResult[] = [];
  
  async runTest(
    functionName: string,
    user: string,
    testFn: () => Promise<any>,
    expectedSuccess: boolean = true
  ): Promise<TestResult> {
    const startTime = Date.now();
    
    try {
      const response = await testFn();
      const duration = Date.now() - startTime;
      
      const result: TestResult = {
        function: functionName,
        user,
        success: expectedSuccess ? !response.error : !!response.error,
        duration,
        response
      };
      
      if (response.error && expectedSuccess) {
        result.error = response.error.message || JSON.stringify(response.error);
        result.success = false;
      }
      
      this.results.push(result);
      console.log(`${result.success ? '✅' : '❌'} ${functionName} (${user}) - ${duration}ms`);
      
      return result;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      const result: TestResult = {
        function: functionName,
        user,
        success: false,
        duration,
        error: error.message
      };
      
      this.results.push(result);
      console.log(`❌ ${functionName} (${user}) - ${duration}ms - ${error.message}`);
      
      return result;
    }
  }
  
  async authenticateUser(email: string, password: string) {
    console.log(`🔐 Authenticating ${email}...`);
    
    const { data, error } = await this.supabase.auth.signInWithPassword({
      email,
      password
    });
    
    if (error) {
      throw new Error(`Authentication failed for ${email}: ${error.message}`);
    }
    
    console.log(`✅ Authenticated ${email}`);
    return data.session;
  }
  
  async testCheckSubscription(user: string) {
    return this.runTest('check-subscription', user, async () => {
      return await this.supabase.functions.invoke('check-subscription');
    });
  }
  
  async testDiag(user: string) {
    return this.runTest('diag', user, async () => {
      return await this.supabase.functions.invoke('diag');
    });
  }
  
  async testRunPromptNow(user: string) {
    // First get a test prompt
    const { data: prompts } = await this.supabase
      .from('prompts')
      .select('id')
      .limit(1);
    
    if (!prompts || prompts.length === 0) {
      throw new Error('No test prompts available');
    }
    
    return this.runTest('run-prompt-now', user, async () => {
      return await this.supabase.functions.invoke('run-prompt-now', {
        body: { promptId: prompts[0].id }
      });
    });
  }
  
  async testGenerateRecommendations(user: string) {
    return this.runTest('generate-recommendations', user, async () => {
      return await this.supabase.functions.invoke('generate-recommendations');
    });
  }
  
  async testWeeklyReport(user: string, expectedSuccess: boolean = true) {
    return this.runTest('weekly-report', user, async () => {
      return await this.supabase.functions.invoke('weekly-report');
    }, expectedSuccess);
  }
  
  async testReportsSign(user: string, expectedSuccess: boolean = true) {
    return this.runTest('reports-sign', user, async () => {
      // Get a test report first
      const { data: reports } = await this.supabase
        .from('weekly_reports')
        .select('id')
        .eq('status', 'completed')
        .limit(1);
      
      if (!reports || reports.length === 0) {
        // Create a dummy report entry for testing
        const { data: newReport } = await this.supabase
          .from('weekly_reports')
          .insert({
            week_start_date: '2024-01-01',
            week_end_date: '2024-01-07',
            status: 'completed',
            file_path: '/test/dummy-report.pdf'
          })
          .select()
          .single();
        
        if (newReport) {
          return await this.supabase.functions.invoke('reports-sign', {
            body: { reportId: newReport.id }
          });
        }
        
        throw new Error('Could not create test report');
      }
      
      return await this.supabase.functions.invoke('reports-sign', {
        body: { reportId: reports[0].id }
      });
    }, expectedSuccess);
  }
  
  async runAllTests() {
    console.log('🚀 Starting E2E Edge Functions Smoke Tests...');
    
    for (const account of TEST_ACCOUNTS) {
      console.log(`\n📱 Testing with ${account.email} (${account.expectedTier} tier):`);
      
      try {
        // Authenticate
        await this.authenticateUser(account.email, account.password);
        
        // Run basic tests (should work for all tiers)
        await this.testCheckSubscription(account.email);
        await this.testDiag(account.email);
        await this.testRunPromptNow(account.email);
        await this.testGenerateRecommendations(account.email);
        
        // Tier-specific tests
        if (account.expectedTier === 'growth') {
          // Growth tier should access reports
          await this.testWeeklyReport(account.email, true);
          await this.testReportsSign(account.email, true);
        } else {
          // Starter tier should be denied reports access
          await this.testWeeklyReport(account.email, false);
          await this.testReportsSign(account.email, false);
        }
        
      } catch (error) {
        console.error(`❌ Failed testing ${account.email}: ${error.message}`);
        this.results.push({
          function: 'authentication',
          user: account.email,
          success: false,
          duration: 0,
          error: error.message
        });
      }
      
      // Sign out
      await this.supabase.auth.signOut();
    }
  }
  
  printSummary() {
    console.log('\n📊 Test Results Summary:');
    console.log('========================');
    
    const totalTests = this.results.length;
    const successful = this.results.filter(r => r.success).length;
    const failed = this.results.filter(r => !r.success).length;
    
    console.log(`Total Tests: ${totalTests}`);
    console.log(`✅ Passed: ${successful}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📈 Success Rate: ${((successful / totalTests) * 100).toFixed(1)}%`);
    
    if (failed > 0) {
      console.log('\n❌ Failed Tests:');
      this.results
        .filter(r => !r.success)
        .forEach(r => {
          console.log(`  - ${r.function} (${r.user}): ${r.error || 'Unknown error'}`);
        });
    }
    
    // Performance metrics
    const avgDuration = this.results.reduce((sum, r) => sum + r.duration, 0) / totalTests;
    console.log(`\n⏱️  Average Response Time: ${avgDuration.toFixed(0)}ms`);
    
    const slowTests = this.results.filter(r => r.duration > 5000);
    if (slowTests.length > 0) {
      console.log('\n🐌 Slow Tests (>5s):');
      slowTests.forEach(r => {
        console.log(`  - ${r.function} (${r.user}): ${r.duration}ms`);
      });
    }
    
    return { totalTests, successful, failed, avgDuration };
  }
}

async function main() {
  try {
    const runner = new SmokeTestRunner();
    await runner.runAllTests();
    const summary = runner.printSummary();
    
    // Exit with error code if any tests failed
    if (summary.failed > 0) {
      console.log('\n💥 Some tests failed - check the logs above');
      Deno.exit(1);
    } else {
      console.log('\n🎉 All smoke tests passed!');
      Deno.exit(0);
    }
    
  } catch (error) {
    console.error('❌ Smoke test runner failed:', error.message);
    Deno.exit(1);
  }
}

if (import.meta.main) {
  main();
}