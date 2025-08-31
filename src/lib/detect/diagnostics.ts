/**
 * Detection Diagnostics Module
 * Shadow mode analysis for brand/competitor detection changes
 */

import { detectBrandsV2, type DetectionInputs, type AccountBrand } from './v2.ts';

export interface DetectionResult {
  brands: string[];
  competitors: string[];
}

export interface DetectionDiff {
  brandAdds: string[];
  brandDrops: string[];
  competitorAdds: string[];
  competitorDrops: string[];
}

export interface LogContext {
  provider: string;
  promptId: string;
  runId: string;
  method?: string;
  timestamp?: string;
}

/**
 * Compare two detection results and return differences
 */
export function diffDetections(
  current: DetectionResult,
  proposed: DetectionResult
): DetectionDiff {
  const currentBrands = new Set(current.brands || []);
  const proposedBrands = new Set(proposed.brands || []);
  const currentCompetitors = new Set(current.competitors || []);
  const proposedCompetitors = new Set(proposed.competitors || []);

  // Calculate brand differences
  const brandAdds = Array.from(proposedBrands).filter(brand => !currentBrands.has(brand));
  const brandDrops = Array.from(currentBrands).filter(brand => !proposedBrands.has(brand));

  // Calculate competitor differences
  const competitorAdds = Array.from(proposedCompetitors).filter(comp => !currentCompetitors.has(comp));
  const competitorDrops = Array.from(currentCompetitors).filter(comp => !proposedCompetitors.has(comp));

  return {
    brandAdds,
    brandDrops,
    competitorAdds,
    competitorDrops
  };
}

/**
 * Log detection differences as single-line JSON for analysis
 */
export function logDetections(
  context: LogContext,
  diffs: DetectionDiff,
  sample?: {
    responseLength?: number;
    confidence?: number;
    metadata?: Record<string, any>;
  }
): void {
  const hasChanges = diffs.brandAdds.length > 0 || 
                    diffs.brandDrops.length > 0 || 
                    diffs.competitorAdds.length > 0 || 
                    diffs.competitorDrops.length > 0;

  const logEntry = {
    type: 'detection_shadow',
    timestamp: context.timestamp || new Date().toISOString(),
    context: {
      provider: context.provider,
      promptId: context.promptId,
      runId: context.runId,
      method: context.method || 'unknown'
    },
    changes: {
      hasChanges,
      totalChanges: diffs.brandAdds.length + diffs.brandDrops.length + 
                   diffs.competitorAdds.length + diffs.competitorDrops.length,
      brands: {
        adds: diffs.brandAdds.length,
        drops: diffs.brandDrops.length,
        added: diffs.brandAdds,
        dropped: diffs.brandDrops
      },
      competitors: {
        adds: diffs.competitorAdds.length,
        drops: diffs.competitorDrops.length,
        added: diffs.competitorAdds,
        dropped: diffs.competitorDrops
      }
    },
    sample: sample || {}
  };

  // Single-line JSON output for easy parsing/analysis
  console.info(JSON.stringify(logEntry));
}

/**
 * Helper to create detection result from various input formats
 */
export function normalizeDetectionResult(
  input: any
): DetectionResult {
  // Handle different input formats from various detection methods
  if (input.brands && input.competitors) {
    return {
      brands: Array.isArray(input.brands) ? input.brands : [],
      competitors: Array.isArray(input.competitors) ? input.competitors : []
    };
  }

  // Handle legacy format with competitors_json
  if (input.competitors_json || input.brands_json) {
    return {
      brands: input.brands_json || [],
      competitors: input.competitors_json || []
    };
  }

  // Handle artifact format
  if (input.brands && input.competitors) {
    return {
      brands: input.brands.map((b: any) => typeof b === 'string' ? b : b.name),
      competitors: input.competitors.map((c: any) => typeof c === 'string' ? c : c.name)
    };
  }

  // Fallback
  return {
    brands: [],
    competitors: []
  };
}

/**
 * Run V2 detection for shadow comparison
 */
export function runV2Detection(
  rawText: string,
  provider: string,
  accountBrand: AccountBrand,
  competitorsSeed: string[]
): DetectionResult {
  const inputs: DetectionInputs = {
    rawText,
    provider,
    accountBrand,
    competitorsSeed
  };
  
  const v2Result = detectBrandsV2(inputs);
  
  return {
    brands: v2Result.detectedBrands,
    competitors: v2Result.detectedCompetitors
  };
}

/**
 * Batch logging helper for multiple detection comparisons
 */
export function logDetectionBatch(
  comparisons: Array<{
    context: LogContext;
    current: DetectionResult;
    proposed: DetectionResult;
    sample?: any;
  }>
): void {
  comparisons.forEach(({ context, current, proposed, sample }) => {
    const diffs = diffDetections(current, proposed);
    logDetections(context, diffs, sample);
  });
}