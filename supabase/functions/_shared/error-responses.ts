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
 * Enhanced error response with backward compatibility for edge functions
 * 
 * SAFETY: Preserves all existing error response formats while adding new features.
 * Edge functions can gradually migrate to use enhanced responses.
 */

import { corsHeaders } from './cors.ts';

export function createEnhancedErrorResponse(
  code: string,
  message: string,
  details?: any,
  correlationId?: string,
  statusCode: number = 500
): Response {
  const response = {
    // New standardized format
    success: false,
    error: {
      code,
      message,
      details,
      correlationId,
      retryable: isRetryableErrorCode(code)
    },
    timestamp: new Date().toISOString(),
    
    // Legacy format for backward compatibility
    error_code: code,
    error_message: message,
    user_message: getUserFriendlyMessage(code),
  };

  console.error(`[EdgeFunction] Enhanced Error [${correlationId}]:`, {
    code,
    message,
    statusCode,
    details
  });

  return new Response(JSON.stringify(response), {
    status: statusCode,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      ...(correlationId && { 'X-Correlation-ID': correlationId })
    },
  });
}

function isRetryableErrorCode(code: string): boolean {
  const retryableCodes = [
    'DATABASE_ERROR',
    'EXTERNAL_API_ERROR', 
    'TIMEOUT',
    'RATE_LIMITED',
    'INTERNAL_ERROR'
  ];
  return retryableCodes.includes(code);
}

function getUserFriendlyMessage(code: string): string {
  const friendlyMessages: Record<string, string> = {
    'AUTH_REQUIRED': 'Please sign in to continue',
    'SUBSCRIPTION_REQUIRED': 'This feature requires a subscription',
    'QUOTA_EXCEEDED': 'Usage limit reached for your plan',
    'INVALID_INPUT': 'Please check your input and try again',
    'RATE_LIMITED': 'Too many requests, please wait a moment',
    'INTERNAL_ERROR': 'Something went wrong, please try again'
  };
  
  return friendlyMessages[code] || 'An error occurred, please try again';
}