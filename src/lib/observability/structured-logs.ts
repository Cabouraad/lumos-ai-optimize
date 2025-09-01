/**
 * Structured logging utilities for better observability
 */

export interface LogContext {
  [key: string]: any;
}

export interface Logger {
  info: (message: string, context?: LogContext) => void;
  warn: (message: string, context?: LogContext) => void;
  error: (message: string, error?: Error, context?: LogContext) => void;
  debug: (message: string, context?: LogContext) => void;
}

/**
 * Create a structured logger with a namespace
 */
export function createUnifiedLogger(namespace: string): Logger {
  const formatMessage = (level: string, message: string, context?: LogContext) => {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      namespace,
      message,
      ...context
    };
    return logEntry;
  };

  return {
    info: (message: string, context?: LogContext) => {
      console.info(`[${namespace}]`, message, context || {});
    },
    
    warn: (message: string, context?: LogContext) => {
      console.warn(`[${namespace}]`, message, context || {});
    },
    
    error: (message: string, error?: Error, context?: LogContext) => {
      const errorContext = error ? {
        errorName: error.name,
        errorMessage: error.message,
        errorStack: error.stack,
        ...context
      } : context;
      
      console.error(`[${namespace}]`, message, errorContext || {});
    },
    
    debug: (message: string, context?: LogContext) => {
      if (process.env.NODE_ENV === 'development') {
        console.debug(`[${namespace}]`, message, context || {});
      }
    }
  };
}