/**
 * Structured logging for scan operations in edge functions
 * Provides consistent logging for daily scans and batch processing
 */

export interface ScanLogContext {
  scanId: string;
  orgId?: string;
  batchJobId?: string;
  provider?: string;
  promptId?: string;
  
  // Timing
  startTime?: number;
  duration?: number;
  
  // Counts
  totalPrompts?: number;
  processedPrompts?: number;
  failedPrompts?: number;
  totalProviders?: number;
  
  // Results
  responsesGenerated?: number;
  competitorsDetected?: number;
  brandsDetected?: number;
  
  // Errors
  errorType?: 'network' | 'rate-limit' | 'validation' | 'provider' | 'system';
  errorCode?: string;
}

export class ScanLogger {
  private context: ScanLogContext;
  
  constructor(scanId: string, baseContext: Partial<ScanLogContext> = {}) {
    this.context = {
      scanId,
      ...baseContext,
      startTime: Date.now()
    };
  }
  
  updateContext(updates: Partial<ScanLogContext>): void {
    this.context = { ...this.context, ...updates };
  }
  
  // Scan lifecycle events
  scanStarted(totalPrompts: number, totalProviders: number): void {
    this.updateContext({ totalPrompts, totalProviders });
    console.log(JSON.stringify({
      event: 'scan_started',
      level: 'info',
      message: `Daily scan started`,
      context: this.context,
      timestamp: new Date().toISOString()
    }));
  }
  
  batchCreated(batchJobId: string, promptCount: number): void {
    this.updateContext({ batchJobId });
    console.log(JSON.stringify({
      event: 'batch_created',
      level: 'info',
      message: `Batch job created for ${promptCount} prompts`,
      context: { ...this.context, promptCount },
      timestamp: new Date().toISOString()
    }));
  }
  
  providerProcessing(provider: string, promptCount: number): void {
    console.log(JSON.stringify({
      event: 'provider_processing',
      level: 'info',
      message: `Processing ${promptCount} prompts with ${provider}`,
      context: { ...this.context, provider, promptCount },
      timestamp: new Date().toISOString()
    }));
  }
  
  promptProcessed(promptId: string, provider: string, success: boolean, responseData?: any): void {
    const newProcessed = (this.context.processedPrompts || 0) + (success ? 1 : 0);
    const newFailed = (this.context.failedPrompts || 0) + (success ? 0 : 1);
    
    this.updateContext({
      processedPrompts: newProcessed,
      failedPrompts: newFailed
    });
    
    console.log(JSON.stringify({
      event: 'prompt_processed',
      level: success ? 'info' : 'warn',
      message: `Prompt ${success ? 'processed' : 'failed'} for ${provider}`,
      context: { ...this.context, promptId, provider },
      metadata: {
        success,
        ...(responseData && { responseData })
      },
      timestamp: new Date().toISOString()
    }));
  }
  
  competitorDetection(competitorCount: number, brandCount: number): void {
    const newCompetitors = (this.context.competitorsDetected || 0) + competitorCount;
    const newBrands = (this.context.brandsDetected || 0) + brandCount;
    
    this.updateContext({
      competitorsDetected: newCompetitors,
      brandsDetected: newBrands
    });
    
    console.log(JSON.stringify({
      event: 'competitor_detection',
      level: 'info',
      message: `Detected ${competitorCount} competitors, ${brandCount} brands`,
      context: this.context,
      timestamp: new Date().toISOString()
    }));
  }
  
  responseStored(promptId: string, provider: string, score: number): void {
    const newResponses = (this.context.responsesGenerated || 0) + 1;
    this.updateContext({ responsesGenerated: newResponses });
    
    console.log(JSON.stringify({
      event: 'response_stored',
      level: 'info',
      message: `Response stored with score ${score}`,
      context: { ...this.context, promptId, provider },
      metadata: { score },
      timestamp: new Date().toISOString()
    }));
  }
  
  scanCompleted(): void {
    const duration = Date.now() - (this.context.startTime || Date.now());
    this.updateContext({ duration });
    
    const successRate = this.context.totalPrompts 
      ? ((this.context.processedPrompts || 0) / this.context.totalPrompts * 100).toFixed(1)
      : '0';
    
    console.log(JSON.stringify({
      event: 'scan_completed',
      level: 'info',
      message: `Daily scan completed with ${successRate}% success rate`,
      context: this.context,
      metadata: {
        successRate: `${successRate}%`,
        durationMs: duration,
        summary: {
          total: this.context.totalPrompts,
          processed: this.context.processedPrompts,
          failed: this.context.failedPrompts,
          responses: this.context.responsesGenerated,
          competitors: this.context.competitorsDetected,
          brands: this.context.brandsDetected
        }
      },
      timestamp: new Date().toISOString()
    }));
  }
  
  scanFailed(error: Error, step?: string): void {
    const duration = Date.now() - (this.context.startTime || Date.now());
    
    console.log(JSON.stringify({
      event: 'scan_failed',
      level: 'error',
      message: `Daily scan failed${step ? ` at ${step}` : ''}: ${error.message}`,
      context: {
        ...this.context,
        duration,
        errorType: this.categorizeError(error),
        errorCode: error.name
      },
      metadata: {
        error: error.message,
        stack: error.stack,
        step
      },
      timestamp: new Date().toISOString()
    }));
  }
  
  // Provider-specific events
  rateLimitHit(provider: string, retryAfter?: number): void {
    console.log(JSON.stringify({
      event: 'rate_limit_hit',
      level: 'warn',
      message: `Rate limit hit for ${provider}`,
      context: { ...this.context, provider, errorType: 'rate-limit' },
      metadata: { retryAfter },
      timestamp: new Date().toISOString()
    }));
  }
  
  providerError(provider: string, error: Error): void {
    console.log(JSON.stringify({
      event: 'provider_error',
      level: 'error',
      message: `Provider ${provider} error: ${error.message}`,
      context: {
        ...this.context,
        provider,
        errorType: this.categorizeError(error)
      },
      metadata: { error: error.message },
      timestamp: new Date().toISOString()
    }));
  }
  
  // Performance monitoring
  performanceMetric(metric: string, value: number, unit: string): void {
    console.log(JSON.stringify({
      event: 'performance_metric',
      level: 'debug',
      message: `Performance: ${metric} = ${value}${unit}`,
      context: this.context,
      metadata: {
        metric,
        value,
        unit
      },
      timestamp: new Date().toISOString()
    }));
  }
  
  private categorizeError(error: Error): ScanLogContext['errorType'] {
    const message = error.message.toLowerCase();
    
    if (message.includes('rate limit') || message.includes('quota')) {
      return 'rate-limit';
    }
    if (message.includes('network') || message.includes('fetch') || message.includes('timeout')) {
      return 'network';
    }
    if (message.includes('validation') || message.includes('invalid')) {
      return 'validation';
    }
    if (message.includes('provider') || message.includes('api')) {
      return 'provider';
    }
    
    return 'system';
  }
}

// Factory function for creating scan loggers
export const createScanLogger = (scanId: string, context?: Partial<ScanLogContext>): ScanLogger => {
  return new ScanLogger(scanId, context);
};