/**
 * Structured logging for Supabase Edge Functions
 * Provides consistent, searchable logs for observability
 */

export interface EdgeFunctionLogContext {
  functionName: string;
  requestId?: string;
  userId?: string;
  orgId?: string;
  duration?: number;
  metadata?: Record<string, unknown>;
}

export type EdgeLogLevel = 'debug' | 'info' | 'warn' | 'error' | 'audit';

export interface StructuredEdgeLog {
  timestamp: string;
  level: EdgeLogLevel;
  message: string;
  context: EdgeFunctionLogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

class EdgeFunctionLogger {
  private requestId: string;
  
  constructor(functionName: string, requestId?: string) {
    this.requestId = requestId || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Log function start
    this.info('Edge function started', {
      functionName,
      requestId: this.requestId,
    });
  }

  private formatLog(
    level: EdgeLogLevel, 
    message: string, 
    context: Partial<EdgeFunctionLogContext> = {}
  ): StructuredEdgeLog {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: {
        ...context,
        requestId: this.requestId,
      },
    };
  }

  private output(logData: StructuredEdgeLog): void {
    // Edge Functions use console.log for structured logging
    console.log(JSON.stringify(logData));
  }

  debug(message: string, context?: Partial<EdgeFunctionLogContext>): void {
    this.output(this.formatLog('debug', message, context));
  }

  info(message: string, context?: Partial<EdgeFunctionLogContext>): void {
    this.output(this.formatLog('info', message, context));
  }

  warn(message: string, context?: Partial<EdgeFunctionLogContext>): void {
    this.output(this.formatLog('warn', message, context));
  }

  error(message: string, error?: Error, context?: Partial<EdgeFunctionLogContext>): void {
    const logData = this.formatLog('error', message, context);
    if (error) {
      logData.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }
    this.output(logData);
  }

  audit(action: string, context?: Partial<EdgeFunctionLogContext>): void {
    this.output(this.formatLog('audit', `AUDIT: ${action}`, context));
  }

  // Performance measurement
  async measurePerformance<T>(
    operation: string,
    fn: () => Promise<T>,
    context?: Partial<EdgeFunctionLogContext>
  ): Promise<T> {
    const start = performance.now();
    try {
      const result = await fn();
      const duration = performance.now() - start;
      
      this.info(`${operation} completed`, {
        ...context,
        duration: Math.round(duration * 100) / 100, // Round to 2 decimal places
      });
      
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      this.error(`${operation} failed`, error as Error, {
        ...context,
        duration: Math.round(duration * 100) / 100,
      });
      throw error;
    }
  }

  // Database operation logging
  dbOperation(operation: string, table: string, context?: Partial<EdgeFunctionLogContext>): void {
    this.debug(`DB: ${operation} on ${table}`, {
      ...context,
      metadata: {
        ...context?.metadata,
        dbOperation: operation,
        table,
      },
    });
  }

  // Security event logging
  securityEvent(event: string, context?: Partial<EdgeFunctionLogContext>): void {
    this.warn(`SECURITY: ${event}`, {
      ...context,
      metadata: {
        ...context?.metadata,
        securityEvent: event,
      },
    });
  }

  // Business logic event logging
  businessEvent(event: string, context?: Partial<EdgeFunctionLogContext>): void {
    this.info(`BUSINESS: ${event}`, {
      ...context,
      metadata: {
        ...context?.metadata,
        businessEvent: event,
      },
    });
  }
}

// Factory function for creating loggers
export const createEdgeLogger = (functionName: string, requestId?: string): EdgeFunctionLogger => {
  return new EdgeFunctionLogger(functionName, requestId);
};

// Middleware helper for request logging
export const withRequestLogging = async <T>(
  functionName: string,
  request: Request,
  handler: (logger: EdgeFunctionLogger) => Promise<T>
): Promise<T> => {
  const requestId = request.headers.get('x-request-id') || 
                   `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  const logger = createEdgeLogger(functionName, requestId);
  
  logger.info('Request received', {
    functionName,
    metadata: {
      method: request.method,
      url: request.url,
      userAgent: request.headers.get('user-agent'),
    },
  });

  try {
    const result = await handler(logger);
    
    logger.info('Request completed successfully', {
      functionName,
    });
    
    return result;
  } catch (error) {
    logger.error('Request failed', error as Error, {
      functionName,
    });
    throw error;
  }
};