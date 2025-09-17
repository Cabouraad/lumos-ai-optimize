/**
 * Standardized error response utilities for edge functions
 */

export interface StandardErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
    retryable: boolean;
    correlationId?: string;
  };
  timestamp: string;
}

export interface StandardSuccessResponse<T = any> {
  success: true;
  data: T;
  timestamp: string;
  correlationId?: string;
}

export type StandardResponse<T = any> = StandardErrorResponse | StandardSuccessResponse<T>;

export enum ErrorCode {
  // Authentication errors
  AUTH_REQUIRED = 'AUTH_REQUIRED',
  AUTH_EXPIRED = 'AUTH_EXPIRED',
  AUTH_INVALID = 'AUTH_INVALID',
  
  // Authorization errors
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  SUBSCRIPTION_REQUIRED = 'SUBSCRIPTION_REQUIRED',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  
  // Validation errors
  INVALID_INPUT = 'INVALID_INPUT',
  MISSING_PARAMETERS = 'MISSING_PARAMETERS',
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  
  // System errors
  DATABASE_ERROR = 'DATABASE_ERROR',
  EXTERNAL_API_ERROR = 'EXTERNAL_API_ERROR',
  TIMEOUT = 'TIMEOUT',
  RATE_LIMITED = 'RATE_LIMITED',
  
  // Generic
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT'
}

export function createErrorResponse(
  code: ErrorCode,
  message: string,
  details?: any,
  correlationId?: string
): StandardErrorResponse {
  const retryable = isRetryableError(code);
  
  return {
    success: false,
    error: {
      code,
      message,
      details,
      retryable,
      correlationId
    },
    timestamp: new Date().toISOString()
  };
}

export function createSuccessResponse<T>(
  data: T,
  correlationId?: string
): StandardSuccessResponse<T> {
  return {
    success: true,
    data,
    timestamp: new Date().toISOString(),
    correlationId
  };
}

export function isRetryableError(code: ErrorCode): boolean {
  const retryableCodes = [
    ErrorCode.DATABASE_ERROR,
    ErrorCode.EXTERNAL_API_ERROR,
    ErrorCode.TIMEOUT,
    ErrorCode.RATE_LIMITED,
    ErrorCode.INTERNAL_ERROR
  ];
  
  return retryableCodes.includes(code);
}

export function getHttpStatusFromErrorCode(code: ErrorCode): number {
  switch (code) {
    case ErrorCode.AUTH_REQUIRED:
    case ErrorCode.AUTH_EXPIRED:
    case ErrorCode.AUTH_INVALID:
      return 401;
      
    case ErrorCode.INSUFFICIENT_PERMISSIONS:
    case ErrorCode.SUBSCRIPTION_REQUIRED:
      return 403;
      
    case ErrorCode.NOT_FOUND:
      return 404;
      
    case ErrorCode.CONFLICT:
      return 409;
      
    case ErrorCode.INVALID_INPUT:
    case ErrorCode.MISSING_PARAMETERS:
    case ErrorCode.VALIDATION_FAILED:
      return 400;
      
    case ErrorCode.QUOTA_EXCEEDED:
    case ErrorCode.RATE_LIMITED:
      return 429;
      
    case ErrorCode.TIMEOUT:
      return 408;
      
    default:
      return 500;
  }
}

/**
 * Create a standardized Response object with proper CORS headers
 */
export function createStandardResponse(
  responseData: StandardResponse,
  corsHeaders: Record<string, string>
): Response {
  const status = responseData.success 
    ? 200 
    : getHttpStatusFromErrorCode(responseData.error.code as ErrorCode);
    
  return new Response(
    JSON.stringify(responseData),
    {
      status,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    }
  );
}