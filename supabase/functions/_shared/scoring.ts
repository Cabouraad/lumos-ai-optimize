/**
 * Unified scoring system (0-10 scale)
 */

export function computeVisibilityScore(
  orgPresent: boolean, 
  prominenceIdx: number | null, 
  competitorsCount: number
): number {
  if (!orgPresent) return 1;
  
  let score = 6; // Base score when org brand is present
  
  // Prominence bonus (earlier = better)
  if (prominenceIdx !== null) {
    if (prominenceIdx === 0) score += 3; // First position gets big bonus
    else if (prominenceIdx <= 2) score += 2; // Top 3 gets good bonus
    else if (prominenceIdx <= 5) score += 1; // Top 6 gets small bonus
  }
  
  // Competitor penalty (more competitors = lower visibility)
  if (competitorsCount > 8) score -= 2;
  else if (competitorsCount > 4) score -= 1;
  
  return Math.max(1, Math.min(10, score));
}

export function normalizeScoreTo100(score: number): number {
  return Math.round((score / 10) * 100);
}

export function normalizeScoreFrom100(score: number): number {
  return Math.round((score / 100) * 10);
}

export function getScoreThresholds() {
  return {
    excellent: 8,
    good: 6,
    fair: 4,
    poor: 2
  };
}