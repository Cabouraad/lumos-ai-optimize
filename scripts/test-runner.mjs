#!/usr/bin/env node

/**
 * Test runner script that runs all tests and smoke tests
 */

import { execSync } from 'child_process'

function runCommand(command, description) {
  console.log(`\n🔄 ${description}...`)
  try {
    execSync(command, { stdio: 'inherit' })
    console.log(`✅ ${description} completed successfully`)
    return true
  } catch (error) {
    console.error(`❌ ${description} failed:`, error.message)
    return false
  }
}

async function main() {
  console.log('🧪 Running comprehensive test suite...')
  
  const tests = [
    { cmd: 'npm run test', desc: 'Unit tests' },
    { cmd: 'npm run lint', desc: 'Linting' },
    { cmd: 'node scripts/smoke-test.mjs', desc: 'Smoke tests' }
  ]
  
  let passed = 0
  let failed = 0
  
  for (const test of tests) {
    const success = runCommand(test.cmd, test.desc)
    if (success) {
      passed++
    } else {
      failed++
    }
  }
  
  console.log('\n📊 Test Summary:')
  console.log(`   ✅ Passed: ${passed}`)
  console.log(`   ❌ Failed: ${failed}`)
  
  if (failed === 0) {
    console.log('\n🎉 All tests passed!')
    process.exit(0)
  } else {
    console.log('\n💥 Some tests failed!')
    process.exit(1)
  }
}

main()