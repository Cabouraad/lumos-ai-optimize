/**
 * Visibility scoring algorithm
 */

export function computeScore(
  orgPresent: boolean, 
  prominenceIdx: number | null, 
  competitorsCount: number
): number {
  let score = orgPresent ? 100 : 0;
  
  // Prominence bonus by top-4 position: 0,10,20,30
  if (orgPresent && prominenceIdx !== null) {
    const bonus = [30, 20, 10, 0][Math.min(prominenceIdx, 3)] ?? 0; // idx 0 => 30
    score = Math.min(100, score + bonus);
  }
  
  // Competitor pressure: -5 per competitor, cap -20
  score = Math.max(0, score - Math.min(20, competitorsCount * 5));
  
  return score;
}