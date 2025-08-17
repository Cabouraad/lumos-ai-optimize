/**
 * Enhanced visibility scoring algorithm with context awareness
 */

import type { BrandSentiment } from '../brand/sentiment';

export interface VisibilityMetrics {
  brandPresent: boolean;
  brandPosition: number | null;
  brandMentions: number;
  competitorCount: number;
  competitorMentions: number;
  sentiment: 'positive' | 'negative' | 'neutral';
  sentimentConfidence: number;
  context: 'recommendation' | 'comparison' | 'example' | 'mention';
  responseLength: number;
  brandProminence: number; // 0-1 score based on position and frequency
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
  presence: 0.3,    // Base score for being mentioned
  position: 0.2,    // Early mention bonus
  sentiment: 0.25,  // Positive/negative sentiment impact
  context: 0.1,     // Recommendation vs example context
  competition: 0.1, // Penalty for strong competitors
  prominence: 0.05  // Frequency and emphasis
};

/**
 * Enhanced visibility scoring with multi-factor analysis
 */
export function computeEnhancedVisibilityScore(
  metrics: VisibilityMetrics,
  weights: ScoringWeights = DEFAULT_WEIGHTS
): {
  score: number;
  breakdown: Record<string, number>;
  insights: string[];
} {
  const breakdown: Record<string, number> = {};
  const insights: string[] = [];
  let totalScore = 0;

  // 1. Presence Score (0-30 points)
  if (metrics.brandPresent) {
    breakdown.presence = 30 * weights.presence;
    insights.push('Brand is mentioned in the response');
  } else {
    breakdown.presence = 0;
    insights.push('Brand is not mentioned - major visibility issue');
    
    // Early return for absent brands with competitive penalty
    const competitionPenalty = Math.min(15, metrics.competitorCount * 3);
    breakdown.competition = -competitionPenalty * weights.competition;
    insights.push(`${metrics.competitorCount} competitors mentioned while brand is absent`);
    
    return {
      score: Math.max(0, breakdown.presence + breakdown.competition),
      breakdown,
      insights
    };
  }

  // 2. Position Score (0-20 points)
  if (metrics.brandPosition !== null) {
    const positionScore = Math.max(0, 20 - (metrics.brandPosition * 2));
    breakdown.position = positionScore * weights.position;
    
    if (metrics.brandPosition === 0) {
      insights.push('Brand mentioned first - excellent positioning');
    } else if (metrics.brandPosition <= 2) {
      insights.push(`Brand mentioned early (position ${metrics.brandPosition + 1}) - good positioning`);
    } else if (metrics.brandPosition <= 5) {
      insights.push(`Brand mentioned mid-response (position ${metrics.brandPosition + 1}) - average positioning`);
    } else {
      insights.push(`Brand mentioned late (position ${metrics.brandPosition + 1}) - poor positioning`);
    }
  } else {
    breakdown.position = 0;
  }

  // 3. Sentiment Score (-25 to +25 points)
  let sentimentScore = 0;
  switch (metrics.sentiment) {
    case 'positive':
      sentimentScore = 25 * metrics.sentimentConfidence;
      insights.push(`Positive brand sentiment (${(metrics.sentimentConfidence * 100).toFixed(0)}% confidence)`);
      break;
    case 'negative':
      sentimentScore = -25 * metrics.sentimentConfidence;
      insights.push(`Negative brand sentiment (${(metrics.sentimentConfidence * 100).toFixed(0)}% confidence)`);
      break;
    case 'neutral':
      sentimentScore = 5; // Small bonus for neutral mentions
      insights.push('Neutral brand sentiment');
      break;
  }
  breakdown.sentiment = sentimentScore * weights.sentiment;

  // 4. Context Score (0-10 points)
  let contextScore = 0;
  switch (metrics.context) {
    case 'recommendation':
      contextScore = 10;
      insights.push('Brand mentioned as a recommendation - excellent context');
      break;
    case 'comparison':
      contextScore = 7;
      insights.push('Brand mentioned in comparison - good context');
      break;
    case 'mention':
      contextScore = 5;
      insights.push('Brand mentioned in general context');
      break;
    case 'example':
      contextScore = 2;
      insights.push('Brand mentioned as example - limited value');
      break;
  }
  breakdown.context = contextScore * weights.context;

  // 5. Competition Score (-10 to +5 points)
  let competitionScore = 0;
  if (metrics.competitorCount === 0) {
    competitionScore = 5; // Bonus for no competition
    insights.push('No competitors mentioned - dominant visibility');
  } else if (metrics.competitorCount <= 2) {
    competitionScore = 2;
    insights.push(`Limited competition (${metrics.competitorCount} competitors)`);
  } else if (metrics.competitorCount <= 5) {
    competitionScore = -2;
    insights.push(`Moderate competition (${metrics.competitorCount} competitors)`);
  } else {
    competitionScore = -10;
    insights.push(`Heavy competition (${metrics.competitorCount} competitors)`);
  }
  breakdown.competition = competitionScore * weights.competition;

  // 6. Prominence Score (0-5 points) 
  const prominenceScore = Math.min(5, metrics.brandProminence * 5);
  breakdown.prominence = prominenceScore * weights.prominence;
  
  if (metrics.brandProminence > 0.7) {
    insights.push('Brand has high prominence in response');
  } else if (metrics.brandProminence > 0.4) {
    insights.push('Brand has moderate prominence in response');  
  } else {
    insights.push('Brand has low prominence in response');
  }

  // Calculate total weighted score
  totalScore = Object.values(breakdown).reduce((sum, score) => sum + score, 0);
  
  // Normalize to 0-100 scale
  const normalizedScore = Math.max(0, Math.min(100, totalScore));

  return {
    score: normalizedScore,
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

/**
 * Batch scoring for multiple brand analyses
 */
export function batchVisibilityScore(
  analyses: Array<{
    brand: string;
    metrics: VisibilityMetrics;
  }>,
  weights?: ScoringWeights
): Array<{
  brand: string;
  score: number;
  breakdown: Record<string, number>;
  insights: string[];
}> {
  return analyses.map(analysis => ({
    brand: analysis.brand,
    ...computeEnhancedVisibilityScore(analysis.metrics, weights)
  }));
}

/**
 * Generate competitive insights from multiple brand scores
 */
export function generateCompetitiveInsights(
  userBrand: string,
  scores: Array<{
    brand: string;
    score: number;
    breakdown: Record<string, number>;
    insights: string[];
  }>
): {
  userRank: number;
  userScore: number;
  topCompetitors: Array<{ brand: string; score: number; advantage: string }>;
  opportunities: string[];
  threats: string[];
} {
  // Sort by score descending
  const sortedScores = scores.sort((a, b) => b.score - a.score);
  
  const userResult = sortedScores.find(s => 
    s.brand.toLowerCase() === userBrand.toLowerCase()
  );
  
  const userRank = sortedScores.findIndex(s => 
    s.brand.toLowerCase() === userBrand.toLowerCase()
  ) + 1;
  
  const userScore = userResult?.score || 0;
  
  // Top competitors (excluding user brand)
  const topCompetitors = sortedScores
    .filter(s => s.brand.toLowerCase() !== userBrand.toLowerCase())
    .slice(0, 3)
    .map(competitor => ({
      brand: competitor.brand,
      score: competitor.score,
      advantage: getCompetitorAdvantage(competitor.breakdown)
    }));

  // Generate opportunities and threats
  const opportunities: string[] = [];
  const threats: string[] = [];
  
  if (userResult) {
    // Opportunities based on low-performing areas
    if (userResult.breakdown.sentiment < 5) {
      opportunities.push('Improve brand sentiment in AI responses');
    }
    if (userResult.breakdown.position < 3) {
      opportunities.push('Work on getting mentioned earlier in responses');
    }
    if (userResult.breakdown.context < 2) {
      opportunities.push('Position brand more strongly as a recommendation');
    }
  }
  
  // Threats from strong competitors
  topCompetitors.forEach(competitor => {
    if (competitor.score > userScore + 20) {
      threats.push(`${competitor.brand} has significantly higher visibility (${competitor.score.toFixed(1)} vs ${userScore.toFixed(1)})`);
    }
  });
  
  return {
    userRank,
    userScore,
    topCompetitors,
    opportunities,
    threats
  };
}

function getCompetitorAdvantage(breakdown: Record<string, number>): string {
  const maxCategory = Object.entries(breakdown).reduce((max, [category, score]) => {
    return score > max.score ? { category, score } : max;
  }, { category: '', score: -Infinity });
  
  switch (maxCategory.category) {
    case 'sentiment':
      return 'Strong positive sentiment';
    case 'position':
      return 'Early mention positioning';
    case 'context':
      return 'Recommended as solution';
    case 'prominence':
      return 'High response prominence';
    default:
      return 'Overall strong presence';
  }
}