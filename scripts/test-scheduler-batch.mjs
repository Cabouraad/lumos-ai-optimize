#!/usr/bin/env node

/**
 * Comprehensive test for scheduler-triggered batch processing
 * 
 * This script:
 * 1. Triggers the daily-batch-trigger (simulating scheduler)
 * 2. Monitors all batch jobs until completion
 * 3. Verifies 100% task completion
 * 4. Reports any failures or issues
 * 
 * Usage: CRON_SECRET="your_secret" node scripts/test-scheduler-batch.mjs [options]
 * 
 * Options:
 *   --force        Force run even if already ran today
 *   --monitor      Monitor jobs until completion (default: true)
 *   --timeout      Max monitoring time in minutes (default: 60)
 *   --help         Show help
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://cgocsffxqyhojtyzniyz.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ Please set SUPABASE_SERVICE_ROLE_KEY environment variable');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  force: args.includes('--force'),
  monitor: !args.includes('--no-monitor'),
  timeout: parseInt(args.find(arg => arg.startsWith('--timeout='))?.split('=')[1] || '60'),
  help: args.includes('--help')
};

if (options.help) {
  console.log(`
Scheduler Batch Processor Test Script

Usage: CRON_SECRET="your_secret" node scripts/test-scheduler-batch.mjs [options]

Options:
  --force           Force run even if already ran today
  --no-monitor      Don't monitor jobs (just trigger and exit)
  --timeout=N       Max monitoring time in minutes (default: 60)
  --help            Show this help message

Environment Variables:
  SUPABASE_SERVICE_ROLE_KEY  Required: Service role key
  CRON_SECRET                Required: Cron secret from app_settings

Examples:
  # Trigger and monitor until completion
  CRON_SECRET="xxx" node scripts/test-scheduler-batch.mjs
  
  # Force run and monitor for 2 hours
  CRON_SECRET="xxx" node scripts/test-scheduler-batch.mjs --force --timeout=120
  
  # Just trigger without monitoring
  CRON_SECRET="xxx" node scripts/test-scheduler-batch.mjs --no-monitor
`);
  process.exit(0);
}

// Get cron secret from environment or database
async function getCronSecret() {
  const envSecret = process.env.CRON_SECRET;
  if (envSecret) return envSecret;
  
  console.log('🔑 Fetching cron secret from database...');
  const { data, error } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'cron_secret')
    .single();
  
  if (error || !data) {
    throw new Error('Could not fetch cron secret. Please set CRON_SECRET environment variable.');
  }
  
  return data.value;
}

// Trigger the daily batch
async function triggerBatch(cronSecret) {
  console.log('\n🚀 Triggering daily-batch-trigger...');
  console.log(`   Force: ${options.force}`);
  
  const requestBody = {
    trigger_source: 'test-script',
    force: options.force
  };
  
  const response = await fetch(`${SUPABASE_URL}/functions/v1/daily-batch-trigger`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      'x-cron-secret': cronSecret
    },
    body: JSON.stringify(requestBody)
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to trigger batch: ${response.status} ${error}`);
  }
  
  const data = await response.json();
  return data;
}

// Get all batch jobs created by the trigger
async function getBatchJobs(orgIds) {
  const { data, error } = await supabase
    .from('batch_jobs')
    .select('*')
    .in('org_id', orgIds)
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data || [];
}

// Monitor a single job's progress
async function monitorJob(jobId, orgName) {
  const { data, error } = await supabase
    .from('batch_jobs')
    .select('*')
    .eq('id', jobId)
    .single();
  
  if (error) return null;
  return data;
}

// Pretty print job status
function formatJobStatus(job) {
  const total = job.total_tasks;
  const completed = job.completed_tasks;
  const failed = job.failed_tasks;
  const remaining = total - completed - failed;
  const progress = total > 0 ? Math.round(((completed + failed) / total) * 100) : 0;
  
  const statusEmoji = {
    'pending': '⏳',
    'processing': '🔄',
    'completed': '✅',
    'failed': '❌',
    'cancelled': '🚫'
  }[job.status] || '❓';
  
  return {
    emoji: statusEmoji,
    status: job.status,
    progress: `${progress}%`,
    completed,
    failed,
    remaining,
    total,
    isComplete: job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled'
  };
}

// Monitor all jobs until completion
async function monitorJobs(jobs, timeoutMinutes) {
  console.log(`\n📊 Monitoring ${jobs.length} batch jobs (timeout: ${timeoutMinutes} minutes)...`);
  
  const startTime = Date.now();
  const timeoutMs = timeoutMinutes * 60 * 1000;
  const jobMap = new Map(jobs.map(j => [j.id, j]));
  
  let allComplete = false;
  let iteration = 0;
  
  while (!allComplete && (Date.now() - startTime) < timeoutMs) {
    iteration++;
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    
    console.log(`\n⏱️  Iteration ${iteration} (elapsed: ${elapsed}s)`);
    console.log('─'.repeat(80));
    
    let completedCount = 0;
    let processingCount = 0;
    let failedCount = 0;
    let totalTasks = 0;
    let totalCompleted = 0;
    let totalFailed = 0;
    
    for (const [jobId, originalJob] of jobMap.entries()) {
      const job = await monitorJob(jobId);
      
      if (!job) {
        console.log(`  ⚠️  Job ${jobId} not found`);
        continue;
      }
      
      jobMap.set(jobId, job);
      const status = formatJobStatus(job);
      
      // Get org name from original job or fetch it
      const { data: orgData } = await supabase
        .from('organizations')
        .select('name')
        .eq('id', job.org_id)
        .single();
      
      const orgName = orgData?.name || job.org_id;
      
      console.log(`  ${status.emoji} ${orgName.padEnd(30)} | ${status.status.padEnd(10)} | ${status.progress.padStart(4)} | ${status.completed}/${status.total} completed, ${status.failed} failed, ${status.remaining} remaining`);
      
      // Track metadata
      if (job.metadata?.driver_active) {
        const driverRuns = job.metadata.driver_runs || 0;
        const lastPing = job.metadata.driver_last_ping ? new Date(job.metadata.driver_last_ping) : null;
        const pingAge = lastPing ? Math.round((Date.now() - lastPing.getTime()) / 1000) : null;
        console.log(`     🔄 Driver active: ${driverRuns} runs, last ping ${pingAge}s ago`);
      }
      
      totalTasks += status.total;
      totalCompleted += status.completed;
      totalFailed += status.failed;
      
      if (status.isComplete) {
        if (job.status === 'completed') completedCount++;
        if (job.status === 'failed') failedCount++;
      } else {
        processingCount++;
      }
    }
    
    console.log('─'.repeat(80));
    console.log(`  Summary: ${completedCount} completed, ${processingCount} processing, ${failedCount} failed`);
    console.log(`  Overall: ${totalCompleted + totalFailed}/${totalTasks} tasks (${totalCompleted} completed, ${totalFailed} failed)`);
    
    if (processingCount === 0) {
      allComplete = true;
      console.log('\n✅ All jobs complete!');
      break;
    }
    
    // Wait before next iteration
    await new Promise(resolve => setTimeout(resolve, 10000)); // Check every 10 seconds
  }
  
  if (!allComplete) {
    console.log('\n⚠️  Monitoring timeout reached');
  }
  
  // Final summary
  console.log('\n' + '='.repeat(80));
  console.log('FINAL RESULTS');
  console.log('='.repeat(80));
  
  let allTasksCompleted = true;
  
  for (const [jobId, job] of jobMap.entries()) {
    const status = formatJobStatus(job);
    
    const { data: orgData } = await supabase
      .from('organizations')
      .select('name')
      .eq('id', job.org_id)
      .single();
    
    const orgName = orgData?.name || job.org_id;
    
    console.log(`\n${status.emoji} ${orgName}`);
    console.log(`   Status: ${job.status}`);
    console.log(`   Progress: ${status.completed + status.failed}/${status.total} (${status.progress})`);
    console.log(`   Completed: ${status.completed}`);
    console.log(`   Failed: ${status.failed}`);
    console.log(`   Remaining: ${status.remaining}`);
    
    if (status.remaining > 0) {
      console.log(`   ❌ INCOMPLETE: ${status.remaining} tasks not processed`);
      allTasksCompleted = false;
    }
    
    if (job.error_message) {
      console.log(`   Error: ${job.error_message}`);
    }
  }
  
  console.log('\n' + '='.repeat(80));
  
  if (allTasksCompleted) {
    console.log('✅ SUCCESS: All tasks completed across all organizations');
    return true;
  } else {
    console.log('❌ FAILURE: Some tasks remain incomplete');
    return false;
  }
}

// Main test function
async function runTest() {
  console.log('🧪 Scheduler Batch Processor Test');
  console.log('Started at:', new Date().toISOString());
  console.log('Options:', options);
  
  try {
    // Get cron secret
    const cronSecret = await getCronSecret();
    console.log('✅ Cron secret obtained');
    
    // Trigger the batch
    const triggerResult = await triggerBatch(cronSecret);
    
    console.log('\n✅ Batch triggered successfully!');
    console.log('\n📊 Trigger Summary:');
    console.log(`   Success: ${triggerResult.success}`);
    console.log(`   Total Orgs: ${triggerResult.totalOrgs}`);
    console.log(`   Successful Jobs: ${triggerResult.successfulJobs}`);
    console.log(`   Failed Jobs: ${triggerResult.failedJobs}`);
    console.log(`   Date: ${triggerResult.date}`);
    
    if (triggerResult.orgResults && triggerResult.orgResults.length > 0) {
      console.log('\n📋 Organization Results:');
      triggerResult.orgResults.forEach((result, index) => {
        const emoji = result.success ? '✅' : '❌';
        console.log(`   ${index + 1}. ${emoji} ${result.orgName}`);
        console.log(`      Job ID: ${result.batchJobId || 'N/A'}`);
        console.log(`      Action: ${result.action || 'N/A'}`);
        console.log(`      Driver Started: ${result.driverStarted ? 'Yes' : 'No'}`);
        if (result.error) {
          console.log(`      Error: ${result.error}`);
        }
      });
    }
    
    if (!options.monitor) {
      console.log('\n✅ Trigger successful. Skipping monitoring (--no-monitor flag)');
      process.exit(0);
    }
    
    // Get batch jobs
    const orgIds = triggerResult.orgResults?.map(r => r.orgId).filter(Boolean) || [];
    
    if (orgIds.length === 0) {
      console.log('\n⚠️  No batch jobs to monitor');
      process.exit(0);
    }
    
    const jobs = await getBatchJobs(orgIds);
    console.log(`\n✅ Found ${jobs.length} batch jobs to monitor`);
    
    // Monitor until completion
    const success = await monitorJobs(jobs, options.timeout);
    
    console.log('\n🏁 Test completed at:', new Date().toISOString());
    
    process.exit(success ? 0 : 1);
    
  } catch (error) {
    console.error('\n💥 Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

runTest();
