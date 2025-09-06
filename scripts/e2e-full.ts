#!/usr/bin/env -S deno run --allow-all

/**
 * Complete E2E Test Runner
 * Runs the full E2E test suite: seed → playwright → smoke → cleanup
 * Usage: deno run --allow-all scripts/e2e-full.ts [--keep-data]
 */

async function runCommand(command: string, description: string): Promise<boolean> {
  console.log(`\n🔄 ${description}...`);
  
  try {
    const process = new Deno.Command(command.split(' ')[0], {
      args: command.split(' ').slice(1),
      stdout: 'inherit',
      stderr: 'inherit'
    });
    
    const { success } = await process.output();
    
    if (success) {
      console.log(`✅ ${description} completed successfully`);
      return true;
    } else {
      console.error(`❌ ${description} failed`);
      return false;
    }
    
  } catch (error) {
    console.error(`❌ ${description} failed:`, error.message);
    return false;
  }
}

async function main() {
  const keepData = Deno.args.includes('--keep-data');
  
  console.log('🚀 Starting Complete E2E Test Suite...');
  console.log(`Data cleanup: ${keepData ? 'Disabled' : 'Enabled'}`);
  
  const testSteps = [
    {
      command: 'deno run --allow-all scripts/e2e-seed.ts',
      description: 'Seeding test data',
      required: true
    },
    {
      command: 'npx playwright test',
      description: 'Running Playwright E2E tests',
      required: true
    },
    {
      command: 'deno run --allow-all scripts/e2e-smoke.ts',
      description: 'Running edge function smoke tests',
      required: true
    }
  ];
  
  let totalPassed = 0;
  let totalFailed = 0;
  
  // Run test steps
  for (const step of testSteps) {
    const success = await runCommand(step.command, step.description);
    
    if (success) {
      totalPassed++;
    } else {
      totalFailed++;
      
      if (step.required) {
        console.log(`💥 Required step failed: ${step.description}`);
        break;
      }
    }
  }
  
  // Cleanup (unless --keep-data flag is used)
  if (!keepData) {
    console.log('\n🧹 Cleaning up test data...');
    await runCommand('deno run --allow-all scripts/e2e-clean.ts', 'Cleaning test data');
  } else {
    console.log('\n📝 Test data preserved (--keep-data flag used)');
  }
  
  // Summary
  console.log('\n📊 E2E Test Suite Summary:');
  console.log('==========================');
  console.log(`✅ Passed: ${totalPassed}`);
  console.log(`❌ Failed: ${totalFailed}`);
  console.log(`📈 Success Rate: ${((totalPassed / (totalPassed + totalFailed)) * 100).toFixed(1)}%`);
  
  if (totalFailed === 0) {
    console.log('\n🎉 All E2E tests passed! Your app is ready for production.');
    Deno.exit(0);
  } else {
    console.log('\n💥 Some E2E tests failed. Check the logs above for details.');
    Deno.exit(1);
  }
}

if (import.meta.main) {
  main();
}
