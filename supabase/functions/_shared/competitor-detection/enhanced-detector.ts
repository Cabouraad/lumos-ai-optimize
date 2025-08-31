/**
 * Enhanced Competitor Detection with Fallback Strategy
 * Uses strict detection first, falls back to legacy if no results
 */

import { StrictCompetitorDetector } from './strict-detector.ts';
import { LegacyCompetitorDetector } from './legacy-detector.ts';
import { createEdgeLogger } from '../observability/structured-logger.ts';
import { isOptimizationFeatureEnabled } from '../../../src/config/featureFlags.ts';

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

  constructor(supabase: any, logger?: any) {
    this.strictDetector = new StrictCompetitorDetector(supabase, logger);
    this.legacyDetector = new LegacyCompetitorDetector(supabase, logger);
    this.logger = logger || createEdgeLogger('enhanced-competitor-detector');
  }

  async detectCompetitors(text: string, orgId: string): Promise<EnhancedDetectionResult> {
    const startTime = performance.now();
    
    this.logger.info('Starting enhanced competitor detection', { 
      orgId, 
      textLength: text.length,
      strictModeEnabled: isOptimizationFeatureEnabled('FEATURE_STRICT_COMPETITOR_DETECT')
    });

    // Check if strict mode is enabled
    if (isOptimizationFeatureEnabled('FEATURE_STRICT_COMPETITOR_DETECT')) {
      try {
        // Try strict detection first
        const strictResult = await this.strictDetector.detectCompetitors(text, orgId);
        
        // If strict detection found competitors, use it
        if (strictResult.competitors.length > 0 || strictResult.orgBrands.length > 0) {
          this.logger.info('Strict detection successful', {
            competitors: strictResult.competitors.length,
            orgBrands: strictResult.orgBrands.length
          });

          return this.normalizeResult(strictResult, 'strict', performance.now() - startTime);
        }

        // If strict detection yielded empty results, fall back to legacy
        this.logger.info('Strict detection yielded no results, falling back to legacy');
        
        const legacyResult = await this.legacyDetector.detectCompetitors(text, orgId);
        
        return this.normalizeResult(legacyResult, 'strict_with_fallback', performance.now() - startTime, true);

      } catch (error) {
        this.logger.error('Strict detection failed, falling back to legacy', error as Error);
        
        const legacyResult = await this.legacyDetector.detectCompetitors(text, orgId);
        return this.normalizeResult(legacyResult, 'strict_with_fallback', performance.now() - startTime, true);
      }
    } else {
      // Use legacy detection when strict mode is disabled
      const legacyResult = await this.legacyDetector.detectCompetitors(text, orgId);
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
}