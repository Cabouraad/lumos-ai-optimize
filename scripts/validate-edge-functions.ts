#!/usr/bin/env tsx
/**
 * Pre-deploy validation script for Supabase Edge Functions
 * Ensures 1:1 mapping between config.toml entries and function directories
 * Prevents "Entrypoint path does not exist" deployment errors
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';

interface ValidationResult {
  success: boolean;
  errors: string[];
  warnings: string[];
  summary: {
    totalConfigEntries: number;
    totalFunctionDirs: number;
    missingEntrypoints: string[];
    orphanedConfigs: string[];
  };
}

function parseTomlFunctions(configPath: string): string[] {
  try {
    const content = readFileSync(configPath, 'utf-8');
    const functionNames: string[] = [];
    
    // Parse [functions.name] entries, excluding [functions.schedules]
    const functionMatches = content.match(/^\[functions\.([^\]]+)\]$/gm);
    if (functionMatches) {
      for (const match of functionMatches) {
        const name = match.replace(/^\[functions\./, '').replace(/\]$/, '');
        if (name !== 'schedules') {
          functionNames.push(name);
        }
      }
    }
    
    return functionNames;
  } catch (error) {
    throw new Error(`Failed to parse config.toml: ${error}`);
  }
}

function getFunctionDirectories(functionsPath: string): string[] {
  try {
    if (!existsSync(functionsPath)) {
      return [];
    }
    
    return readdirSync(functionsPath)
      .filter(item => {
        const fullPath = join(functionsPath, item);
        return statSync(fullPath).isDirectory() && item !== '_shared';
      });
  } catch (error) {
    throw new Error(`Failed to read functions directory: ${error}`);
  }
}

function validateEdgeFunctions(): ValidationResult {
  const rootPath = resolve(process.cwd());
  const configPath = join(rootPath, 'supabase', 'config.toml');
  const functionsPath = join(rootPath, 'supabase', 'functions');
  
  const result: ValidationResult = {
    success: true,
    errors: [],
    warnings: [],
    summary: {
      totalConfigEntries: 0,
      totalFunctionDirs: 0,
      missingEntrypoints: [],
      orphanedConfigs: []
    }
  };

  // Check if config.toml exists
  if (!existsSync(configPath)) {
    result.success = false;
    result.errors.push('supabase/config.toml not found');
    return result;
  }

  // Check if functions directory exists
  if (!existsSync(functionsPath)) {
    result.success = false;
    result.errors.push('supabase/functions directory not found');
    return result;
  }

  try {
    // Get functions from config and directories
    const configFunctions = parseTomlFunctions(configPath);
    const functionDirs = getFunctionDirectories(functionsPath);
    
    result.summary.totalConfigEntries = configFunctions.length;
    result.summary.totalFunctionDirs = functionDirs.length;

    // Check for missing entrypoints (config entries without corresponding directories)
    for (const functionName of configFunctions) {
      if (!functionDirs.includes(functionName)) {
        result.summary.orphanedConfigs.push(functionName);
        result.errors.push(`Config entry [functions.${functionName}] has no corresponding directory`);
      } else {
        // Check for index.ts file
        const indexPath = join(functionsPath, functionName, 'index.ts');
        if (!existsSync(indexPath)) {
          result.summary.missingEntrypoints.push(functionName);
          result.errors.push(`Function ${functionName} missing index.ts entrypoint`);
        }
      }
    }

    // Check for orphaned directories (directories without config entries)
    for (const dirName of functionDirs) {
      if (!configFunctions.includes(dirName)) {
        result.warnings.push(`Directory ${dirName} has no config.toml entry - will not be deployed`);
      }
    }

    // Set success status
    result.success = result.errors.length === 0;

  } catch (error) {
    result.success = false;
    result.errors.push(`Validation failed: ${error}`);
  }

  return result;
}

function main() {
  console.log('🔍 Validating Supabase Edge Functions...\n');
  
  const result = validateEdgeFunctions();
  
  // Print results
  console.log(`📊 Summary:`);
  console.log(`  • Config entries: ${result.summary.totalConfigEntries}`);
  console.log(`  • Function directories: ${result.summary.totalFunctionDirs}`);
  console.log();

  if (result.errors.length > 0) {
    console.log('❌ Errors:');
    result.errors.forEach(error => console.log(`  • ${error}`));
    console.log();
  }

  if (result.warnings.length > 0) {
    console.log('⚠️  Warnings:');
    result.warnings.forEach(warning => console.log(`  • ${warning}`));
    console.log();
  }

  if (result.success) {
    console.log('✅ All edge functions validated successfully!');
  } else {
    console.log('💥 Edge function validation failed!');
    console.log('\n🛠️  Fix required before deployment:');
    console.log('  • Ensure every [functions.name] in config.toml has supabase/functions/name/index.ts');
    console.log('  • Remove orphaned config entries or create missing directories');
  }

  // Exit with error code if validation failed
  process.exit(result.success ? 0 : 1);
}

if (import.meta.main) {
  main();
}