/**
 * Phase 2: Machine Learning Enhancement for Brand Analysis
 * Real-time learning from user feedback and automatic gazetteer updates
 */

interface BrandFeedback {
  extractedBrand: string;
  isCorrect: boolean;
  actualBrand?: string;
  context: string;
  confidence: number;
  timestamp: number;
}

interface LearningStats {
  totalFeedbacks: number;
  accuracyRate: number;
  commonMistakes: { pattern: string; count: number }[];
  improvementSuggestions: string[];
}

class BrandLearningEngine {
  private feedbackHistory: BrandFeedback[] = [];
  private learningPatterns: Map<string, number> = new Map();
  private falsePositivePatterns: Set<string> = new Set();
  private userCorrections: Map<string, string> = new Map();

  /**
   * Record user feedback on brand extraction accuracy
   */
  recordFeedback(feedback: BrandFeedback): void {
    this.feedbackHistory.push(feedback);
    
    // Learn from false positives
    if (!feedback.isCorrect) {
      this.falsePositivePatterns.add(feedback.extractedBrand.toLowerCase());
      
      // Track correction patterns
      if (feedback.actualBrand) {
        this.userCorrections.set(
          feedback.extractedBrand.toLowerCase(),
          feedback.actualBrand
        );
      }
    }
    
    // Update learning patterns
    const pattern = this.extractPattern(feedback.context, feedback.extractedBrand);
    const currentCount = this.learningPatterns.get(pattern) || 0;
    this.learningPatterns.set(pattern, currentCount + (feedback.isCorrect ? 1 : -1));
    
    // Limit history size for performance
    if (this.feedbackHistory.length > 1000) {
      this.feedbackHistory = this.feedbackHistory.slice(-800);
    }
  }

  /**
   * Get enhanced false positive filters based on learning
   */
  getLearnedFalsePositives(): string[] {
    const threshold = 3; // Minimum occurrences to consider
    const learnedPatterns: string[] = [];
    
    // Add patterns that consistently receive negative feedback
    for (const [pattern, score] of this.learningPatterns.entries()) {
      if (score <= -threshold) {
        learnedPatterns.push(pattern);
      }
    }
    
    return [...this.falsePositivePatterns, ...learnedPatterns];
  }

  /**
   * Get brand corrections learned from user feedback
   */
  getBrandCorrections(): Map<string, string> {
    return new Map(this.userCorrections);
  }

  /**
   * Calculate confidence adjustment based on learning
   */
  adjustConfidence(brandName: string, context: string, baseConfidence: number): number {
    const normalizedBrand = brandName.toLowerCase();
    let adjustment = 0;
    
    // Reduce confidence for known false positives
    if (this.falsePositivePatterns.has(normalizedBrand)) {
      adjustment -= 0.3;
    }
    
    // Check pattern-based learning
    const pattern = this.extractPattern(context, brandName);
    const patternScore = this.learningPatterns.get(pattern) || 0;
    adjustment += Math.min(0.2, Math.max(-0.2, patternScore * 0.05));
    
    return Math.max(0.1, Math.min(1.0, baseConfidence + adjustment));
  }

  /**
   * Generate automatic gazetteer updates
   */
  generateGazetteerUpdates(): { 
    addBrands: string[]; 
    removeBrands: string[]; 
    updateVariants: Map<string, string[]> 
  } {
    const addBrands: string[] = [];
    const removeBrands: string[] = [];
    const updateVariants = new Map<string, string[]>();
    
    // Analyze feedback for consistent corrections
    const correctionFrequency = new Map<string, number>();
    
    for (const feedback of this.feedbackHistory) {
      if (!feedback.isCorrect && feedback.actualBrand) {
        const key = `${feedback.extractedBrand}->${feedback.actualBrand}`;
        correctionFrequency.set(key, (correctionFrequency.get(key) || 0) + 1);
      }
    }
    
    // Suggest additions based on frequent corrections
    for (const [correction, count] of correctionFrequency.entries()) {
      if (count >= 3) { // Threshold for automatic updates
        const [extracted, actual] = correction.split('->');
        
        // Add as variant if it's a variation of existing brand
        if (!updateVariants.has(actual)) {
          updateVariants.set(actual, []);
        }
        updateVariants.get(actual)!.push(extracted);
      }
    }
    
    // Suggest removals for consistent false positives
    for (const brand of this.falsePositivePatterns) {
      const negativeCount = this.feedbackHistory.filter(
        f => f.extractedBrand.toLowerCase() === brand && !f.isCorrect
      ).length;
      
      if (negativeCount >= 5) {
        removeBrands.push(brand);
      }
    }
    
    return { addBrands, removeBrands, updateVariants };
  }

