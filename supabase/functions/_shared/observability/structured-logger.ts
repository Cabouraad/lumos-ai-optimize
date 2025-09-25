/**
 * Structured logging for Supabase Edge Functions with correlation ID and key redaction
 * Provides consistent, searchable logs for observability
 */

export interface EdgeFunctionLogContext {
  functionName: string;
  correlationId?: string;
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
  private correlationId: string;
  private functionName: string;
  
  constructor(functionName: string, correlationId?: string) {
    this.functionName = functionName;
    this.correlationId = correlationId || crypto.randomUUID();
    
    // Log function start
    this.info('Edge function started', {
      functionName,
      correlationId: this.correlationId,
    });
  }

  private redactSensitiveData(data: any): any {
    if (typeof data !== 'object' || data === null) {
      return data;
    }

    if (Array.isArray(data)) {
      return data.map((item: any) => this.redactSensitiveData(item));
    }

    const redacted = { ...data };
    const sensitiveKeys = [
      'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 
      'SERVICE_ROLE_KEY', 'SUPABASE_SERVICE_ROLE_KEY',
      'OPENAI_API_KEY', 'PERPLEXITY_API_KEY', 'CRON_SECRET',
      'password', 'token', 'secret', 'key', 'auth'
    ];

    for (const [key, value] of Object.entries(redacted)) {
      const keyLower = key.toLowerCase();
      const shouldRedact = sensitiveKeys.some(sensitiveKey => 
        keyLower.includes(sensitiveKey.toLowerCase()) || 
        keyLower.includes('secret') || 
        keyLower.includes('password') ||
        keyLower.includes('token')
      );

      if (shouldRedact) {
        redacted[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        redacted[key] = this.redactSensitiveData(value);
      }
    }

    return redacted;
  }

  private formatLog(
    level: EdgeLogLevel, 
    message: string, 
    context: Partial<EdgeFunctionLogContext> = {}
  ): StructuredEdgeLog {
    const redactedContext = this.redactSensitiveData({
      ...context,
      functionName: this.functionName,
      correlationId: this.correlationId,
    });

    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: redactedContext,
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
export const createEdgeLogger = (functionName: string, correlationId?: string): EdgeFunctionLogger => {
  return new EdgeFunctionLogger(functionName, correlationId);
};

// Middleware helper for request logging
export const withRequestLogging = async <T>(
  functionName: string,
  request: Request,
  handler: (logger: EdgeFunctionLogger) => Promise<T>
): Promise<T> => {
  const correlationId = request.headers.get('x-correlation-id') || 
                       request.headers.get('x-request-id') || 
                       crypto.randomUUID();
  
  const logger = createEdgeLogger(functionName, correlationId);
  
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