/**
 * Enhanced visibility scoring algorithm with context awareness
 */

export interface VisibilityMetrics {
  brandPresent: boolean;
  brandPosition: number;
  brandMentions: number;
  competitorCount: number;
  competitorMentions: number;
  sentiment: 'positive' | 'negative' | 'neutral';
  contextRelevance: number;
  responseLength: number;
}

export interface ScoringWeights {
  presence: number;
  position: number;
  sentiment: number;
  context: number;
  competition: number;
  prominence: number;
}

const DEFAULT_WEIGHTS: ScoringWeights = {
  presence: 0.35,    // Base score for being mentioned
  position: 0.2,     // Early mention bonus
  sentiment: 0.25,   // Positive/negative sentiment impact
  context: 0.1,      // Context relevance
  competition: 0.1,  // Penalty for strong competitors
  prominence: 0.0    // Not used in simplified version
};

/**
 * Enhanced visibility scoring with multi-factor analysis
 */
export function computeEnhancedVisibilityScore(
  metrics: VisibilityMetrics,
  weights: ScoringWeights = DEFAULT_WEIGHTS
): {
  overallScore: number;
  breakdown: Record<string, number>;
  insights: string[];
} {
  const breakdown: Record<string, number> = {};
  const insights: string[] = [];
  let totalScore = 0;

  // 1. Presence Score (0-1)
  if (metrics.brandPresent) {
    breakdown.presence = 1 * weights.presence;
    insights.push('Brand is mentioned in the response');
  } else {
    breakdown.presence = 0;
    insights.push('Brand is not mentioned - major visibility issue');
    
    // Early return for absent brands with competitive penalty
    const competitionPenalty = Math.min(0.5, metrics.competitorCount * 0.1);
    breakdown.competition = -competitionPenalty * weights.competition;
    insights.push(`${metrics.competitorCount} competitors mentioned while brand is absent`);
    
    return {
      overallScore: Math.max(0, breakdown.presence + breakdown.competition),
      breakdown,
      insights
    };
  }

  // 2. Position Score (0-1) - normalized position bonus
  const positionScore = Math.max(0, 1 - (metrics.brandPosition * 0.1));
  breakdown.position = positionScore * weights.position;
  
  if (metrics.brandPosition <= 0.2) {
    insights.push('Brand mentioned very early - excellent positioning');
  } else if (metrics.brandPosition <= 0.5) {
    insights.push('Brand mentioned early - good positioning');
  } else if (metrics.brandPosition <= 0.8) {
    insights.push('Brand mentioned mid-response - average positioning');
  } else {
    insights.push('Brand mentioned late - poor positioning');
  }

  // 3. Sentiment Score (-0.5 to +0.5)
  let sentimentScore = 0;
  switch (metrics.sentiment) {
    case 'positive':
      sentimentScore = 0.5;
      insights.push('Positive brand sentiment detected');
      break;
    case 'negative':
      sentimentScore = -0.5;
      insights.push('Negative brand sentiment detected');
      break;
    case 'neutral':
      sentimentScore = 0.1; // Small bonus for neutral mentions
      insights.push('Neutral brand sentiment');
      break;
  }
  breakdown.sentiment = sentimentScore * weights.sentiment;

  // 4. Context Score (0-1)
  const contextScore = Math.min(1, metrics.contextRelevance);
  breakdown.context = contextScore * weights.context;
  
  if (contextScore > 0.8) {
    insights.push('Brand mentioned in highly relevant context');
  } else if (contextScore > 0.5) {
    insights.push('Brand mentioned in moderately relevant context');
  } else {
    insights.push('Brand mentioned with limited context relevance');
  }

  // 5. Competition Score (-0.5 to +0.2)
  let competitionScore = 0;
  if (metrics.competitorCount === 0) {
    competitionScore = 0.2; // Bonus for no competition
    insights.push('No competitors mentioned - dominant visibility');
  } else if (metrics.competitorCount <= 2) {
    competitionScore = 0.05;
    insights.push(`Limited competition (${metrics.competitorCount} competitors)`);
  } else if (metrics.competitorCount <= 5) {
    competitionScore = -0.1;
    insights.push(`Moderate competition (${metrics.competitorCount} competitors)`);
  } else {
    competitionScore = -0.5;
    insights.push(`Heavy competition (${metrics.competitorCount} competitors)`);
  }
  breakdown.competition = competitionScore * weights.competition;

  // Calculate total weighted score
  totalScore = Object.values(breakdown).reduce((sum, score) => sum + score, 0);
  
  // Normalize to 0-1 scale
  const normalizedScore = Math.max(0, Math.min(1, totalScore));

  return {
    overallScore: normalizedScore,
    breakdown,
    insights
  };
}

/**
 * Calculate brand prominence score based on position and frequency
 */
export function calculateBrandProminence(
  brandMentions: number,
  totalBrands: number,
  firstPosition: number,
  responseLength: number
): number {
  // Frequency component (0-0.5)
  const frequencyScore = Math.min(0.5, brandMentions / Math.max(1, totalBrands));
  
  // Position component (0-0.3) - earlier is better
  const maxPosition = Math.max(10, responseLength / 100);
  const positionScore = Math.max(0, 0.3 * (1 - firstPosition / maxPosition));
  
  // Density component (0-0.2) - more mentions per length
  const densityScore = Math.min(0.2, (brandMentions / Math.max(100, responseLength)) * 100);
  
  return frequencyScore + positionScore + densityScore;
}