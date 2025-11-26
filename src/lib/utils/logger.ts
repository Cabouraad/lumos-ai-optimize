/**
 * Conditional logger utility - logs only in development
 * Zero-impact production optimization
 */

const isDevelopment = import.meta.env.MODE === 'development';

export const logger = {
  /**
   * Development-only logging
   */
  log: (...args: any[]) => {
    if (isDevelopment) {
      console.log(...args);
    }
  },

  /**
   * Development-only warnings
   */
  warn: (...args: any[]) => {
    if (isDevelopment) {
      console.warn(...args);
    }
  },

  /**
   * Always log errors (can integrate with error tracking service)
   */
  error: (...args: any[]) => {
    console.error(...args);
  },

  /**
   * Development-only debug logging with context
   */
  debug: (context: string, ...args: any[]) => {
    if (isDevelopment) {
      console.log(`[${context}]`, ...args);
    }
  },

  /**
   * Always log with context (for critical logs)
   */
  info: (context: string, ...args: any[]) => {
    console.log(`[${context}]`, ...args);
  }
};

// Export individual functions for convenience
export const { log, warn, error, debug, info } = logger;
