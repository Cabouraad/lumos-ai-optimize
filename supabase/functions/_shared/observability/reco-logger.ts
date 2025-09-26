/**
 * Structured logging for recommendation generation in edge functions
 * Provides consistent logging for AI-powered recommendation workflows
 */

export interface RecoLogContext {
  recoId: string;
  orgId?: string;
  userId?: string;
  
  // Process context
  dataSourcesUsed?: string[];
  aiProvider?: string;
  
  // Timing
  startTime?: number;
  duration?: number;
  
  // Input data
  totalPrompts?: number;
  totalResponses?: number;
  analysisWindow?: string; // e.g., "7d", "30d"
  
  // Output data
  recommendationsGenerated?: number;
  recommendationsValidated?: number;
  recommendationsStored?: number;
  
  // Quality metrics
  confidenceScore?: number;
  relevanceScore?: number;
  
  // Errors
  errorType?: 'data-insufficient' | 'ai-service' | 'validation' | 'storage' | 'system';
  errorCode?: string;
}

export class RecoLogger {
  private context: RecoLogContext;
  
  constructor(recoId: string, baseContext: Partial<RecoLogContext> = {}) {
    this.context = {
      recoId,
      ...baseContext,
      startTime: Date.now()
    };
  }
  
  updateContext(updates: Partial<RecoLogContext>): void {
    this.context = { ...this.context, ...updates };
  }
  
  // Recommendation lifecycle events
  generationStarted(dataSourcesUsed: string[], analysisWindow: string): void {
    this.updateContext({ dataSourcesUsed, analysisWindow });
    
    console.log(JSON.stringify({
      event: 'reco_generation_started',
      level: 'info',
      message: `Recommendation generation started with ${dataSourcesUsed.length} data sources`,
      context: this.context,
      metadata: {
        dataSources: dataSourcesUsed,
        window: analysisWindow
      },
      timestamp: new Date().toISOString()
    }));
  }
  
  dataAnalysis(totalPrompts: number, totalResponses: number, trendsDetected: number): void {
    this.updateContext({ totalPrompts, totalResponses });
    
    console.log(JSON.stringify({
      event: 'reco_data_analysis',
      level: 'info',
      message: `Analyzed ${totalPrompts} prompts, ${totalResponses} responses, detected ${trendsDetected} trends`,
      context: this.context,
      metadata: {
        prompts: totalPrompts,
        responses: totalResponses,
        trends: trendsDetected
      },
      timestamp: new Date().toISOString()
    }));
  }
  
  aiGeneration(aiProvider: string, promptSent: string, tokensUsed?: number): void {
    this.updateContext({ aiProvider });
    
    console.log(JSON.stringify({
      event: 'reco_ai_generation',
      level: 'info',
      message: `AI generation using ${aiProvider}`,
      context: this.context,
      metadata: {
        provider: aiProvider,
        promptLength: promptSent.length,
        tokensUsed
      },
      timestamp: new Date().toISOString()
    }));
  }
  
