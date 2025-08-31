/**
 * Integration point for strict competitor detection feature
 * Applies strict rules when FEATURE_STRICT_COMPETITOR_DETECT is enabled
 * Falls back to legacy detection if strict yields empty results
 */

import { EnhancedCompetitorDetector } from './enhanced-detector.ts';
import { createEdgeLogger } from '../observability/structured-logger.ts';

export async function detectCompetitorsWithFallback(
  text: string, 
  orgId: string, 
  supabase: any
) {
  const logger = createEdgeLogger('competitor-detection-integration');
  
  try {
    const detector = new EnhancedCompetitorDetector(supabase, logger);
    const result = await detector.detectCompetitors(text, orgId);
    
    logger.info('Competitor detection completed', {
      orgId,
      method: result.metadata.detection_method,
      competitors: result.competitors.length,
      fallbackUsed: result.metadata.fallback_used
    });
    
    return result;
  } catch (error) {
    logger.error('Competitor detection failed', error as Error, { orgId });
    throw error;
  }
}