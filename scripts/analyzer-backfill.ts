/**
 * V2 Analyzer Backfill Script
 * Re-runs analysis for specified time window using V2 analyzer
 */

import { createClient } from '@supabase/supabase-js';
import { analyzeResponseV2, type AnalyzerV2Context } from '../lib/brand/analyzer-v2.ts';

interface BackfillOptions {
  org_id?: string;
  days?: number;
  flag?: 'useV2';
  dryRun?: boolean;
  batchSize?: number;
  verbose?: boolean;
}

interface BackfillStats {
  processed: number;
  updated: number;
  errors: number;
  skipped: number;
  startTime: Date;
  endTime?: Date;
}

class AnalyzerBackfill {
  private supabase;
  private stats: BackfillStats;

  constructor() {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.stats = {
      processed: 0,
      updated: 0,
      errors: 0,
      skipped: 0,
      startTime: new Date()
    };
  }

  async run(options: BackfillOptions = {}): Promise<BackfillStats> {
    const {
      org_id,
      days = 7,
      flag = 'useV2',
      dryRun = true,
      batchSize = 100,
      verbose = false
    } = options;

    console.log('🔄 Starting V2 Analyzer Backfill');
    console.log(`📊 Configuration:`);
    console.log(`   - Org ID: ${org_id || 'ALL'}`);
    console.log(`   - Days: ${days}`);
    console.log(`   - Flag: ${flag}`);
    console.log(`   - Dry Run: ${dryRun}`);
    console.log(`   - Batch Size: ${batchSize}`);
    console.log('');

    try {
      // Step 1: Fetch responses to re-analyze
      const responses = await this.fetchResponsesForBackfill(org_id, days);
      console.log(`📋 Found ${responses.length} responses to process`);

      if (responses.length === 0) {
        console.log('✅ No responses found in the specified time window');
        return this.finalizeStats();
      }

      // Step 2: Process in batches
      for (let i = 0; i < responses.length; i += batchSize) {
        const batch = responses.slice(i, i + batchSize);
        console.log(`\n🔄 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(responses.length / batchSize)}`);
        
        await this.processBatch(batch, dryRun, verbose);
        
        // Rate limiting pause
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      return this.finalizeStats();
    } catch (error) {
      console.error('❌ Backfill failed:', error);
      throw error;
    }
  }

  private async fetchResponsesForBackfill(org_id?: string, days: number = 7) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    let query = this.supabase
      .from('prompt_provider_responses')
      .select(`
        id,
        org_id,
        prompt_id,
        provider,
        raw_ai_response,
        status,
        run_at,
        score,
        org_brand_present,
        competitors_json,
        brands_json,
        metadata
      `)
      .eq('status', 'success')
      .gte('run_at', cutoffDate.toISOString())
      .not('raw_ai_response', 'is', null)
      .order('run_at', { ascending: false });

    if (org_id) {
      query = query.eq('org_id', org_id);
    }

    const { data, error } = await query;
    if (error) throw error;

    return data || [];
  }

  private async processBatch(responses: any[], dryRun: boolean, verbose: boolean) {
    const batchPromises = responses.map(response => 
      this.processResponse(response, dryRun, verbose)
    );

    await Promise.allSettled(batchPromises);
  }

  private async processResponse(response: any, dryRun: boolean, verbose: boolean) {
    this.stats.processed++;
    
    try {
      // Fetch org and brand catalog data
      const context = await this.buildAnalysisContext(response.org_id, response.prompt_id);
      if (!context) {
        this.stats.skipped++;
        if (verbose) console.log(`   ⏭️  Skipped response ${response.id} - missing context`);
        return;
      }

      // Run V2 analysis
      const v2Result = await analyzeResponseV2(response.raw_ai_response, context);

      // Compare with existing results
      const hasChanged = this.hasSignificantChanges(response, v2Result);
      
      if (!hasChanged) {
        this.stats.skipped++;
        if (verbose) console.log(`   ⏭️  Skipped response ${response.id} - no significant changes`);
        return;
      }

      if (dryRun) {
        console.log(`   🔍 DRY RUN - Would update response ${response.id}:`);
        this.logDifferences(response, v2Result);
      } else {
        // Update database with V2 results
        await this.updateResponse(response.id, v2Result);
        this.stats.updated++;
        if (verbose) console.log(`   ✅ Updated response ${response.id}`);
      }
    } catch (error) {
      this.stats.errors++;
      console.error(`   ❌ Error processing response ${response.id}:`, error);
    }
  }

