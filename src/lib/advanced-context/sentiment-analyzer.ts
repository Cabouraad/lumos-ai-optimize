/**
 * Phase 3: Advanced Context Analysis - Sentiment Analysis and Position Weighting
 */

export interface SentimentAnalysis {
  sentiment: 'positive' | 'negative' | 'neutral';
  confidence: number;
  emotionScores: {
    joy: number;
    trust: number;
    fear: number;
    surprise: number;
    sadness: number;
    disgust: number;
    anger: number;
    anticipation: number;
  };
}

export interface PositionWeighting {
  positionScore: number;
  sectionType: 'title' | 'header' | 'body' | 'footer' | 'sidebar' | 'list';
  importance: 'high' | 'medium' | 'low';
  contextualRelevance: number;
}

class AdvancedSentimentAnalyzer {
  private positiveWords = new Set([
    'excellent', 'amazing', 'outstanding', 'superior', 'best', 'great', 'wonderful',
    'fantastic', 'impressive', 'remarkable', 'exceptional', 'perfect', 'brilliant',
    'innovative', 'leading', 'top', 'premier', 'recommend', 'love', 'prefer'
  ]);

  private negativeWords = new Set([
    'terrible', 'awful', 'horrible', 'bad', 'worst', 'disappointing', 'poor',
    'inferior', 'lacking', 'inadequate', 'problematic', 'failed', 'broken',
    'buggy', 'slow', 'expensive', 'overpriced', 'avoid', 'hate', 'dislike'
  ]);

  private emotionKeywords = {
    joy: ['happy', 'pleased', 'delighted', 'satisfied', 'enjoy', 'love', 'great'],
    trust: ['reliable', 'dependable', 'secure', 'safe', 'trusted', 'proven', 'stable'],
    fear: ['worried', 'concerned', 'anxious', 'risk', 'dangerous', 'unsafe', 'uncertain'],
    surprise: ['amazing', 'incredible', 'unexpected', 'shocking', 'wow', 'surprising'],
    sadness: ['disappointed', 'sad', 'unfortunate', 'regret', 'missed', 'lost'],
    disgust: ['disgusting', 'repulsive', 'awful', 'horrible', 'gross', 'unacceptable'],
    anger: ['angry', 'frustrated', 'furious', 'outraged', 'annoyed', 'mad'],
    anticipation: ['excited', 'looking forward', 'eager', 'anticipate', 'expect', 'hope']
  };

  analyzeSentiment(text: string, brandContext: string): SentimentAnalysis {
    const normalizedText = text.toLowerCase();
    const brandIndex = normalizedText.indexOf(brandContext.toLowerCase());
    
    // Extract context around the brand mention (±50 characters)
    const contextStart = Math.max(0, brandIndex - 50);
    const contextEnd = Math.min(text.length, brandIndex + brandContext.length + 50);
    const context = normalizedText.slice(contextStart, contextEnd);

    let positiveScore = 0;
    let negativeScore = 0;

    // Calculate sentiment scores based on keywords
    const words = context.split(/\s+/);
    
    for (const word of words) {
      const cleanWord = word.replace(/[^\w]/g, '');
      if (this.positiveWords.has(cleanWord)) {
        positiveScore += 1;
      }
      if (this.negativeWords.has(cleanWord)) {
        negativeScore += 1;
      }
    }

    // Calculate emotion scores
    const emotionScores = {
      joy: 0, trust: 0, fear: 0, surprise: 0,
      sadness: 0, disgust: 0, anger: 0, anticipation: 0
    };

    for (const [emotion, keywords] of Object.entries(this.emotionKeywords)) {
      for (const keyword of keywords) {
        if (context.includes(keyword)) {
          emotionScores[emotion as keyof typeof emotionScores] += 1;
        }
      }
    }

    // Normalize emotion scores
    const totalEmotions = Object.values(emotionScores).reduce((sum, score) => sum + score, 0);
    if (totalEmotions > 0) {
      for (const emotion in emotionScores) {
        emotionScores[emotion as keyof typeof emotionScores] /= totalEmotions;
      }
    }

    // Determine overall sentiment
    let sentiment: 'positive' | 'negative' | 'neutral';
    let confidence: number;

    if (positiveScore > negativeScore) {
      sentiment = 'positive';
      confidence = Math.min(0.95, 0.5 + (positiveScore - negativeScore) * 0.1);
    } else if (negativeScore > positiveScore) {
      sentiment = 'negative';
      confidence = Math.min(0.95, 0.5 + (negativeScore - positiveScore) * 0.1);
    } else {
      sentiment = 'neutral';
      confidence = 0.3 + Math.random() * 0.2; // Low confidence for neutral
    }

    return {
      sentiment,
      confidence,
      emotionScores
    };
  }
}

