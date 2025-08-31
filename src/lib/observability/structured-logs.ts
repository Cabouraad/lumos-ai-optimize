/**
 * Structured logging system for critical flows and performance monitoring
 * Provides consistent logging across the application with metadata context
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'audit';

export interface LogContext {
  // Core context
  userId?: string;
  orgId?: string;
  sessionId?: string;
  
  // Performance context
  duration?: number;
  startTime?: number;
  endTime?: number;
  
  // Flow context
  flowType?: 'scan' | 'recommendation' | 'competitor-detection' | 'auth' | 'billing';
  stepName?: string;
  
  // Data context
  counts?: {
    prompts?: number;
    responses?: number;
    competitors?: number;
    recommendations?: number;
  };
  
  // Error context
  errorCode?: string;
  errorCategory?: 'network' | 'validation' | 'permission' | 'rate-limit' | 'system';
}

export interface StructuredLog {
  timestamp: string;
  level: LogLevel;
  message: string;
  context: LogContext;
  metadata?: Record<string, any>;
}

class StructuredLogger {
  private context: LogContext = {};
  
  constructor(initialContext: LogContext = {}) {
    this.context = { ...initialContext };
  }
  
  // Update context for subsequent logs
  updateContext(context: Partial<LogContext>): void {
    this.context = { ...this.context, ...context };
  }
  
  // Create a new logger with additional context
  withContext(context: LogContext): StructuredLogger {
    return new StructuredLogger({ ...this.context, ...context });
  }
  
  private log(level: LogLevel, message: string, additionalContext?: LogContext, metadata?: Record<string, any>): void {
    const logEntry: StructuredLog = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: { ...this.context, ...additionalContext },
      metadata
    };
    
    // In development, log to console with nice formatting
    if (import.meta.env?.DEV) {
      const emoji = this.getLevelEmoji(level);
      const contextStr = Object.keys(logEntry.context).length > 0 
        ? ` [${Object.entries(logEntry.context).map(([k, v]) => `${k}:${v}`).join(', ')}]`
        : '';
      
      console.log(`${emoji} ${logEntry.message}${contextStr}`, logEntry.metadata || '');
    }
    
    // In production, could send to external logging service
    // TODO: Integrate with structured logging service (e.g., LogTail, DataDog)
  }
  
  private getLevelEmoji(level: LogLevel): string {
    const emojis = {
      debug: '🔍',
      info: 'ℹ️',
      warn: '⚠️',
      error: '❌',
      audit: '📋'
    };
    return emojis[level];
  }
  
  debug(message: string, context?: LogContext, metadata?: Record<string, any>): void {
    this.log('debug', message, context, metadata);
  }
  
  info(message: string, context?: LogContext, metadata?: Record<string, any>): void {
    this.log('info', message, context, metadata);
  }
  
  warn(message: string, context?: LogContext, metadata?: Record<string, any>): void {
    this.log('warn', message, context, metadata);
  }
  
  error(message: string, context?: LogContext, metadata?: Record<string, any>): void {
    this.log('error', message, context, metadata);
  }
  
  audit(action: string, context?: LogContext, metadata?: Record<string, any>): void {
    this.log('audit', `Audit: ${action}`, context, metadata);
  }
  
  // Specialized logging methods for common patterns
  
  flowStart(flowType: LogContext['flowType'], stepName: string, context?: LogContext): void {
    this.info(`${flowType} flow started: ${stepName}`, {
      ...context,
      flowType,
      stepName,
      startTime: Date.now()
    });
  }
  
  flowEnd(flowType: LogContext['flowType'], stepName: string, context?: LogContext): void {
    const duration = context?.startTime ? Date.now() - context.startTime : undefined;
    this.info(`${flowType} flow completed: ${stepName}`, {
      ...context,
      flowType,
      stepName,
      duration,
      endTime: Date.now()
    });
  }
  
  flowError(flowType: LogContext['flowType'], stepName: string, error: Error, context?: LogContext): void {
    this.error(`${flowType} flow failed: ${stepName} - ${error.message}`, {
      ...context,
      flowType,
      stepName,
      errorCode: error.name,
      errorCategory: this.categorizeError(error)
    }, {
      stack: error.stack,
      errorDetails: error
    });
  }
  
  scanEvent(event: 'start' | 'batch-created' | 'provider-response' | 'completed' | 'failed', context?: LogContext): void {
    this.info(`Daily scan ${event}`, {
      ...context,
      flowType: 'scan',
      stepName: event
    });
  }
  
  competitorDetection(event: 'start' | 'candidates-found' | 'validated' | 'stored', count?: number, context?: LogContext): void {
    this.info(`Competitor detection ${event}${count ? ` (${count} items)` : ''}`, {
      ...context,
      flowType: 'competitor-detection',
      stepName: event,
      counts: { competitors: count }
    });
  }
  
  recommendationEvent(event: 'generated' | 'validated' | 'stored' | 'presented', count?: number, context?: LogContext): void {
    this.info(`Recommendation ${event}${count ? ` (${count} items)` : ''}`, {
      ...context,
      flowType: 'recommendation',
      stepName: event,
      counts: { recommendations: count }
    });
  }
  
  private categorizeError(error: Error): LogContext['errorCategory'] {
    const message = error.message.toLowerCase();
    
    if (message.includes('network') || message.includes('fetch') || message.includes('timeout')) {
      return 'network';
    }
    if (message.includes('validation') || message.includes('invalid') || message.includes('required')) {
      return 'validation';
    }
    if (message.includes('permission') || message.includes('unauthorized') || message.includes('forbidden')) {
      return 'permission';
    }
    if (message.includes('rate limit') || message.includes('quota') || message.includes('throttle')) {
      return 'rate-limit';
    }
    
    return 'system';
  }
}

// Create default logger instance
export const logger = new StructuredLogger();

// Factory function for creating contextual loggers
export const createLogger = (context: LogContext): StructuredLogger => {
  return new StructuredLogger(context);
};

// Performance timing helper
export const withTiming = async <T>(
  operation: () => Promise<T>,
  operationName: string,
  context?: LogContext
): Promise<T> => {
  const startTime = Date.now();
  const contextualLogger = logger.withContext({ ...context, startTime });
  
  try {
    contextualLogger.debug(`Starting ${operationName}`);
    const result = await operation();
    const duration = Date.now() - startTime;
    
    contextualLogger.info(`Completed ${operationName}`, { duration });
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    contextualLogger.error(`Failed ${operationName}`, { duration }, { error });
    throw error;
  }
};

// Batch operation logger
export const logBatchOperation = (
  operationType: string,
  totalItems: number,
  processedItems: number,
  failedItems: number,
  context?: LogContext
): void => {
  logger.info(`Batch ${operationType} summary`, {
    ...context,
    counts: {
      prompts: totalItems,
      responses: processedItems
    }
  }, {
    total: totalItems,
    processed: processedItems,
    failed: failedItems,
    successRate: `${((processedItems / totalItems) * 100).toFixed(1)}%`
  });
};