  private async buildAnalysisContext(org_id: string, prompt_id: string): Promise<AnalyzerV2Context | null> {
    try {
      // Fetch org data
      const { data: orgData, error: orgError } = await this.supabase
        .from('organizations')
        .select('name, domain, keywords, competitors, products_services')
        .eq('id', org_id)
        .single();

      if (orgError) throw orgError;

      // Fetch brand catalog
      const { data: brandCatalog, error: brandError } = await this.supabase
        .from('brand_catalog')
        .select('name, is_org_brand, variants_json')
        .eq('org_id', org_id);

      if (brandError) throw brandError;

      // Fetch recent competitors for consensus
      const { data: recentCompetitors, error: competitorError } = await this.supabase
        .from('prompt_provider_responses')
        .select('competitors_json')
        .eq('prompt_id', prompt_id)
        .gte('run_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24h
        .not('competitors_json', 'is', null);

      const allRecentCompetitors = recentCompetitors?.flatMap(r => 
        Array.isArray(r.competitors_json) ? r.competitors_json : []
      ) || [];

      return {
        orgData: {
          name: orgData.name,
          domain: orgData.domain,
          keywords: orgData.keywords,
          competitors: orgData.competitors,
          products_services: orgData.products_services
        },
        brandCatalog: brandCatalog || [],
        crossProviderContext: {
          prompt_id,
          recent_competitors: [...new Set(allRecentCompetitors)]
        }
      };
    } catch (error) {
      console.error(`Error building context for org ${org_id}:`, error);
      return null;
    }
  }

  private hasSignificantChanges(originalResponse: any, v2Result: any): boolean {
    // Check if brand detection changed
    if (originalResponse.org_brand_present !== v2Result.org_brand_present) {
      return true;
    }

    // Check if competitor count changed significantly (>20%)
    const originalCount = originalResponse.competitors_json?.length || 0;
    const newCount = v2Result.competitors_json.length;
    const changePercent = Math.abs(originalCount - newCount) / Math.max(originalCount, 1);
    
    if (changePercent > 0.2) {
      return true;
    }

    // Check if score changed significantly (>1 point)
    const scoreDiff = Math.abs(originalResponse.score - v2Result.score);
    if (scoreDiff > 1.0) {
      return true;
    }

    return false;
  }

  private logDifferences(original: any, v2Result: any) {
    console.log(`     Brand Present: ${original.org_brand_present} → ${v2Result.org_brand_present}`);
    console.log(`     Score: ${original.score} → ${v2Result.score}`);
    console.log(`     Competitors: ${original.competitors_json?.length || 0} → ${v2Result.competitors_json.length}`);
    
    // Show competitor differences
    const originalCompetitors = new Set(original.competitors_json || []);
    const newCompetitors = new Set(v2Result.competitors_json);
    
    const added = [...newCompetitors].filter(c => !originalCompetitors.has(c));
    const removed = [...originalCompetitors].filter(c => !newCompetitors.has(c));
    
    if (added.length > 0) {
      console.log(`     Added: ${added.join(', ')}`);
    }
    if (removed.length > 0) {
      console.log(`     Removed: ${removed.join(', ')}`);
    }
  }

  private async updateResponse(responseId: string, v2Result: any) {
    const { error } = await this.supabase
      .from('prompt_provider_responses')
      .update({
        org_brand_present: v2Result.org_brand_present,
        org_brand_prominence: v2Result.org_brand_prominence,
        competitors_json: v2Result.competitors_json,
        brands_json: v2Result.brands_json,
        score: v2Result.score,
        metadata: {
          ...v2Result.metadata,
          backfilled_at: new Date().toISOString(),
          backfill_version: 'v2.0'
        }
      })
      .eq('id', responseId);

    if (error) throw error;
  }

  private finalizeStats(): BackfillStats {
    this.stats.endTime = new Date();
    const duration = this.stats.endTime.getTime() - this.stats.startTime.getTime();
    
    console.log('\n📊 Backfill Summary:');
    console.log(`   ✅ Processed: ${this.stats.processed}`);
    console.log(`   🔄 Updated: ${this.stats.updated}`);
    console.log(`   ⏭️  Skipped: ${this.stats.skipped}`);
    console.log(`   ❌ Errors: ${this.stats.errors}`);
    console.log(`   ⏱️  Duration: ${Math.round(duration / 1000)}s`);
    
    return this.stats;
  }
}

// CLI execution
if (import.meta.main) {
  const args = Deno.args;
  const options: BackfillOptions = {};

  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--org-id':
        options.org_id = args[++i];
        break;
      case '--days':
        options.days = parseInt(args[++i]) || 7;
        break;
      case '--flag':
        options.flag = args[++i] as 'useV2';
        break;
      case '--dry-run':
        options.dryRun = args[++i]?.toLowerCase() !== 'false';
        break;
      case '--batch-size':
        options.batchSize = parseInt(args[++i]) || 100;
        break;
      case '--verbose':
        options.verbose = true;
        break;
      case '--help':
        console.log(`
V2 Analyzer Backfill Script

Usage: deno run --allow-net --allow-env scripts/analyzer-backfill.ts [options]

Options:
  --org-id <id>       Target specific organization (default: all)
  --days <number>     Days to look back (default: 7)
  --flag <flag>       Feature flag to use (default: useV2)
  --dry-run <bool>    Dry run mode (default: true)
  --batch-size <num>  Batch size for processing (default: 100)
  --verbose           Enable verbose output
  --help              Show this help

Examples:
  # Dry run for last 7 days
  deno run --allow-net --allow-env scripts/analyzer-backfill.ts

  # Actual backfill for specific org, last 30 days
  deno run --allow-net --allow-env scripts/analyzer-backfill.ts --org-id abc-123 --days 30 --dry-run false

  # Verbose dry run for last 3 days
  deno run --allow-net --allow-env scripts/analyzer-backfill.ts --days 3 --verbose
        `);
        Deno.exit(0);
    }
  }

  try {
    const backfill = new AnalyzerBackfill();
    await backfill.run(options);
  } catch (error) {
    console.error('❌ Backfill failed:', error);
    Deno.exit(1);
  }
}