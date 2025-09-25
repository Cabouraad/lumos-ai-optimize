/**
 * Strict Competitor Detection - Conservative approach
 * ORG-only + gazetteer + stopword blacklist
 * Enabled via FEATURE_STRICT_COMPETITORS flag
 */

import { createEdgeLogger } from '../observability/structured-logger.ts';

export interface StrictCompetitorMatch {
  name: string;
  normalized: string;
  mentions: number;
  confidence: number;
  source: 'org_gazetteer' | 'brand_catalog' | 'historical';
}

export interface StrictDetectionResult {
  competitors: StrictCompetitorMatch[];
  orgBrands: StrictCompetitorMatch[];
  rejectedTerms: string[];
  metadata: {
    total_candidates: number;
    gazetteer_matches: number;
    rejected_count: number;
    processing_time_ms: number;
    strict_mode: true;
  };
}

export class StrictCompetitorDetector {
  private supabase: any;
  private logger: any;
  private orgGazetteer: Map<string, { name: string; isOrgBrand: boolean; source: string }> = new Map();
  private strictStopwords: Set<string>;

  constructor(supabase: any, logger?: any) {
    this.supabase = supabase;
    this.logger = logger || createEdgeLogger('strict-competitor-detector');
    this.strictStopwords = this.buildStrictStopwords();
  }

  private buildStrictStopwords(): Set<string> {
    // Ultra-conservative stopword list - only allow well-known brands
    return new Set([
      // Generic business terms
      'software', 'platform', 'solution', 'system', 'tool', 'tools', 'service', 'services',
      'company', 'business', 'enterprise', 'corporate', 'organization', 'team', 'group',
      'product', 'products', 'application', 'app', 'apps', 'website', 'site', 'portal',
      'dashboard', 'interface', 'management', 'automation', 'integration', 'optimization',
      
      // Tech giants (too generic)
      'google', 'microsoft', 'apple', 'amazon', 'facebook', 'meta', 'twitter', 'linkedin',
      'instagram', 'youtube', 'tiktok', 'pinterest', 'snapchat', 'adobe', 'oracle', 'ibm',
      
      // Generic descriptors
      'best', 'top', 'leading', 'popular', 'free', 'premium', 'basic', 'advanced', 'pro',
      'digital', 'online', 'cloud', 'web', 'mobile', 'desktop', 'api', 'sdk', 'crm', 'erp',
      
      // Common words that might be capitalized
      'data', 'analytics', 'insights', 'reports', 'metrics', 'performance', 'results',
      'marketing', 'sales', 'customer', 'customers', 'client', 'clients', 'user', 'users',
      
      // Single letters and numbers
      'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
      '1', '2', '3', '4', '5', '6', '7', '8', '9', '10',
    ]);
  }

  async initializeOrgGazetteer(orgId: string): Promise<void> {
    this.logger.info('Initializing strict org gazetteer', { orgId });

    try {
      // Only load from brand_catalog (verified brands only)
      const { data: brandCatalog, error } = await this.supabase
        .from('brand_catalog')
        .select('name, is_org_brand, variants_json')
        .eq('org_id', orgId);

      if (error) throw error;

      if (brandCatalog) {
        for (const brand of brandCatalog) {
          const normalized = this.normalizeName(brand.name);
          
          // Only include if it passes strict validation
          if (this.isStrictlyValid(brand.name)) {
            this.orgGazetteer.set(normalized, {
              name: brand.name,
              isOrgBrand: brand.is_org_brand,
              source: 'brand_catalog'
            });

            // Add variants with strict validation
            if (brand.variants_json && Array.isArray(brand.variants_json)) {
              for (const variant of brand.variants_json) {
                if (this.isStrictlyValid(variant)) {
                  const normalizedVariant = this.normalizeName(variant);
                  this.orgGazetteer.set(normalizedVariant, {
                    name: variant,
                    isOrgBrand: brand.is_org_brand,
                    source: 'brand_catalog_variant'
                  });
                }
              }
            }
          }
        }
      }

      this.logger.info('Strict gazetteer initialized', { 
        orgId, 
        totalEntries: this.orgGazetteer.size 
      });

    } catch (error: unknown) {
      this.logger.error('Failed to initialize strict gazetteer', error as Error, { orgId });
      throw error;
    }
  }

