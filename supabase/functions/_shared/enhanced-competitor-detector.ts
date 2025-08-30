/**
 * Refactored Enhanced Competitor Detection Service
 * Implements strict rules for proper noun detection and competitor identification
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { isBlacklisted, getAllBlacklistedTerms } from './stopwords-blacklist.ts';
import { findGlobalCompetitor, createGlobalCompetitorsMap } from './global-competitors-gazetteer.ts';
import { extractOrganizations } from './ner-service.ts';

export interface CompetitorMatch {
  name: string;
  normalized: string;
  mentions: number;
  first_pos_ratio: number;
}

export interface CompetitorDetectionResult {
  competitors: CompetitorMatch[];
  orgBrands: CompetitorMatch[];
  rejectedTerms: string[];
  metadata: {
    gazetteer_matches: number;
    ner_matches: number;
    global_matches: number;
    total_candidates: number;
    processing_time_ms: number;
  };
}

/**
 * Enhanced Competitor Detector with strict proper noun validation
 */
export class EnhancedCompetitorDetector {
  private supabase: any;
  private accountGazetteer: Map<string, { name: string; source: string; normalized: string; isOrgBrand: boolean }> = new Map();
  private globalGazetteer: Map<string, any>;
  private blacklistedTerms: Set<string>;
  private orgBrands: Set<string> = new Set();

  constructor(supabase: any) {
    this.supabase = supabase;
    this.globalGazetteer = createGlobalCompetitorsMap();
    this.blacklistedTerms = getAllBlacklistedTerms();
  }

