/**
 * Brand mention sentiment and context analysis
 */

export interface BrandSentiment {
  brand: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  confidence: number;
  context: 'recommendation' | 'comparison' | 'example' | 'mention';
  reasoning: string;
}

/**
 * Analyze sentiment and context of brand mentions
 */
export function analyzeBrandSentiment(
  brand: string,
  context: string,
  fullResponse: string
): BrandSentiment {
  const contextLower = context.toLowerCase();
  const brandLower = brand.toLowerCase();
  
  // Extract sentence containing the brand
  const sentences = fullResponse.split(/[.!?]+/);
  const relevantSentence = sentences.find(s => 
    s.toLowerCase().includes(brandLower)
  )?.trim() || context;
  
  const sentiment = calculateSentiment(relevantSentence, brandLower);
  const contextType = determineContextType(contextLower, relevantSentence.toLowerCase());
  
  return {
    brand,
    sentiment: sentiment.polarity,
    confidence: sentiment.confidence,
    context: contextType,
    reasoning: sentiment.reasoning
  };
}

/**
 * Calculate sentiment polarity and confidence
 */
function calculateSentiment(
  text: string, 
  brand: string
): { polarity: 'positive' | 'negative' | 'neutral'; confidence: number; reasoning: string } {
  const textLower = text.toLowerCase();
  
  // Positive indicators
  const positiveWords = [
    'recommend', 'excellent', 'best', 'great', 'outstanding', 'superior',
    'top', 'leading', 'preferred', 'ideal', 'perfect', 'amazing',
    'love', 'fantastic', 'wonderful', 'impressive', 'innovative',
    'should use', 'highly rated', 'popular choice', 'go-to solution'
  ];
  
  const positivePatterns = [
    `${brand} is excellent`,
    `${brand} offers`,
    `${brand} provides`,
    `choose ${brand}`,
    `use ${brand}`,
    `try ${brand}`,
    `${brand} stands out`,
    `${brand} excels`
  ];
  
  // Negative indicators
  const negativeWords = [
    'avoid', 'terrible', 'bad', 'poor', 'worst', 'disappointing',
    'problematic', 'issues', 'concerns', 'limitations', 'drawbacks',
    'outdated', 'deprecated', 'discontinued', 'not recommend',
    'stay away', 'skip', 'pass on'
  ];
  
  const negativePatterns = [
    `avoid ${brand}`,
    `${brand} is bad`,
    `${brand} has issues`,
    `problems with ${brand}`,
    `${brand} lacks`,
    `not ${brand}`,
    `instead of ${brand}`
  ];
  
  // Check for positive indicators
  const positiveScore = positiveWords.reduce((score, word) => 
    score + (textLower.includes(word) ? 1 : 0), 0
  ) + positivePatterns.reduce((score, pattern) => 
    score + (textLower.includes(pattern) ? 2 : 0), 0
  );
  
  // Check for negative indicators
  const negativeScore = negativeWords.reduce((score, word) => 
    score + (textLower.includes(word) ? 1 : 0), 0
  ) + negativePatterns.reduce((score, pattern) => 
    score + (textLower.includes(pattern) ? 2 : 0), 0
  );
  
  // Handle negations
  const negationPattern = /\b(not|n't|never|no)\s+\w*\s*(recommend|suggest|good|great|excellent|best)/i;
  if (negationPattern.test(textLower)) {
    const negativeAdjustment = 2;
    return {
      polarity: 'negative',
      confidence: Math.min(0.8, negativeAdjustment * 0.3),
      reasoning: 'Negation detected in positive context'
    };
  }
  
  // Calculate final sentiment
  if (positiveScore > negativeScore && positiveScore > 0) {
    return {
      polarity: 'positive',
      confidence: Math.min(0.9, positiveScore * 0.2),
      reasoning: `Positive indicators: ${positiveScore}, Negative: ${negativeScore}`
    };
  } else if (negativeScore > positiveScore && negativeScore > 0) {
    return {
      polarity: 'negative', 
      confidence: Math.min(0.9, negativeScore * 0.2),
      reasoning: `Negative indicators: ${negativeScore}, Positive: ${positiveScore}`
    };
  }
  
  return {
    polarity: 'neutral',
    confidence: 0.5,
    reasoning: `Balanced or no clear sentiment indicators (P:${positiveScore}, N:${negativeScore})`
  };
}

/**
 * Determine the context type of the brand mention
 */
function determineContextType(
  context: string, 
  sentence: string
): 'recommendation' | 'comparison' | 'example' | 'mention' {
  
  // Recommendation indicators
  const recommendationPatterns = [
    'recommend', 'suggest', 'should use', 'try', 'choose',
    'go with', 'opt for', 'pick', 'select', 'best option',
    'top choice', 'ideal solution'
  ];
  
  if (recommendationPatterns.some(pattern => context.includes(pattern) || sentence.includes(pattern))) {
    return 'recommendation';
  }
  
  // Comparison indicators
  const comparisonPatterns = [
    'vs', 'versus', 'compared to', 'compare', 'against',
    'better than', 'worse than', 'similar to', 'like',
    'alternative to', 'instead of', 'rather than'
  ];
  
  if (comparisonPatterns.some(pattern => context.includes(pattern) || sentence.includes(pattern))) {
    return 'comparison';
  }
  
  // Example indicators
  const examplePatterns = [
    'for example', 'such as', 'e.g.', 'i.e.', 'including',
    'like apple', 'like google', 'examples include',
    'among others', 'to name a few'
  ];
  
  if (examplePatterns.some(pattern => context.includes(pattern) || sentence.includes(pattern))) {
    return 'example';
  }
  
  return 'mention';
}

/**
 * Filter brands based on sentiment analysis
 */
export function filterBrandsBySentiment(
  brandSentiments: BrandSentiment[],
  includeNeutral: boolean = true
): BrandSentiment[] {
  return brandSentiments.filter(brand => {
    // Always include positive mentions
    if (brand.sentiment === 'positive') return true;
    
    // Include neutral mentions if specified and confidence is reasonable
    if (includeNeutral && brand.sentiment === 'neutral' && brand.confidence >= 0.4) {
      return true;
    }
    
    // Include negative mentions only if they're in comparison context
    // (useful to know what competitors are mentioned negatively)
    if (brand.sentiment === 'negative' && brand.context === 'comparison') {
      return true;
    }
    
    return false;
  });
}

/**
 * Analyze competitive positioning based on sentiment
 */
export function analyzeCompetitivePositioning(
  userBrand: string,
  competitorSentiments: BrandSentiment[]
): {
  userAdvantages: string[];
  userWeaknesses: string[];
  competitorStrengths: { brand: string; strength: string }[];
  competitorWeaknesses: { brand: string; weakness: string }[];
} {
  const userAdvantages: string[] = [];
  const userWeaknesses: string[] = [];
  const competitorStrengths: { brand: string; strength: string }[] = [];
  const competitorWeaknesses: { brand: string; weakness: string }[] = [];
  
  const userSentiment = competitorSentiments.find(s => 
    s.brand.toLowerCase() === userBrand.toLowerCase()
  );
  
  if (userSentiment) {
    if (userSentiment.sentiment === 'positive') {
      userAdvantages.push(userSentiment.reasoning);
    } else if (userSentiment.sentiment === 'negative') {
      userWeaknesses.push(userSentiment.reasoning);
    }
  }
  
  for (const sentiment of competitorSentiments) {
    if (sentiment.brand.toLowerCase() === userBrand.toLowerCase()) continue;
    
    if (sentiment.sentiment === 'positive' && sentiment.confidence > 0.6) {
      competitorStrengths.push({
        brand: sentiment.brand,
        strength: sentiment.reasoning
      });
    } else if (sentiment.sentiment === 'negative' && sentiment.confidence > 0.6) {
      competitorWeaknesses.push({
        brand: sentiment.brand,
        weakness: sentiment.reasoning
      });
    }
  }
  
  return {
    userAdvantages,
    userWeaknesses,
    competitorStrengths,
    competitorWeaknesses
  };
}