  async detectCompetitors(text: string, orgId: string): Promise<StrictDetectionResult> {
    const startTime = performance.now();
    
    this.logger.info('Starting strict competitor detection', { orgId, textLength: text.length });

    // Initialize gazetteer if needed
    if (this.orgGazetteer.size === 0) {
      await this.initializeOrgGazetteer(orgId);
    }

    // Extract candidates with ultra-conservative approach
    const candidates = this.extractStrictCandidates(text);
    this.logger.debug('Extracted strict candidates', { count: candidates.length });

    const competitors: StrictCompetitorMatch[] = [];
    const orgBrands: StrictCompetitorMatch[] = [];
    const rejectedTerms: string[] = [];
    let gazetteerMatches = 0;

    for (const candidate of candidates) {
      const normalized = this.normalizeName(candidate);
      
      // Must exist in org gazetteer (no global gazetteer in strict mode)
      const orgEntry = this.orgGazetteer.get(normalized);
      
      if (orgEntry) {
        gazetteerMatches++;
        const mentions = this.countMentions(text, candidate);
        const confidence = this.calculateStrictConfidence(candidate, text, mentions);
        
        const match: StrictCompetitorMatch = {
          name: orgEntry.name,
          normalized,
          mentions,
          confidence,
          source: orgEntry.source as any
        };

        if (orgEntry.isOrgBrand) {
          orgBrands.push(match);
        } else {
          competitors.push(match);
        }
      } else {
        rejectedTerms.push(candidate);
      }
    }

    const processingTime = performance.now() - startTime;

    const result: StrictDetectionResult = {
      competitors: competitors.sort((a, b) => b.confidence - a.confidence),
      orgBrands: orgBrands.sort((a, b) => b.confidence - a.confidence),
      rejectedTerms,
      metadata: {
        total_candidates: candidates.length,
        gazetteer_matches: gazetteerMatches,
        rejected_count: rejectedTerms.length,
        processing_time_ms: Math.round(processingTime),
        strict_mode: true
      }
    };

    this.logger.info('Strict competitor detection complete', {
      orgId,
      competitors: competitors.length,
      orgBrands: orgBrands.length,
      processingTime: Math.round(processingTime)
    });

    return result;
  }

  private extractStrictCandidates(text: string): string[] {
    // Ultra-conservative candidate extraction
    // Only proper nouns with specific patterns
    const candidates: string[] = [];
    
    // Match sequences like "CompanyName System", "BrandName Platform", etc.
    const patterns = [
      // Brand + common business suffix
      /\b([A-Z][a-z]+(?:[A-Z][a-z]+)*)\s+(CRM|ERP|Platform|System|Software|Suite|Pro|Enterprise)\b/g,
      // Standalone proper nouns (3+ chars, no common words)
      /\b[A-Z][a-z]{2,}(?:[A-Z][a-z]+)*\b/g,
      // Compound brands with consistent capitalization
      /\b[A-Z][a-z]+[A-Z][a-z]+(?:[A-Z][a-z]+)*\b/g
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const candidate = match[1] || match[0];
        if (this.isStrictCandidate(candidate)) {
          candidates.push(candidate);
        }
      }
    }

    // Remove duplicates and return
    return [...new Set(candidates)];
  }

  private isStrictCandidate(candidate: string): boolean {
    const normalized = this.normalizeName(candidate);
    
    // Ultra-strict validation
    return (
      candidate.length >= 3 &&
      candidate.length <= 30 &&
      !this.strictStopwords.has(normalized) &&
      !/^[0-9]+$/.test(candidate) && // No pure numbers
      !/[<>{}[\]()"`''""''„"‚'']/.test(candidate) && // No problematic chars
      !/(click|learn|more|here|sign|up|get|started|try|free|now)/i.test(candidate) && // No CTA phrases
      !/^(the|and|or|but|for|with|at|by|from|about)$/i.test(candidate) // No articles/prepositions
    );
  }

  private isStrictlyValid(name: string): boolean {
    return this.isStrictCandidate(name) && name.length >= 2;
  }

  private normalizeName(name: string): string {
    return name.toLowerCase().trim().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ');
  }

  private countMentions(text: string, term: string): number {
    const regex = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    return (text.match(regex) || []).length;
  }

  private calculateStrictConfidence(candidate: string, text: string, mentions: number): number {
    let confidence = 0.6; // Conservative base confidence

    // Multiple mentions boost
    confidence += Math.min(mentions - 1, 3) * 0.1; // Max +0.3

    // Position boost (early mentions are more confident)
    const firstIndex = text.toLowerCase().indexOf(candidate.toLowerCase());
    if (firstIndex !== -1) {
      const positionRatio = firstIndex / text.length;
      if (positionRatio < 0.3) confidence += 0.2; // Early mention boost
    }

    // Length and format bonuses (conservative)
    if (candidate.length >= 6) confidence += 0.1; // Longer names more likely to be brands
    if (/^[A-Z][a-z]+[A-Z]/.test(candidate)) confidence += 0.1; // CamelCase boost

    return Math.min(confidence, 1.0);
  }
}