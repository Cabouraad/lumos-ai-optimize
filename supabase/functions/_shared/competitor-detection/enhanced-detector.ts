/**
 * Enhanced Competitor Detection with Fallback Strategy
 * Uses strict detection first, falls back to legacy if no results
 */

import { StrictCompetitorDetector } from './strict-detector.ts';
import { LegacyCompetitorDetector } from './legacy-detector.ts';
import { createEdgeLogger } from '../observability/structured-logger.ts';
import { isEdgeFeatureEnabled } from '../feature-flags.ts';
import { 
  diffDetections, 
  logDetections, 
  runSimpleV2Detection,
  type DetectionResult,
  type LogContext
} from '../detection-diagnostics.ts';

export interface EnhancedDetectionResult {
  competitors: Array<{
    name: string;
    normalized: string;
    mentions: number;
    confidence: number;
    source: string;
  }>;
  orgBrands: Array<{
    name: string;
    normalized: string;
    mentions: number;
    confidence: number;
    source: string;
  }>;
  rejectedTerms: string[];
  metadata: {
    total_candidates: number;
    gazetteer_matches?: number;
    extracted_count?: number;
    rejected_count: number;
    processing_time_ms: number;
    strict_mode: boolean;
    fallback_used?: boolean;
    detection_method: 'strict' | 'legacy' | 'strict_with_fallback';
  };
}

export class EnhancedCompetitorDetector {
  private strictDetector: StrictCompetitorDetector;
  private legacyDetector: LegacyCompetitorDetector;
  private logger: any;
  private supabase: any;

  constructor(supabase: any, logger?: any) {
    this.supabase = supabase;
    this.strictDetector = new StrictCompetitorDetector(supabase, logger);
    this.legacyDetector = new LegacyCompetitorDetector(supabase, logger);
    this.logger = logger || createEdgeLogger('enhanced-competitor-detector');
  }

  /**
   * Convert detection method string to numeric confidence score
   */
  private getConfidenceScore(method: 'strict' | 'legacy' | 'strict_with_fallback'): number {
    switch (method) {
      case 'strict': return 0.9;
      case 'legacy': return 0.7;
      case 'strict_with_fallback': return 0.8;
      default: return 0.5;
    }
  }

  async detectCompetitors(text: string, orgId: string): Promise<EnhancedDetectionResult> {
    const startTime = performance.now();
    const runId = crypto.randomUUID();
    
    this.logger.info('Starting enhanced competitor detection', { 
      orgId, 
      textLength: text.length,
      strictModeEnabled: isEdgeFeatureEnabled('FEATURE_STRICT_COMPETITOR_DETECT'),
      runId
    });

    // Check if strict mode is enabled
    if (isEdgeFeatureEnabled('FEATURE_STRICT_COMPETITOR_DETECT')) {
      try {
        // Try strict detection first
        const strictResult = await this.strictDetector.detectCompetitors(text, orgId);
        
        // If strict detection found competitors, use it
        if (strictResult.competitors.length > 0 || strictResult.orgBrands.length > 0) {
          this.logger.info('Strict detection successful', {
            competitors: strictResult.competitors.length,
            orgBrands: strictResult.orgBrands.length
          });

          const finalResult = this.normalizeResult(strictResult, 'strict', performance.now() - startTime);
          
          // SHADOW MODE: Compare current (strict) with V2 when flag enabled 
          if (isEdgeFeatureEnabled('FEATURE_DETECTOR_SHADOW')) {
            try {
              // Compute current from existing strict results (unchanged)
              const current: DetectionResult = {
                brands: finalResult.orgBrands.map((b: any) => b.name),
                competitors: finalResult.competitors.map((c: any) => c.name)
              };
              
              // Compute proposed via V2 detection
              await this.runV2ShadowDiagnostics(runId, orgId, text, current, 'strict');
              
            } catch (error: unknown) {
              this.logger.warn('Shadow diagnostics failed', { 
                error: error instanceof Error ? error.message : String(error) 
              });
            }
          }
          
          return finalResult;
        }

        // If strict detection yielded empty results, fall back to legacy
        this.logger.info('Strict detection yielded no results, falling back to legacy');
        
        const legacyResult = await this.legacyDetector.detectCompetitors(text, orgId);
        
        return this.normalizeResult(legacyResult, 'strict_with_fallback', performance.now() - startTime, true);

      } catch (error: unknown) {
        const errorObj = error instanceof Error ? error : new Error(String(error));
        this.logger.error('Strict detection failed, falling back to legacy', errorObj);
        
        const legacyResult = await this.legacyDetector.detectCompetitors(text, orgId);
        return this.normalizeResult(legacyResult, 'strict_with_fallback', performance.now() - startTime, true);
      }
    } else {
      // Use legacy detection when strict mode is disabled
      const legacyResult = await this.legacyDetector.detectCompetitors(text, orgId);
      
      // SHADOW MODE: Compare current (legacy) with V2 when flag enabled
      if (isEdgeFeatureEnabled('FEATURE_DETECTOR_SHADOW')) {
        try {
          const finalResult = this.normalizeResult(legacyResult, 'legacy', performance.now() - startTime);
          
          // Compute current from existing legacy results (unchanged)
          const current: DetectionResult = {
            brands: finalResult.orgBrands.map((b: any) => b.name),
            competitors: finalResult.competitors.map((c: any) => c.name)
          };
          
          // Compute proposed via V2 detection
          await this.runV2ShadowDiagnostics(runId, orgId, text, current, 'legacy');
          
          return finalResult;
        } catch (error: unknown) {
          this.logger.warn('Shadow diagnostics failed', { 
            error: error instanceof Error ? error.message : String(error) 
          });
        }
      }
      
      return this.normalizeResult(legacyResult, 'legacy', performance.now() - startTime);
    }
  }

