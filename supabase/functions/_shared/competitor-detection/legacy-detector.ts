/**
 * Legacy Competitor Detection - Original approach
 * Used as fallback when strict detection yields empty results
 */

import { createEdgeLogger } from '../observability/structured-logger.ts';

export interface LegacyCompetitorMatch {
  name: string;
  mentions: number;
  confidence: number;
  source: 'extraction' | 'pattern_match';
}

export interface LegacyDetectionResult {
  competitors: LegacyCompetitorMatch[];
  orgBrands: LegacyCompetitorMatch[];
  rejectedTerms: string[];
  metadata: {
    total_candidates: number;
    extracted_count: number;
    rejected_count: number;
    processing_time_ms: number;
    strict_mode: false;
  };
}

export class LegacyCompetitorDetector {
  private supabase: any;
  private logger: any;

  constructor(supabase: any, logger?: any) {
    this.supabase = supabase;
    this.logger = logger || createEdgeLogger('legacy-competitor-detector');
  }

  async detectCompetitors(text: string, orgId: string): Promise<LegacyDetectionResult> {
    const startTime = performance.now();
    
    this.logger.info('Starting legacy competitor detection', { orgId, textLength: text.length });

    // Extract candidates using the original liberal approach
    const candidates = this.extractCandidates(text);
    this.logger.debug('Extracted legacy candidates', { count: candidates.length });

    const competitors: LegacyCompetitorMatch[] = [];
    const orgBrands: LegacyCompetitorMatch[] = [];
    const rejectedTerms: string[] = [];

    // Get organization brands for filtering
    const { data: orgBrandData } = await this.supabase
      .from('brand_catalog')
      .select('name')
      .eq('org_id', orgId)
      .eq('is_org_brand', true);

    const orgBrandNames = new Set(
      (orgBrandData || []).map(b => b.name.toLowerCase())
    );

    for (const candidate of candidates) {
      const normalized = candidate.toLowerCase().trim();
      
      if (this.isValidCandidate(candidate)) {
        const mentions = this.countMentions(text, candidate);
        const confidence = this.calculateConfidence(candidate, text, mentions);
        
        const match: LegacyCompetitorMatch = {
          name: candidate,
          mentions,
          confidence,
          source: 'extraction'
        };

        if (orgBrandNames.has(normalized)) {
          orgBrands.push(match);
        } else {
          competitors.push(match);
        }
      } else {
        rejectedTerms.push(candidate);
      }
    }

    const processingTime = performance.now() - startTime;

    const result: LegacyDetectionResult = {
      competitors: competitors.sort((a, b) => b.confidence - a.confidence),
      orgBrands: orgBrands.sort((a, b) => b.confidence - a.confidence),
      rejectedTerms,
      metadata: {
        total_candidates: candidates.length,
        extracted_count: competitors.length + orgBrands.length,
        rejected_count: rejectedTerms.length,
        processing_time_ms: Math.round(processingTime),
        strict_mode: false
      }
    };

    this.logger.info('Legacy competitor detection complete', {
      orgId,
      competitors: competitors.length,
      orgBrands: orgBrands.length,
      processingTime: Math.round(processingTime)
    });

    return result;
  }

  private extractCandidates(text: string): string[] {
    // Liberal extraction - includes more potential matches
    const candidates: string[] = [];
    
    // Multiple patterns for broader coverage
    const patterns = [
      // Proper nouns and brands
      /\b[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*\b/g,
      // CamelCase terms
      /\b[A-Z][a-z]+[A-Z][a-z]+(?:[A-Z][a-z]+)*\b/g,
      // Product names with numbers
      /\b[A-Z][a-z]+(?:\s+\d+)?(?:\s+[A-Z][a-z]+)*\b/g
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const candidate = match[0].trim();
        if (candidate.length >= 2) {
          candidates.push(candidate);
        }
      }
    }

    // Remove duplicates and return
    return [...new Set(candidates)];
  }

  private isValidCandidate(candidate: string): boolean {
    const normalized = candidate.toLowerCase().trim();
    
    // Basic stopwords (less restrictive than strict mode)
    const basicStopwords = new Set([
      'the', 'and', 'or', 'but', 'for', 'with', 'at', 'by', 'from', 'about',
      'click', 'here', 'learn', 'more', 'get', 'started', 'try', 'free', 'now'
    ]);
    
    return (
      candidate.length >= 2 &&
      candidate.length <= 50 &&
      !basicStopwords.has(normalized) &&
      !/^[0-9]+$/.test(candidate) && // No pure numbers
      !/[<>{}[\]()"`''""''„"‚'']/.test(candidate) // No problematic chars
    );
  }

  private countMentions(text: string, term: string): number {
    const regex = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    return (text.match(regex) || []).length;
  }

  private calculateConfidence(candidate: string, text: string, mentions: number): number {
    let confidence = 0.4; // Lower base confidence than strict mode

    // Multiple mentions boost
    confidence += Math.min(mentions - 1, 2) * 0.1; // Max +0.2

    // Position boost
    const firstIndex = text.toLowerCase().indexOf(candidate.toLowerCase());
    if (firstIndex !== -1) {
      const positionRatio = firstIndex / text.length;
      if (positionRatio < 0.5) confidence += 0.1; // Early mention boost
    }

    // Format bonuses
    if (candidate.length >= 4) confidence += 0.05;
    if (/^[A-Z][a-z]+[A-Z]/.test(candidate)) confidence += 0.1; // CamelCase boost

    return Math.min(confidence, 0.9); // Cap at 0.9 for legacy
  }
}