  /**
   * Get learning statistics for monitoring
   */
  getStats(): LearningStats {
    const totalFeedbacks = this.feedbackHistory.length;
    const correctCount = this.feedbackHistory.filter(f => f.isCorrect).length;
    const accuracyRate = totalFeedbacks > 0 ? correctCount / totalFeedbacks : 0;
    
    // Find common mistake patterns
    const mistakePatterns = new Map<string, number>();
    
    for (const feedback of this.feedbackHistory) {
      if (!feedback.isCorrect) {
        const pattern = this.extractPattern(feedback.context, feedback.extractedBrand);
        mistakePatterns.set(pattern, (mistakePatterns.get(pattern) || 0) + 1);
      }
    }
    
    const commonMistakes = Array.from(mistakePatterns.entries())
      .map(([pattern, count]) => ({ pattern, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    
    // Generate improvement suggestions
    const improvementSuggestions = this.generateImprovementSuggestions(commonMistakes);
    
    return {
      totalFeedbacks,
      accuracyRate,
      commonMistakes,
      improvementSuggestions
    };
  }

  private extractPattern(context: string, brand: string): string {
    const brandIndex = context.toLowerCase().indexOf(brand.toLowerCase());
    if (brandIndex === -1) return 'unknown-context';
    
    const beforeContext = context.slice(Math.max(0, brandIndex - 20), brandIndex).trim();
    const afterContext = context.slice(brandIndex + brand.length, brandIndex + brand.length + 20).trim();
    
    return `${beforeContext}|${brand}|${afterContext}`.toLowerCase();
  }

  private generateImprovementSuggestions(mistakes: { pattern: string; count: number }[]): string[] {
    const suggestions: string[] = [];
    
    for (const mistake of mistakes) {
      if (mistake.pattern.includes('for example') || mistake.pattern.includes('such as')) {
        suggestions.push('Improve example context detection to reduce false positives');
      } else if (mistake.pattern.includes('like') || mistake.pattern.includes('similar')) {
        suggestions.push('Enhance comparison context filtering');
      } else if (mistake.count > 10) {
        suggestions.push(`High-frequency error pattern detected: ${mistake.pattern.slice(0, 50)}...`);
      }
    }
    
    return suggestions;
  }
}

// Singleton instance
export const brandLearningEngine = new BrandLearningEngine();

// User feedback collection hook
export interface UseFeedbackCollector {
  recordBrandFeedback: (brandName: string, isCorrect: boolean, actualBrand?: string, context?: string) => void;
  getAccuracyStats: () => LearningStats;
}

export function useBrandFeedbackCollector(): UseFeedbackCollector {
  const recordBrandFeedback = (
    brandName: string, 
    isCorrect: boolean, 
    actualBrand?: string, 
    context: string = ''
  ) => {
    brandLearningEngine.recordFeedback({
      extractedBrand: brandName,
      isCorrect,
      actualBrand,
      context,
      confidence: 1.0, // Default confidence for user feedback
      timestamp: Date.now()
    });
  };

  const getAccuracyStats = (): LearningStats => {
    return brandLearningEngine.getStats();
  };

  return {
    recordBrandFeedback,
    getAccuracyStats
  };
}