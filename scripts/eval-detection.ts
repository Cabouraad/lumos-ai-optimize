#!/usr/bin/env -S deno run --allow-all

/**
 * Detection Evaluation Script
 * 
 * Compares current detection results with V2 detection in shadow mode.
 * Outputs CSV summary for analysis.
 * 
 * Usage: deno run --allow-all scripts/eval-detection.ts [--runs=50] [--org-id=uuid]
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { detectBrandsV2, type DetectionInputs, type AccountBrand } from '../src/lib/detect/v2.ts';
import { diffDetections, normalizeDetectionResult, type DetectionResult } from '../src/lib/detect/diagnostics.ts';

const SUPABASE_URL = "https://cgocsffxqyhojtyzniyz.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnb2NzZmZ4cXlob2p0eXpuaXl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwNDI1MDksImV4cCI6MjA3MDYxODUwOX0.Rn2lVaTcuu0TEn7S20a_56mkEBkG3_a7CT16CpEfirk";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

interface RunData {
  id: string;
  prompt_id: string;
  provider: string;
  org_id: string;
  raw_ai_response: string;
  competitors_json: any[];
  brands_json?: any[];
  run_at: string;
  score: number;
  org_brand_present: boolean;
}

interface OrgData {
  id: string;
  name: string;
  domain: string;
  keywords: string[];
  competitors: string[];
}

async function parseArgs() {
  const args = Deno.args;
  let runs = 50;
  let orgId: string | null = null;

  for (const arg of args) {
    if (arg.startsWith('--runs=')) {
      runs = parseInt(arg.split('=')[1]) || 50;
    } else if (arg.startsWith('--org-id=')) {
      orgId = arg.split('=')[1];
    }
  }

  return { runs, orgId };
}

async function fetchRecentRuns(runs: number, orgId?: string): Promise<RunData[]> {
  const query = supabase
    .from('prompt_provider_responses')
    .select(`
      id,
      prompt_id,
      provider,
      org_id,
      raw_ai_response,
      competitors_json,
      brands_json,
      run_at,
      score,
      org_brand_present
    `)
    .eq('status', 'success')
    .not('raw_ai_response', 'is', null)
    .order('run_at', { ascending: false });

  if (orgId) {
    query.eq('org_id', orgId);
  }

  const { data, error } = await query.limit(runs);

  if (error) {
    throw new Error(`Failed to fetch runs: ${error.message}`);
  }

  return data || [];
}

async function fetchOrgData(orgId: string): Promise<OrgData | null> {
  const { data, error } = await supabase
    .from('organizations')
    .select('id, name, domain, keywords, competitors')
    .eq('id', orgId)
    .single();

  if (error) {
    console.error(`Failed to fetch org ${orgId}:`, error.message);
    return null;
  }

  return data;
}

async function fetchCompetitorsSeed(orgId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('brand_catalog')
    .select('name')
    .eq('org_id', orgId)
    .eq('is_org_brand', false);

  if (error) {
    console.error(`Failed to fetch competitors for org ${orgId}:`, error.message);
    return [];
  }

  return data?.map(item => item.name) || [];
}

function createAccountBrand(orgData: OrgData): AccountBrand {
  const aliases = [orgData.name];
  
  // Add variations based on domain
  if (orgData.domain) {
    const domainName = orgData.domain.replace(/\.(com|org|net|io|co)$/i, '');
    aliases.push(domainName);
    
    // Add title case version
    const titleCase = domainName.charAt(0).toUpperCase() + domainName.slice(1);
    if (!aliases.includes(titleCase)) {
      aliases.push(titleCase);
    }
  }

  return {
    canonical: orgData.name,
    aliases: [...new Set(aliases)],
    domain: orgData.domain || undefined
  };
}

function arrayToString(arr: string[]): string {
  if (!arr || arr.length === 0) return '';
  return `"${arr.join('; ')}"`;
}

function escapeCSV(value: string | number): string {
  if (typeof value === 'number') return value.toString();
  if (!value) return '';
  
  const str = value.toString();
  if (str.includes('"') || str.includes(',') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

async function main() {
  const { runs, orgId } = await parseArgs();
  
  console.error(`🔍 Evaluating last ${runs} runs${orgId ? ` for org ${orgId}` : ' across all orgs'}...`);
  
  // Fetch recent runs
  const runData = await fetchRecentRuns(runs, orgId);
  console.error(`📊 Found ${runData.length} runs to evaluate`);
  
  // Print CSV header
  console.log('runId,provider,orgId,currentBrands,v2Brands,currentCompetitors,v2Competitors,brandAdds,brandDrops,competitorAdds,competitorDrops,textSample');
  
  // Cache for org data to avoid repeated fetches
  const orgCache = new Map<string, { orgData: OrgData; accountBrand: AccountBrand; competitorsSeed: string[] }>();
  
  for (const run of runData) {
    try {
      // Get org data (cached)
      let orgInfo = orgCache.get(run.org_id);
      if (!orgInfo) {
        const orgData = await fetchOrgData(run.org_id);
        if (!orgData) {
          console.error(`⚠️  Skipping run ${run.id}: org data not found`);
          continue;
        }
        
        const accountBrand = createAccountBrand(orgData);
        const competitorsSeed = await fetchCompetitorsSeed(run.org_id);
        
        orgInfo = { orgData, accountBrand, competitorsSeed };
        orgCache.set(run.org_id, orgInfo);
      }
      
      // Current detection results
      const current: DetectionResult = normalizeDetectionResult({
        brands: run.brands_json || [],
        competitors: run.competitors_json || []
      });
      
      // V2 detection
      const inputs: DetectionInputs = {
        rawText: run.raw_ai_response,
        provider: run.provider,
        accountBrand: orgInfo.accountBrand,
        competitorsSeed: orgInfo.competitorsSeed
      };
      
      const v2Result = detectBrandsV2(inputs);
      const proposed: DetectionResult = {
        brands: v2Result.detectedBrands,
        competitors: v2Result.detectedCompetitors
      };
      
      // Compute differences
      const diffs = diffDetections(current, proposed);
      
      // Text sample (first 200 chars)
      const textSample = run.raw_ai_response.substring(0, 200).replace(/[\r\n]+/g, ' ').trim();
      
      // Output CSV row
      const row = [
        escapeCSV(run.id),
        escapeCSV(run.provider),
        escapeCSV(run.org_id),
        arrayToString(current.brands),
        arrayToString(proposed.brands),
        arrayToString(current.competitors),
        arrayToString(proposed.competitors),
        diffs.brandAdds.length,
        diffs.brandDrops.length,
        diffs.competitorAdds.length,
        diffs.competitorDrops.length,
        escapeCSV(textSample)
      ].join(',');
      
      console.log(row);
      
    } catch (error) {
      console.error(`❌ Error processing run ${run.id}:`, error.message);
      continue;
    }
  }
  
  console.error(`✅ Evaluation complete. Processed ${runData.length} runs.`);
}

if (import.meta.main) {
  main().catch(error => {
    console.error('❌ Script failed:', error);
    Deno.exit(1);
  });
}