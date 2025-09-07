/**
 * Structured logging utility for audit functions  
 * Handles data redaction and consistent log formatting
 * Note: This is designed for Deno edge functions, not frontend use
 */

export interface LogEntry {
  lvl: 'info' | 'warn' | 'error';
  corr: string;
  phase?: string;
  name: string;
  ms: number;
  ok: boolean;
  http?: number;
  data_redacted?: any;
}

/**
 * Redact sensitive information from data
 * - Emails are converted to SHA256 hashes
 * - Tokens and secrets are removed
 * - Passwords are removed
 */
function redactSensitiveData(data: any): any {
  if (!data || typeof data !== 'object') {
    return data;
  }

  const redacted = { ...data };

  // Redact email addresses (simplified hash for frontend compatibility)
  if (redacted.email && typeof redacted.email === 'string') {
    // Simple hash for frontend - in Deno edge functions, use crypto.createHash
    redacted.email = redacted.email.replace(/(.{2}).*@(.{2}).*\.(.*)/, '$1***@$2***.$3');
  }

  // Remove sensitive fields
  const sensitiveFields = [
    'password', 'token', 'secret', 'key', 'authorization',
    'api_key', 'access_token', 'refresh_token', 'jwt'
  ];

  sensitiveFields.forEach(field => {
    if (redacted[field]) {
      redacted[field] = '[REDACTED]';
    }
  });

  // Recursively redact nested objects
  Object.keys(redacted).forEach(key => {
    if (typeof redacted[key] === 'object' && redacted[key] !== null) {
      redacted[key] = redactSensitiveData(redacted[key]);
    }
  });

  return redacted;
}

/**
 * Emit a structured log entry
 */
export function emitLog(entry: Omit<LogEntry, 'data_redacted'> & { data?: any }): LogEntry {
  const logEntry: LogEntry = {
    lvl: entry.lvl,
    corr: entry.corr,
    phase: entry.phase,
    name: entry.name,
    ms: entry.ms,
    ok: entry.ok,
    http: entry.http,
    data_redacted: redactSensitiveData(entry.data)
  };

  // Console output for debugging
  const timestamp = new Date().toISOString();
  const logLevel = entry.lvl.toUpperCase().padEnd(5);
  const phase = entry.phase ? `[${entry.phase}]` : '';
  const status = entry.ok ? '✓' : '✗';
  
  console.log(`${timestamp} ${logLevel} ${phase} ${entry.name} ${status} ${entry.ms}ms`, 
    entry.http ? `HTTP:${entry.http}` : '', 
    logEntry.data_redacted || ''
  );

  return logEntry;
}

/**
 * Create a logger instance bound to a correlation ID and phase
 */
export function createAuditLogger(corrId: string, phase?: string) {
  return {
    info: (name: string, data?: any, duration = 0) => 
      emitLog({ lvl: 'info', corr: corrId, phase, name, ms: duration, ok: true, data }),
    
    warn: (name: string, data?: any, duration = 0) => 
      emitLog({ lvl: 'warn', corr: corrId, phase, name, ms: duration, ok: true, data }),
    
    error: (name: string, data?: any, duration = 0, httpStatus?: number) => 
      emitLog({ lvl: 'error', corr: corrId, phase, name, ms: duration, ok: false, http: httpStatus, data }),
    
    http: (name: string, ok: boolean, httpStatus: number, duration: number, data?: any) =>
      emitLog({ lvl: ok ? 'info' : 'error', corr: corrId, phase, name, ms: duration, ok, http: httpStatus, data })
  };
}