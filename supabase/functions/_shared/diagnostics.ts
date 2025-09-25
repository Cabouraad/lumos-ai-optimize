/**
 * Enhanced diagnostics and logging utilities for edge functions
 */

export interface RequestContext {
  requestId: string;
  functionName: string;
  startTime: number;
  origin?: string;
  userAgent?: string;
  ip?: string;
}

export interface DiagnosticStep {
  step: string;
  timestamp: number;
  duration?: number;
  details?: any;
  error?: string;
}

export class EdgeFunctionDiagnostics {
  private context: RequestContext;
  private steps: DiagnosticStep[] = [];

  constructor(functionName: string, request: Request) {
    this.context = {
      requestId: crypto.randomUUID(),
      functionName,
      startTime: Date.now(),
      origin: request.headers.get('Origin') || undefined,
      userAgent: request.headers.get('User-Agent') || undefined,
      ip: request.headers.get('X-Forwarded-For') || 
          request.headers.get('X-Real-IP') || 'unknown'
    };
    
    this.logStep('function_started', {
      origin: this.context.origin,
      userAgent: this.context.userAgent?.substring(0, 100),
      ip: this.context.ip
    });
  }

  logStep(step: string, details?: any, error?: Error | string): void {
    const timestamp = Date.now();
    const duration = timestamp - this.context.startTime;
    
    const diagnostic: DiagnosticStep = {
      step,
      timestamp,
      duration,
      details,
      error: error ? (typeof error === 'string' ? error : error.message) : undefined
    };
    
    this.steps.push(diagnostic);
    
    const prefix = `[${this.context.functionName.toUpperCase()}:${this.context.requestId.substring(0, 8)}]`;
    const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
    const errorStr = error ? ` - ERROR: ${typeof error === 'string' ? error : error.message}` : '';
    
    console.log(`${prefix} ${step} (+${duration}ms)${detailsStr}${errorStr}`);
  }

  async measure<T>(step: string, operation: () => Promise<T>, details?: any): Promise<T> {
    const stepStart = Date.now();
    this.logStep(`${step}_started`, details);
    
    try {
      const result = await operation();
      const stepDuration = Date.now() - stepStart;
      this.logStep(`${step}_completed`, { ...details, duration_ms: stepDuration });
      return result;
    } catch (error: unknown) {
      const stepDuration = Date.now() - stepStart;
      this.logStep(`${step}_failed`, { ...details, duration_ms: stepDuration }, error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  getRequestSummary(): any {
    const totalDuration = Date.now() - this.context.startTime;
    return {
      requestId: this.context.requestId,
      functionName: this.context.functionName,
      totalDuration,
      steps: this.steps.length,
      errors: this.steps.filter((s: any) => s.error).length,
      context: this.context
    };
  }

  createErrorResponse(error: Error | string, status = 500): Response {
    const errorMessage = typeof error === 'string' ? error : error.message;
    this.logStep('error_response', { 
      error: errorMessage, 
      status,
      stack: typeof error !== 'string' ? error.stack : undefined 
    });
    
    const summary = this.getRequestSummary();
    
    return Response.json({
      success: false,
      error: errorMessage,
      requestId: this.context.requestId,
      diagnostics: summary
    }, { status });
  }

  createSuccessResponse(data: any, status = 200): Response {
    this.logStep('success_response', { status });
    const summary = this.getRequestSummary();
    
    return Response.json({
      ...data,
      requestId: this.context.requestId,
      diagnostics: summary
    }, { status });
  }
}

/**
 * Create diagnostics instance for an edge function
 */
export function createDiagnostics(functionName: string, request: Request): EdgeFunctionDiagnostics {
  return new EdgeFunctionDiagnostics(functionName, request);
}

/**
 * Simple logger for functions that don't need full diagnostics
 */
export function createLogger(functionName: string) {
  return {
    log: (step: string, details?: any) => {
      const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
      console.log(`[${functionName.toUpperCase()}] ${step}${detailsStr}`);
    },
    error: (step: string, error: Error | string, details?: any) => {
      const errorMessage = typeof error === 'string' ? error : error.message;
      const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
      console.error(`[${functionName.toUpperCase()}] ${step} - ERROR: ${errorMessage}${detailsStr}`);
    }
  };
}