  /**
   * Initialize account-level gazetteer from various sources
   */
  async initializeAccountGazetteer(orgId: string): Promise<void> {
    console.log('🔍 Initializing account-level competitor gazetteer for org:', orgId);
    
    try {
      // 1. Load from brand_catalog (competitors + org brands)
      const { data: brandCatalog } = await this.supabase
        .from('brand_catalog')
        .select('name, variants_json, is_org_brand')
        .eq('org_id', orgId);

      if (brandCatalog) {
        for (const brand of brandCatalog) {
          const normalized = this.normalizeName(brand.name);
          const entry = {
            name: brand.name,
            source: 'brand_catalog',
            normalized,
            isOrgBrand: brand.is_org_brand
          };

          if (brand.is_org_brand) {
            this.orgBrands.add(normalized);
          }
          
          this.accountGazetteer.set(normalized, entry);
          
          // Add variants
          if (brand.variants_json && Array.isArray(brand.variants_json)) {
            for (const variant of brand.variants_json) {
              const normalizedVariant = this.normalizeName(variant);
              if (brand.is_org_brand) {
                this.orgBrands.add(normalizedVariant);
              }
              this.accountGazetteer.set(normalizedVariant, {
                name: variant,
                source: 'brand_catalog_variant',
                normalized: normalizedVariant,
                isOrgBrand: brand.is_org_brand
              });
            }
          }
        }
      }

      // 2. Load from organization's competitorsSeed (if available)
      const { data: org } = await this.supabase
        .from('organizations')
        .select('name, metadata')
        .eq('id', orgId)
        .single();

      if (org?.metadata?.competitorsSeed && Array.isArray(org.metadata.competitorsSeed)) {
        for (const competitor of org.metadata.competitorsSeed) {
          const normalized = this.normalizeName(competitor);
          if (!this.accountGazetteer.has(normalized) && !this.orgBrands.has(normalized)) {
            this.accountGazetteer.set(normalized, {
              name: competitor,
              source: 'account_seed',
              normalized,
              isOrgBrand: false
            });
          }
        }
      }

      // 3. Load historical competitors from recent responses (lightweight)
      const { data: historicalCompetitors } = await this.supabase
        .from('prompt_provider_responses')
        .select('competitors_json')
        .eq('org_id', orgId)
        .gte('run_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()) // Last 30 days
        .eq('status', 'success')
        .limit(20);

      if (historicalCompetitors) {
        const competitorCounts = new Map<string, number>();
        
        for (const response of historicalCompetitors) {
          if (response.competitors_json && Array.isArray(response.competitors_json)) {
            for (const competitor of response.competitors_json) {
              if (typeof competitor === 'string' && this.isValidCompetitorCandidate(competitor)) {
                const normalized = this.normalizeName(competitor);
                competitorCounts.set(normalized, (competitorCounts.get(normalized) || 0) + 1);
              }
            }
          }
        }

        // Add competitors that appear 2+ times
        for (const [normalized, count] of competitorCounts.entries()) {
          if (count >= 2 && !this.accountGazetteer.has(normalized) && !this.orgBrands.has(normalized)) {
            // Use the most common form as the canonical name
            const canonicalName = this.capitalizeProperNoun(normalized);
            this.accountGazetteer.set(normalized, {
              name: canonicalName,
              source: 'historical',
              normalized,
              isOrgBrand: false
            });
          }
        }
      }

      console.log(`✅ Gazetteer initialized: ${this.accountGazetteer.size} account entries, ${this.orgBrands.size} org brands`);
      
    } catch (error) {
      console.error('❌ Error initializing gazetteer:', error);
    }
  }

  /**
   * Main competitor detection method
   */
  async detectCompetitors(
    text: string,
    orgId: string,
    options: {
      useNERFallback?: boolean;
      maxCandidates?: number;
    } = {}
  ): Promise<CompetitorDetectionResult> {
    const startTime = Date.now();
    const { useNERFallback = true, maxCandidates = 15 } = options;

    // Initialize gazetteer if not already done
    if (this.accountGazetteer.size === 0) {
      await this.initializeAccountGazetteer(orgId);
    }

    const competitors: CompetitorMatch[] = [];
    const orgBrands: CompetitorMatch[] = [];
    const rejectedTerms: string[] = [];
    let gazetteerMatches = 0;
    let globalMatches = 0;
    let nerMatches = 0;

    // Step 1: Extract potential competitor candidates using strict proper noun rules
    const candidates = this.extractProperNounCandidates(text);
    
    console.log(`🔍 Found ${candidates.length} proper noun candidates:`, candidates.slice(0, 10).map(c => c.name));

    // Step 2: Validate and match against gazetteers
    for (const candidate of candidates) {
      if (!this.isValidCompetitorCandidate(candidate.name)) {
        rejectedTerms.push(candidate.name);
        continue;
      }

      const normalized = this.normalizeName(candidate.name);
      
      // Check if it's an org brand
      if (this.orgBrands.has(normalized)) {
        orgBrands.push({
          name: candidate.name,
          normalized,
          mentions: candidate.mentions,
          first_pos_ratio: candidate.first_pos_ratio
        });
        continue;
      }

      // Check account-level gazetteer first
      const accountMatch = this.accountGazetteer.get(normalized);
      if (accountMatch && !accountMatch.isOrgBrand) {
        competitors.push({
          name: accountMatch.name,
          normalized,
          mentions: candidate.mentions,
          first_pos_ratio: candidate.first_pos_ratio
        });
        gazetteerMatches++;
        continue;
      }

      // Check global competitors gazetteer
      const globalMatch = findGlobalCompetitor(candidate.name);
      if (globalMatch) {
        competitors.push({
          name: globalMatch.name,
          normalized,
          mentions: candidate.mentions,
          first_pos_ratio: candidate.first_pos_ratio
        });
        globalMatches++;
        continue;
      }

      // If not found in gazetteers, add to rejected for potential NER processing
      rejectedTerms.push(candidate.name);
    }

    // Step 3: NER Fallback for unmatched candidates (if enabled)
    if (useNERFallback && rejectedTerms.length > 0) {
      try {
        console.log('🤖 Running NER fallback for unmatched candidates...');
        const nerResult = await extractOrganizations(text, {
          maxEntities: 10,
          confidenceThreshold: 0.7
        });
        
        // Safely iterate over organizations with fallback to handle undefined/null
        const organizationNames = Array.isArray(nerResult.organizations) ? nerResult.organizations : [];
        for (const orgName of organizationNames) {
          // Only add if it's a valid candidate and not already found
          if (this.isValidCompetitorCandidate(orgName) && 
              !competitors.some(c => this.normalizeName(c.name) === this.normalizeName(orgName)) &&
              !orgBrands.some(b => this.normalizeName(b.name) === this.normalizeName(orgName))) {
            
            // Calculate mentions and position for NER-discovered entities
            const mentions = this.countMentions(text, orgName);
            const firstPos = text.toLowerCase().indexOf(orgName.toLowerCase());
            const firstPosRatio = firstPos >= 0 ? firstPos / text.length : 1;
            
            competitors.push({
              name: orgName,
              normalized: this.normalizeName(orgName),
              mentions,
              first_pos_ratio: firstPosRatio
            });
            nerMatches++;
          }
        }
      } catch (error) {
        console.error('❌ NER fallback failed:', error);
      }
    }

    // Step 4: Sort and limit results
    const finalCompetitors = competitors
      .sort((a, b) => {
        // Sort by mentions desc, then by position (earlier = better)
        if (a.mentions !== b.mentions) return b.mentions - a.mentions;
        return a.first_pos_ratio - b.first_pos_ratio;
      })
      .slice(0, maxCandidates);

    const finalOrgBrands = orgBrands
      .sort((a, b) => b.mentions - a.mentions);

    const processingTime = Date.now() - startTime;
    
    console.log(`✅ Detection complete: ${finalCompetitors.length} competitors, ${finalOrgBrands.length} org brands (${processingTime}ms)`);
    console.log('📊 Sources:', { gazetteer: gazetteerMatches, global: globalMatches, ner: nerMatches });

    return {
      competitors: finalCompetitors,
      orgBrands: finalOrgBrands,
      rejectedTerms,
      metadata: {
        gazetteer_matches: gazetteerMatches,
        ner_matches: nerMatches,
        global_matches: globalMatches,
        total_candidates: candidates.length,
        processing_time_ms: processingTime
      }
    };
  }

  /**
   * Extract proper noun candidates using strict capitalization rules
   */
  private extractProperNounCandidates(text: string): Array<{ name: string; mentions: number; first_pos_ratio: number }> {
    const candidates = new Map<string, { mentions: number; first_position: number }>();
    const textLength = text.length;
    let match: RegExpExecArray | null;

    // Pattern 1: Proper nouns (capitalized words, 2-30 chars)
    // Matches: "HubSpot", "Zoho CRM", "Google Analytics", "Microsoft Teams"
    const properNounPattern = /\b[A-Z][a-zA-Z]{1,29}(?:\s+[A-Z][a-zA-Z]+)*\b/g;
    while ((match = properNounPattern.exec(text)) !== null) {
      const candidate = match[0].trim();
      if (this.isProperNounCandidate(candidate)) {
        const existing = candidates.get(candidate);
        if (existing) {
          existing.mentions++;
        } else {
          candidates.set(candidate, {
            mentions: 1,
            first_position: match.index
          });
        }
      }
    }

    // Pattern 2: PascalCase terms (e.g., "ActiveCampaign", "ConvertKit")
    const pascalCasePattern = /\b[A-Z][a-z]+[A-Z][a-zA-Z]*\b/g;
    while ((match = pascalCasePattern.exec(text)) !== null) {
      const candidate = match[0].trim();
      if (this.isProperNounCandidate(candidate)) {
        const existing = candidates.get(candidate);
        if (existing) {
          existing.mentions++;
        } else {
          candidates.set(candidate, {
            mentions: 1,
            first_position: match.index
          });
        }
      }
    }

    // Pattern 3: Domain-like names (e.g., "salesforce.com" -> "Salesforce")
    const domainPattern = /\b([a-zA-Z0-9-]+)\.(com|io|net|org|co|ai)\b/g;
    while ((match = domainPattern.exec(text)) !== null) {
      const domainName = match[1];
      if (domainName.length >= 2 && domainName.length <= 20) {
        const brandName = this.capitalizeProperNoun(domainName);
        const existing = candidates.get(brandName);
        if (existing) {
          existing.mentions++;
        } else {
          candidates.set(brandName, {
            mentions: 1,
            first_position: match.index
          });
        }
      }
    }

    // Convert to array with first_pos_ratio
    return Array.from(candidates.entries()).map(([name, data]) => ({
      name,
      mentions: data.mentions,
      first_pos_ratio: textLength > 0 ? data.first_position / textLength : 0
    }));
  }

  /**
   * Check if a candidate is a valid proper noun
   */
  private isProperNounCandidate(candidate: string): boolean {
    // Must be 2-30 characters
    if (candidate.length < 2 || candidate.length > 30) {
      return false;
    }

    // Must start with capital letter
    if (!/^[A-Z]/.test(candidate)) {
      return false;
    }

    // Must not be purely numeric
    if (/^[0-9]+$/.test(candidate)) {
      return false;
    }

    // Must not contain problematic characters
    if (/[<>{}[\]()"`''""''„"‚'']/.test(candidate)) {
      return false;
    }

    return true;
  }

  /**
   * Comprehensive validation for competitor candidates
   */
  private isValidCompetitorCandidate(name: string): boolean {
    // Basic length and format checks
    if (!this.isProperNounCandidate(name)) {
      return false;
    }

    const normalized = this.normalizeName(name);

    // Check against comprehensive blacklist
    if (isBlacklisted(normalized)) {
      return false;
    }

    // Additional business context validation
    if (this.isGenericBusinessTerm(normalized)) {
      return false;
    }

    // Check for spam patterns
    const spamPatterns = [
      /^(click|learn|sign|get|try|contact|about|privacy|terms)/i,
      /\b(more|here|now|today|free|demo|trial)\b/i,
      /^(http|www|email|phone|address)/i
    ];
    
    if (spamPatterns.some(pattern => pattern.test(normalized))) {
      return false;
    }

    return true;
  }

  /**
   * Check if term is a generic business/technology term
   */
  private isGenericBusinessTerm(normalized: string): boolean {
    const genericTerms = [
      'marketing', 'automation', 'analytics', 'platform', 'software', 'solution', 'system',
      'tool', 'service', 'data', 'customer', 'business', 'digital', 'online', 'cloud',
      'enterprise', 'professional', 'premium', 'advanced', 'basic', 'standard', 'pro',
      'integration', 'management', 'optimization', 'performance', 'intelligence', 'insights'
    ];

    return genericTerms.some(term => 
      normalized === term || 
      normalized.startsWith(term + ' ') || 
      normalized.endsWith(' ' + term)
    );
  }

  /**
   * Normalize name for consistent matching
   */
  private normalizeName(name: string): string {
    return name.toLowerCase().trim().replace(/\s+/g, ' ');
  }

  /**
   * Capitalize proper noun correctly
   */
  private capitalizeProperNoun(name: string): string {
    return name.split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  /**
   * Count mentions of a term in text
   */
  private countMentions(text: string, term: string): number {
    const regex = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    const matches = text.match(regex);
    return matches ? matches.length : 0;
  }
}

/**
 * Factory function for easy usage
 */
export async function detectCompetitors(
  supabase: any,
  orgId: string,
  text: string,
  options: {
    useNERFallback?: boolean;
    maxCandidates?: number;
  } = {}
): Promise<CompetitorDetectionResult> {
  const detector = new EnhancedCompetitorDetector(supabase);
  return await detector.detectCompetitors(text, orgId, options);
}