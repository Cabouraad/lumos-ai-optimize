/**
 * Minimal detection diagnostics for edge functions
 * Simplified version without dependencies on src/ files
 */

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
  const brandAdds = Array.from(proposedBrands).filter((brand: string) => !currentBrands.has(brand));
  const brandDrops = Array.from(currentBrands).filter((brand: string) => !proposedBrands.has(brand));

  // Calculate competitor differences
  const competitorAdds = Array.from(proposedCompetitors).filter((comp: string) => !currentCompetitors.has(comp));
  const competitorDrops = Array.from(currentCompetitors).filter((comp: string) => !proposedCompetitors.has(comp));

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
    metadata?: Record<string, unknown>;
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
 * Simple V2 detection placeholder - returns empty results for now
 * This is a minimal stub since the full V2 detection requires complex dependencies
 */
export function runSimpleV2Detection(
  rawText: string,
  provider: string,
  orgBrandVariants: string[],
  competitorsSeed: string[]
): DetectionResult {
  // This is a simplified placeholder that would be enhanced later
  // For now, just return empty results to avoid complex dependencies
  console.log('V2 detection placeholder called', {
    provider,
    textLength: rawText.length,
    orgBrands: orgBrandVariants.length,
    competitors: competitorsSeed.length
  });
  
  return {
    brands: [],
    competitors: []
  };
}