  private normalizeResult(
    result: any, 
    method: 'strict' | 'legacy' | 'strict_with_fallback',
    totalTime: number,
    fallbackUsed: boolean = false
  ): EnhancedDetectionResult {
    // Ensure consistent output shape regardless of detector used
    return {
      competitors: result.competitors.map((c: any) => ({
        name: c.name,
        normalized: c.normalized || c.name.toLowerCase().trim(),
        mentions: c.mentions,
        confidence: c.confidence,
        source: c.source || (method === 'strict' ? 'brand_catalog' : 'extraction')
      })),
      orgBrands: result.orgBrands.map((b: any) => ({
        name: b.name,
        normalized: b.normalized || b.name.toLowerCase().trim(),
        mentions: b.mentions,
        confidence: b.confidence,
        source: b.source || (method === 'strict' ? 'brand_catalog' : 'extraction')
      })),
      rejectedTerms: result.rejectedTerms || [],
      metadata: {
        ...result.metadata,
        processing_time_ms: Math.round(totalTime),
        detection_method: method,
        fallback_used: fallbackUsed
      }
    };
  }

  /**
   * Run shadow diagnostics to compare detection methods
   */
  private runShadowDiagnostics(
    runId: string, 
    orgId: string, 
    comparison: string, 
    current: EnhancedDetectionResult, 
    proposed: any, 
    responseLength: number
  ): void {
    try {
      const currentNormalized: DetectionResult = {
        brands: current.orgBrands.map((b: any) => b.name),
        competitors: current.competitors.map((c: any) => c.name)
      };

      const proposedNormalized: DetectionResult = {
        brands: proposed.orgBrands?.map((b: any) => b.name) || [],
        competitors: proposed.competitors?.map((c: any) => c.name) || []
      };

      const diffs = diffDetections(currentNormalized, proposedNormalized);
      
      const context: LogContext = {
        provider: 'enhanced-detector',
        promptId: orgId, // Using orgId as identifier since we don't have promptId here
        runId,
        method: comparison
      };

      const sample = {
        responseLength,
        confidence: this.getConfidenceScore(current.metadata.detection_method),
        metadata: {
          current_method: current.metadata.detection_method,
          proposed_method: proposed.metadata?.detection_method || 'unknown',
          processing_time_current: current.metadata.processing_time_ms,
          processing_time_proposed: proposed.metadata?.processing_time_ms
        }
      };

      logDetections(context, diffs, sample);
    } catch (error: unknown) {
      this.logger.warn('Shadow diagnostics execution failed', { 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  }

  /**
   * Run shadow diagnostics with preprocessing analysis
   */
  private runShadowDiagnosticsWithPreprocessing(
    runId: string, 
    orgId: string, 
    comparison: string, 
    current: EnhancedDetectionResult, 
    proposed: any, 
    responseLength: number,
    preprocessed: { plainText: string; anchors: string[]; domains: string[] }
  ): void {
    try {
      const currentNormalized: DetectionResult = {
        brands: current.orgBrands.map((b: any) => b.name),
        competitors: current.competitors.map((c: any) => c.name)
      };

      const proposedNormalized: DetectionResult = {
        brands: proposed.orgBrands?.map((b: any) => b.name) || [],
        competitors: proposed.competitors?.map((c: any) => c.name) || []
      };

      const diffs = diffDetections(currentNormalized, proposedNormalized);
      
      const context: LogContext = {
        provider: 'enhanced-detector-preprocessed',
        promptId: orgId,
        runId,
        method: comparison
      };

      const sample = {
        responseLength,
        confidence: this.getConfidenceScore(current.metadata.detection_method),
        metadata: {
          current_method: current.metadata.detection_method,
          proposed_method: proposed.metadata?.detection_method || 'unknown',
          processing_time_current: current.metadata.processing_time_ms,
          processing_time_proposed: proposed.metadata?.processing_time_ms,
          preprocessing: {
            original_length: responseLength,
            processed_length: preprocessed.plainText.length,
            anchors_extracted: preprocessed.anchors.length,
            domains_extracted: preprocessed.domains.length,
            size_reduction_pct: Math.round(((responseLength - preprocessed.plainText.length) / responseLength) * 100)
          }
        }
      };

      logDetections(context, diffs, sample);
    } catch (error: unknown) {
      this.logger.warn('Shadow diagnostics with preprocessing execution failed', { 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  }

  /**
   * Run V2 shadow diagnostics in the run pipeline
   */
  private async runV2ShadowDiagnostics(
    runId: string,
    orgId: string,
    text: string,
    current: DetectionResult,
    method: string
  ): Promise<void> {
    try {
      // Get organization data for V2 detection
      const { data: org } = await this.supabase
        .from('organizations')
        .select('name, domain')
        .eq('id', orgId)
        .single();

      const { data: brandCatalog } = await this.supabase
        .from('brand_catalog')
        .select('name, variants_json, is_org_brand')
        .eq('org_id', orgId);

      if (!org) return;

      // Build account brand aliases for simplified V2
      const orgBrands: string[] = [];

      // Add org brand aliases from catalog
      if (brandCatalog) {
        brandCatalog
          .filter((b: any) => b.is_org_brand)
          .forEach((brand: any) => {
            orgBrands.push(brand.name);
            if (brand.variants_json && Array.isArray(brand.variants_json)) {
              orgBrands.push(...brand.variants_json);
            }
          });
      }

      // Build competitors seed
      const competitorsSeed = brandCatalog
        ?.filter((b: any) => !b.is_org_brand)
        .map((b: any) => b.name) || [];

      // Run simplified V2 detection
      const v2Result = runSimpleV2Detection(text, 'enhanced-detector', orgBrands, competitorsSeed);

      const diffs = diffDetections(current, v2Result);

      const context: LogContext = {
        provider: 'enhanced-detector-v2',
        promptId: orgId,
        runId,
        method: `${method}_vs_v2`
      };

      const sample = {
        responseLength: text.length,
        confidence: this.getConfidenceScore(method as 'strict' | 'legacy' | 'strict_with_fallback'),
        metadata: {
          text_sample: text.substring(0, 200), // First 200 chars for spot checks
          current_method: method,
          proposed_method: 'v2_detection',
          current_total: current.brands.length + current.competitors.length,
          proposed_total: v2Result.brands.length + v2Result.competitors.length
        }
      };

      logDetections(context, diffs, sample);
    } catch (error: unknown) {
      this.logger.warn('V2 shadow diagnostics execution failed', { 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  }
}