class PositionAnalyzer {
  private sectionPatterns = {
    title: /^.{0,100}$/m, // First 100 characters likely title/header
    header: /(^|\n)(#{1,6}|<h[1-6]|## |### )/gm,
    footer: /.{0,200}$/s, // Last 200 characters
    list: /(^|\n)(\*|\d+\.|-|•)/gm,
    sidebar: /(aside|sidebar|nav|menu)/gi
  };

  analyzePosition(text: string, brandPosition: number, brandName: string): PositionWeighting {
    const textLength = text.length;
    const relativePosition = brandPosition / textLength;
    
    // Determine section type based on position and patterns
    let sectionType: PositionWeighting['sectionType'] = 'body';
    
    if (relativePosition < 0.1) {
      sectionType = 'title';
    } else if (relativePosition > 0.9) {
      sectionType = 'footer';
    } else {
      // Check for specific patterns
      const contextBefore = text.slice(Math.max(0, brandPosition - 100), brandPosition);
      const contextAfter = text.slice(brandPosition, brandPosition + 100);
      const fullContext = contextBefore + brandName + contextAfter;

      if (this.sectionPatterns.header.test(contextBefore)) {
        sectionType = 'header';
      } else if (this.sectionPatterns.list.test(contextBefore)) {
        sectionType = 'list';
      } else if (this.sectionPatterns.sidebar.test(fullContext)) {
        sectionType = 'sidebar';
      }
    }

    // Calculate position score (earlier positions score higher)
    const positionScore = Math.max(0.1, 1 - relativePosition);
    
    // Determine importance based on section type
    const importanceMap: Record<PositionWeighting['sectionType'], PositionWeighting['importance']> = {
      title: 'high',
      header: 'high',
      body: 'medium',
      list: 'medium',
      sidebar: 'low',
      footer: 'low'
    };

    const importance = importanceMap[sectionType];

    // Calculate contextual relevance
    const contextualRelevance = this.calculateContextualRelevance(
      text, brandPosition, brandName, sectionType
    );

    return {
      positionScore,
      sectionType,
      importance,
      contextualRelevance
    };
  }

  private calculateContextualRelevance(
    text: string, 
    brandPosition: number, 
    brandName: string,
    sectionType: PositionWeighting['sectionType']
  ): number {
    const contextWindow = 200;
    const startPos = Math.max(0, brandPosition - contextWindow);
    const endPos = Math.min(text.length, brandPosition + brandName.length + contextWindow);
    const context = text.slice(startPos, endPos).toLowerCase();

    let relevanceScore = 0.5; // Base relevance

    // Business context indicators increase relevance
    const businessKeywords = [
      'company', 'service', 'platform', 'solution', 'software', 'tool',
      'provider', 'vendor', 'business', 'enterprise', 'startup'
    ];

    for (const keyword of businessKeywords) {
      if (context.includes(keyword)) {
        relevanceScore += 0.1;
      }
    }

    // Competitive context indicators
    const competitiveKeywords = [
      'competitor', 'alternative', 'versus', 'compared', 'choice', 'option',
      'better', 'best', 'leading', 'top', 'recommend'
    ];

    for (const keyword of competitiveKeywords) {
      if (context.includes(keyword)) {
        relevanceScore += 0.15;
      }
    }

    // Section-specific adjustments
    switch (sectionType) {
      case 'title':
      case 'header':
        relevanceScore += 0.2; // Titles are highly relevant
        break;
      case 'footer':
        relevanceScore -= 0.1; // Footers are less relevant
        break;
      case 'sidebar':
        relevanceScore -= 0.15; // Sidebars are contextually less important
        break;
    }

    return Math.max(0.1, Math.min(1.0, relevanceScore));
  }
}

// Singleton instances
export const sentimentAnalyzer = new AdvancedSentimentAnalyzer();
export const positionAnalyzer = new PositionAnalyzer();

// Enhanced visibility scoring that incorporates sentiment and position
export function calculateEnhancedVisibilityScore(
  orgBrands: Array<{ name: string; mentions: number; firstPosition: number; confidence: number }>,
  competitors: Array<{ name: string; mentions: number; firstPosition: number; confidence: number }>,
  responseText: string,
  includeSentimentAnalysis: boolean = true
): {
  score: number;
  breakdown: {
    presence: number;
    position: number;
    sentiment: number;
    prominence: number;
    competition: number;
  };
  confidence: number;
} {
  const orgBrandPresent = orgBrands.length > 0;
  const competitorCount = competitors.length;
  
  let breakdown = {
    presence: 0,
    position: 0,
    sentiment: 0,
    prominence: 0,
    competition: 0
  };
  
  let totalConfidence = 0.5;

  if (orgBrandPresent) {
    const primaryBrand = orgBrands[0]; // Use first/most confident brand
    
    // 1. Presence Score (25%)
    breakdown.presence = 2.5;
    
    // 2. Position Score (25%)
    const positionAnalysis = positionAnalyzer.analyzePosition(
      responseText, 
      primaryBrand.firstPosition, 
      primaryBrand.name
    );
    breakdown.position = positionAnalysis.positionScore * 2.5;
    
    // 3. Sentiment Score (20%) - only if enabled
    if (includeSentimentAnalysis) {
      const brandContext = responseText.slice(
        Math.max(0, primaryBrand.firstPosition - 50),
        primaryBrand.firstPosition + primaryBrand.name.length + 50
      );
      
      const sentimentAnalysis = sentimentAnalyzer.analyzeSentiment(responseText, brandContext);
      
      let sentimentMultiplier = 1.0;
      if (sentimentAnalysis.sentiment === 'positive') {
        sentimentMultiplier = 1.0 + (sentimentAnalysis.confidence * 0.5);
      } else if (sentimentAnalysis.sentiment === 'negative') {
        sentimentMultiplier = 1.0 - (sentimentAnalysis.confidence * 0.3);
      }
      
      breakdown.sentiment = 2.0 * sentimentMultiplier;
    } else {
      breakdown.sentiment = 2.0; // Neutral score when sentiment analysis is disabled
    }
    
    // 4. Prominence Score (20%)
    const avgConfidence = orgBrands.reduce((sum, b) => sum + b.confidence, 0) / orgBrands.length;
    const totalMentions = orgBrands.reduce((sum, b) => sum + b.mentions, 0);
    breakdown.prominence = Math.min(2.0, (avgConfidence + Math.min(1, totalMentions / 3)) * 1.0);
    
    // 5. Competition Impact (10%)
    const competitionPenalty = Math.min(1.0, competitorCount * 0.15);
    breakdown.competition = 1.0 - competitionPenalty;
    
    // Calculate overall confidence
    totalConfidence = Math.min(0.95, avgConfidence + (totalMentions > 1 ? 0.1 : 0));
    if (includeSentimentAnalysis) {
      totalConfidence += 0.05; // Slight boost for enhanced analysis
    }
  }

  const totalScore = Object.values(breakdown).reduce((sum, score) => sum + score, 0);
  
  return {
    score: Math.max(0, Math.min(10, Math.round(totalScore * 10) / 10)),
    breakdown,
    confidence: Math.round(totalConfidence * 100) / 100
  };
}