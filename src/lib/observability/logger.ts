/**
 * Structured logging utility for observability
 * Provides consistent log formatting across the application
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
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: {
        ...context,
        sessionId: context.sessionId || this.getSessionId(),
      },
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