  recommendationsGenerated(count: number, types: string[]): void {
    this.updateContext({ recommendationsGenerated: count });
    
    console.log(JSON.stringify({
      event: 'recommendations_generated',
      level: 'info',
      message: `Generated ${count} recommendations of types: ${types.join(', ')}`,
      context: this.context,
      metadata: {
        count,
        types,
        breakdown: types.reduce((acc, type) => {
          acc[type] = (acc[type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      },
      timestamp: new Date().toISOString()
    }));
  }
  
  qualityValidation(
    validatedCount: number,
    averageConfidence: number,
    averageRelevance: number,
    rejectedCount: number
  ): void {
    this.updateContext({
      recommendationsValidated: validatedCount,
      confidenceScore: averageConfidence,
      relevanceScore: averageRelevance
    });
    
    console.log(JSON.stringify({
      event: 'reco_quality_validation',
      level: 'info',
      message: `Validated ${validatedCount} recommendations, rejected ${rejectedCount}`,
      context: this.context,
      metadata: {
        validated: validatedCount,
        rejected: rejectedCount,
        avgConfidence: averageConfidence,
        avgRelevance: averageRelevance,
        qualityRate: `${((validatedCount / (validatedCount + rejectedCount)) * 100).toFixed(1)}%`
      },
      timestamp: new Date().toISOString()
    }));
  }
  
  recommendationStored(recommendationId: string, type: string, priority: string): void {
    const newStored = (this.context.recommendationsStored || 0) + 1;
    this.updateContext({ recommendationsStored: newStored });
    
    console.log(JSON.stringify({
      event: 'recommendation_stored',
      level: 'info',
      message: `Stored ${type} recommendation with ${priority} priority`,
      context: this.context,
      metadata: {
        recommendationId,
        type,
        priority,
        totalStored: newStored
      },
      timestamp: new Date().toISOString()
    }));
  }
  
  generationCompleted(): void {
    const duration = Date.now() - (this.context.startTime || Date.now());
    this.updateContext({ duration });
    
    const successRate = this.context.recommendationsGenerated
      ? ((this.context.recommendationsValidated || 0) / this.context.recommendationsGenerated * 100).toFixed(1)
      : '0';
    
    console.log(JSON.stringify({
      event: 'reco_generation_completed',
      level: 'info',
      message: `Recommendation generation completed with ${successRate}% validation rate`,
      context: this.context,
      metadata: {
        durationMs: duration,
        successRate: `${successRate}%`,
        summary: {
          generated: this.context.recommendationsGenerated,
          validated: this.context.recommendationsValidated,
          stored: this.context.recommendationsStored,
          avgConfidence: this.context.confidenceScore,
          avgRelevance: this.context.relevanceScore
        }
      },
      timestamp: new Date().toISOString()
    }));
  }
  
  generationFailed(error: unknown, step?: string): void {
    const duration = Date.now() - (this.context.startTime || Date.now());
    
    console.log(JSON.stringify({
      event: 'reco_generation_failed',
      level: 'error',
      message: `Recommendation generation failed${step ? ` at ${step}` : ''}: ${error instanceof Error ? error.message : String(error)}`,
      context: {
        ...this.context,
        duration,
        errorType: this.categorizeError(error),
        errorCode: error instanceof Error ? error.name : 'unknown'
      },
      metadata: {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        step
      },
      timestamp: new Date().toISOString()
    }));
  }
  
  // Data quality events
  insufficientData(dataType: string, required: number, available: number): void {
    console.log(JSON.stringify({
      event: 'insufficient_data',
      level: 'warn',
      message: `Insufficient ${dataType} data: ${available}/${required} required`,
      context: { ...this.context, errorType: 'data-insufficient' },
      metadata: {
        dataType,
        required,
        available,
        sufficiency: `${((available / required) * 100).toFixed(1)}%`
      },
      timestamp: new Date().toISOString()
    }));
  }
  
  // AI service events
  aiServiceError(provider: string, error: unknown, retryAttempt?: number): void {
    console.log(JSON.stringify({
      event: 'ai_service_error',
      level: 'error',
      message: `AI service ${provider} error: ${error instanceof Error ? error.message : String(error)}`,
      context: {
        ...this.context,
        aiProvider: provider,
        errorType: 'ai-service'
      },
      metadata: {
        error: error instanceof Error ? error.message : String(error),
        retryAttempt
      },
      timestamp: new Date().toISOString()
    }));
  }
  
  // Performance monitoring
  performanceMetric(operation: string, durationMs: number, itemsProcessed?: number): void {
    const throughput = itemsProcessed ? (itemsProcessed / (durationMs / 1000)).toFixed(2) : null;
    
    console.log(JSON.stringify({
      event: 'reco_performance_metric',
      level: 'debug',
      message: `Performance: ${operation} took ${durationMs}ms`,
      context: this.context,
      metadata: {
        operation,
        durationMs,
        itemsProcessed,
        ...(throughput ? { throughputPerSecond: throughput } : {})
      },
      timestamp: new Date().toISOString()
    }));
  }
  
  private categorizeError(error: unknown): RecoLogContext['errorType'] {
    const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
    
    if (message.includes('insufficient') || message.includes('no data') || message.includes('empty')) {
      return 'data-insufficient';
    }
    if (message.includes('ai') || message.includes('openai') || message.includes('gemini') || message.includes('api')) {
      return 'ai-service';
    }
    if (message.includes('validation') || message.includes('invalid') || message.includes('quality')) {
      return 'validation';
    }
    if (message.includes('storage') || message.includes('database') || message.includes('insert')) {
      return 'storage';
    }
    
    return 'system';
  }
}

// Factory function for creating recommendation loggers
export const createRecoLogger = (recoId: string, context?: Partial<RecoLogContext>): RecoLogger => {
  return new RecoLogger(recoId, context);
};