/**
 * Secure logger that redacts sensitive data from logs
 * Masks fields matching: /(key|secret|stripe_|card|customer_id|subscription_id)/i
 */

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogData {
  [key: string]: any;
}

/**
 * Pattern to match sensitive field names that should be redacted
 */
const SENSITIVE_FIELD_PATTERN = /(key|secret|stripe_|card|customer_id|subscription_id|token|password|auth)/i;

/**
 * Recursively redact sensitive fields from an object
 */
function redactSensitiveFields(obj: any, depth = 0): any {
  // Prevent infinite recursion
  if (depth > 10) return '[MAX_DEPTH_REACHED]';
  
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => redactSensitiveFields(item, depth + 1));
  }

  if (typeof obj === 'object' && obj.constructor === Object) {
    const redacted: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(obj)) {
      if (SENSITIVE_FIELD_PATTERN.test(key)) {
        // Redact sensitive fields but preserve type info
        if (typeof value === 'string') {
          redacted[key] = value.length > 0 ? `[REDACTED:${value.length}chars]` : '[REDACTED:empty]';
        } else if (value !== null && value !== undefined) {
          redacted[key] = `[REDACTED:${typeof value}]`;
        } else {
          redacted[key] = '[REDACTED:null]';
        }
      } else {
        redacted[key] = redactSensitiveFields(value, depth + 1);
      }
    }
    
    return redacted;
  }

  // For primitives, functions, etc., return as-is
  return obj;
}

/**
 * Secure logger class that automatically redacts sensitive information
 */
export class SecureLogger {
  private context: string;

  constructor(context: string = 'APP') {
    this.context = context;
  }

  private formatMessage(level: LogLevel, message: string, data?: LogData): string {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}] [${this.context}]`;
    
    if (data) {
      const redactedData = redactSensitiveFields(data);
      return `${prefix} ${message} ${JSON.stringify(redactedData, null, 2)}`;
    }
    
    return `${prefix} ${message}`;
  }

  info(message: string, data?: LogData): void {
    console.log(this.formatMessage('info', message, data));
  }

  warn(message: string, data?: LogData): void {
    console.warn(this.formatMessage('warn', message, data));
  }

  error(message: string, data?: LogData): void {
    console.error(this.formatMessage('error', message, data));
  }

  debug(message: string, data?: LogData): void {
    if (process.env.NODE_ENV === 'development') {
      console.debug(this.formatMessage('debug', message, data));
    }
  }

  /**
   * Create a new logger instance with additional context
   */
  child(additionalContext: string): SecureLogger {
    return new SecureLogger(`${this.context}:${additionalContext}`);
  }
}

/**
 * Default logger instance
 */
export const logger = new SecureLogger('BILLING');

/**
 * Utility function to redact sensitive data from any object
 * Useful for one-off redaction without creating a logger instance
 */
export function redactSensitiveData(obj: any): any {
  return redactSensitiveFields(obj);
}

/**
 * Edge function compatible logger (for Deno environment)
 */
export function createEdgeLogger(context: string) {
  return {
    info: (message: string, data?: LogData) => {
      const timestamp = new Date().toISOString();
      const redactedData = data ? redactSensitiveFields(data) : undefined;
      console.log(`[${timestamp}] [INFO] [${context}] ${message}`, redactedData || '');
    },
    
    warn: (message: string, data?: LogData) => {
      const timestamp = new Date().toISOString();
      const redactedData = data ? redactSensitiveFields(data) : undefined;
      console.warn(`[${timestamp}] [WARN] [${context}] ${message}`, redactedData || '');
    },
    
    error: (message: string, data?: LogData) => {
      const timestamp = new Date().toISOString();
      const redactedData = data ? redactSensitiveFields(data) : undefined;
      console.error(`[${timestamp}] [ERROR] [${context}] ${message}`, redactedData || '');
    }
  };
}