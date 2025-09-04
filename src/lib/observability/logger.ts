/**
 * Structured logging utility for observability with security redaction
 * Provides consistent log formatting across the application
 * Automatically redacts sensitive fields like keys, secrets, and billing data
 */

export interface LogContext {
  userId?: string;
  orgId?: string;
  sessionId?: string;
  component?: string;
  action?: string;
  duration?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Pattern to match sensitive field names that should be redacted
 */
const SENSITIVE_FIELD_PATTERN = /(key|secret|stripe_|card|customer_id|subscription_id|token|password|auth|billing)/i;

/**
 * Recursively redact sensitive fields from log context
 */
function redactSensitiveFields(obj: any, depth = 0): any {
  if (depth > 10) return '[MAX_DEPTH_REACHED]';
  
  if (obj === null || obj === undefined || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => redactSensitiveFields(item, depth + 1));
  }

  const redacted: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_FIELD_PATTERN.test(key)) {
      // Redact sensitive fields but preserve type info
      if (typeof value === 'string') {
        redacted[key] = value.length > 0 ? `[REDACTED:${value.length}chars]` : '[REDACTED:empty]';
      } else {
        redacted[key] = `[REDACTED:${typeof value}]`;
      }
    } else {
      redacted[key] = redactSensitiveFields(value, depth + 1);
    }
  }
  return redacted;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface StructuredLog {
  timestamp: string;
  level: LogLevel;
  message: string;
  context: LogContext;
  stack?: string;
}

class Logger {
  private isDev = import.meta.env?.DEV || false;
  
  private formatLog(level: LogLevel, message: string, context: LogContext = {}): StructuredLog {
    // Redact sensitive information from context before logging
    const redactedContext = redactSensitiveFields({
      ...context,
      sessionId: context.sessionId || this.getSessionId(),
    });

    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: redactedContext,
    };
  }

  private getSessionId(): string {
    // Simple session ID for client-side correlation
    if (typeof window !== 'undefined') {
      let sessionId = sessionStorage.getItem('app-session-id');
      if (!sessionId) {
        sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        sessionStorage.setItem('app-session-id', sessionId);
      }
      return sessionId;
    }
    return `server_${Date.now()}`;
  }

  private output(logData: StructuredLog): void {
    if (this.isDev) {
      // Development: Pretty print to console
      console.log(`[${logData.timestamp}] ${logData.level.toUpperCase()}: ${logData.message}`, logData.context);
    } else {
      // Production: Structured JSON for log aggregation
      console.log(JSON.stringify(logData));
    }
  }

  debug(message: string, context?: LogContext): void {
    this.output(this.formatLog('debug', message, context));
  }

  info(message: string, context?: LogContext): void {
    this.output(this.formatLog('info', message, context));
  }

  warn(message: string, context?: LogContext): void {
    this.output(this.formatLog('warn', message, context));
  }

  error(message: string, error?: Error, context?: LogContext): void {
    const logData = this.formatLog('error', message, context);
    if (error) {
      logData.stack = error.stack;
    }
    this.output(logData);
  }

  // Specialized methods for specific operations
  auditLog(action: string, context: LogContext): void {
    this.info(`AUDIT: ${action}`, { 
      ...context, 
      component: 'audit', 
      action 
    });
  }

  performanceLog(operation: string, duration: number, context?: LogContext): void {
    this.info(`PERF: ${operation} completed`, {
      ...context,
      component: 'performance',
      action: operation,
      duration,
    });
  }

  securityLog(event: string, context: LogContext): void {
    this.warn(`SECURITY: ${event}`, {
      ...context,
      component: 'security',
      action: event,
    });
  }
}

export const logger = new Logger();

// Performance measurement utility
export const withPerformanceLogging = async <T>(
  operation: string,
  fn: () => Promise<T>,
  context?: LogContext
): Promise<T> => {
  const start = performance.now();
  try {
    const result = await fn();
    const duration = performance.now() - start;
    logger.performanceLog(operation, duration, context);
    return result;
  } catch (error) {
    const duration = performance.now() - start;
    logger.error(`${operation} failed after ${duration}ms`, error as Error, context);
    throw error;
  }
};