/**
 * Centralized input validation and sanitization utilities
 * Prevents SQL injection, XSS, and other input-based attacks
 * 
 * @module validation
 * @see docs/security-sql-injection-assessment.md
 */

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const SQL_INJECTION_PATTERNS = [
  /(\b(DROP|DELETE|TRUNCATE|ALTER|CREATE)\b.*\b(TABLE|DATABASE|SCHEMA)\b)/i,
  /(\bUNION\b.*\bSELECT\b)/i,
  /(\bINSERT\b.*\bINTO\b)/i,
  /(--|;|\/\*|\*\/|xp_|sp_)/i,
];

/**
 * Custom error class for validation failures
 * Provides structured error information for proper error handling
 */
export class ValidationError extends Error {
  constructor(
    message: string,
    public field: string,
    public code: string
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Validate UUID format
 * 
 * @param id - The value to validate as UUID
 * @param fieldName - Field name for error messages
 * @returns Trimmed valid UUID string
 * @throws ValidationError if invalid
 * 
 * @example
 * const promptId = validateUUID(body.promptId, 'promptId');
 */
export function validateUUID(id: unknown, fieldName: string = 'ID'): string {
  if (!id || typeof id !== 'string') {
    throw new ValidationError(
      `${fieldName} is required and must be a string`,
      fieldName,
      'INVALID_TYPE'
    );
  }
  
  const trimmed = id.trim();
  
  if (!UUID_REGEX.test(trimmed)) {
    throw new ValidationError(
      `${fieldName} must be a valid UUID`,
      fieldName,
      'INVALID_UUID'
    );
  }
  
  return trimmed;
}

/**
 * Validate and sanitize string input with length constraints
 * 
 * @param value - The value to validate
 * @param fieldName - Field name for error messages
 * @param options - Validation options
 * @returns Trimmed valid string
 * @throws ValidationError if invalid
 * 
 * @example
 * const text = validateString(body.text, 'prompt text', {
 *   minLength: 1,
 *   maxLength: 5000,
 *   checkSqlInjection: true
 * });
 */
export function validateString(
  value: unknown,
  fieldName: string,
  options: {
    minLength?: number;
    maxLength?: number;
    allowEmpty?: boolean;
    checkSqlInjection?: boolean;
  } = {}
): string {
  const {
    minLength = 0,
    maxLength = 10000,
    allowEmpty = false,
    checkSqlInjection = false,
  } = options;

  if (value === null || value === undefined) {
    if (allowEmpty) return '';
    throw new ValidationError(
      `${fieldName} is required`,
      fieldName,
      'REQUIRED'
    );
  }

  if (typeof value !== 'string') {
    throw new ValidationError(
      `${fieldName} must be a string`,
      fieldName,
      'INVALID_TYPE'
    );
  }

  const trimmed = value.trim();

  if (!allowEmpty && trimmed.length === 0) {
    throw new ValidationError(
      `${fieldName} cannot be empty`,
      fieldName,
      'EMPTY'
    );
  }

  if (trimmed.length < minLength) {
    throw new ValidationError(
      `${fieldName} must be at least ${minLength} characters`,
      fieldName,
      'TOO_SHORT'
    );
  }

  if (trimmed.length > maxLength) {
    throw new ValidationError(
      `${fieldName} must not exceed ${maxLength} characters`,
      fieldName,
      'TOO_LONG'
    );
  }

  if (checkSqlInjection && containsSqlInjectionPatterns(trimmed)) {
    throw new ValidationError(
      `${fieldName} contains potentially dangerous SQL patterns`,
      fieldName,
      'SQL_INJECTION_DETECTED'
    );
  }

  return trimmed;
}

/**
 * Check for SQL injection patterns (defense-in-depth)
 * Note: This is NOT a replacement for parameterized queries,
 * but an additional layer of protection
 * 
 * @param input - String to check
 * @returns true if suspicious patterns detected
 */
function containsSqlInjectionPatterns(input: string): boolean {
  return SQL_INJECTION_PATTERNS.some(pattern => pattern.test(input));
}

/**
 * Escape special characters for LIKE queries
 * Prevents pattern injection in ILIKE/LIKE operations
 * 
 * @param input - String to escape
 * @returns Escaped string safe for LIKE queries
 * 
 * @example
 * .ilike('name', escapeLikePattern(userInput))
 */
export function escapeLikePattern(input: string): string {
  return input
    .replace(/\\/g, '\\\\')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_');
}

/**
 * Sanitize competitor/brand name input
 * Removes dangerous characters and normalizes the string
 * 
 * @param name - Brand name to sanitize
 * @returns Sanitized brand name
 * @throws ValidationError if invalid
 * 
 * @example
 * const cleanName = sanitizeBrandName(body.competitorName);
 */
export function sanitizeBrandName(name: unknown): string {
  const validated = validateString(name, 'brand name', {
    minLength: 2,
    maxLength: 100,
  });

  // Unicode normalize
  let sanitized = validated.normalize('NFKC');

  // Remove control characters and dangerous unicode
  sanitized = sanitized.replace(/[\x00-\x1F\x7F-\x9F\p{C}\p{Z}&&[^\x20]]/gu, '');

  // Remove script tags and dangerous patterns
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  sanitized = sanitized.replace(/javascript:/gi, '');
  sanitized = sanitized.replace(/data:/gi, '');
  sanitized = sanitized.replace(/on\w+=/gi, ''); // Remove event handlers

  if (sanitized.length < 2) {
    throw new ValidationError(
      'Brand name too short after sanitization',
      'brand name',
      'INVALID_AFTER_SANITIZATION'
    );
  }

  return sanitized;
}

/**
 * Validate email format
 * 
 * @param email - Email to validate
 * @returns Lowercase validated email
 * @throws ValidationError if invalid
 * 
 * @example
 * const userEmail = validateEmail(body.email);
 */
export function validateEmail(email: unknown): string {
  const validated = validateString(email, 'email', {
    minLength: 3,
    maxLength: 255,
  });

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(validated)) {
    throw new ValidationError(
      'Invalid email format',
      'email',
      'INVALID_EMAIL'
    );
  }

  return validated.toLowerCase();
}

/**
 * Validate domain name
 * Removes protocol, www prefix, and path
 * 
 * @param domain - Domain to validate
 * @returns Cleaned and validated domain
 * @throws ValidationError if invalid
 * 
 * @example
 * const siteDomain = validateDomain(body.domain);
 */
export function validateDomain(domain: unknown): string {
  const validated = validateString(domain, 'domain', {
    minLength: 3,
    maxLength: 255,
  });

  // Remove protocol and www prefix
  let cleaned = validated.replace(/^https?:\/\//i, '');
  cleaned = cleaned.replace(/^www\./i, '');
  cleaned = cleaned.split('/')[0]; // Remove path
  cleaned = cleaned.split('?')[0]; // Remove query params
  cleaned = cleaned.toLowerCase();

  const domainRegex = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/;
  if (!domainRegex.test(cleaned)) {
    throw new ValidationError(
      'Invalid domain format',
      'domain',
      'INVALID_DOMAIN'
    );
  }

  return cleaned;
}

/**
 * Validate integer within range
 * 
 * @param value - Value to validate
 * @param fieldName - Field name for error messages
 * @param options - Min/max constraints
 * @returns Valid integer
 * @throws ValidationError if invalid
 * 
 * @example
 * const limit = validateInteger(body.limit, 'limit', { min: 1, max: 100 });
 */
export function validateInteger(
  value: unknown,
  fieldName: string,
  options: {
    min?: number;
    max?: number;
  } = {}
): number {
  const { min, max } = options;

  if (value === null || value === undefined) {
    throw new ValidationError(
      `${fieldName} is required`,
      fieldName,
      'REQUIRED'
    );
  }

  const num = typeof value === 'string' ? parseInt(value, 10) : value;

  if (typeof num !== 'number' || isNaN(num) || !Number.isInteger(num)) {
    throw new ValidationError(
      `${fieldName} must be a valid integer`,
      fieldName,
      'INVALID_INTEGER'
    );
  }

  if (min !== undefined && num < min) {
    throw new ValidationError(
      `${fieldName} must be at least ${min}`,
      fieldName,
      'TOO_SMALL'
    );
  }

  if (max !== undefined && num > max) {
    throw new ValidationError(
      `${fieldName} must not exceed ${max}`,
      fieldName,
      'TOO_LARGE'
    );
  }

  return num;
}

/**
 * Validate boolean value
 * Accepts boolean, 'true', 'false', 1, 0
 * 
 * @param value - Value to validate
 * @param fieldName - Field name for error messages
 * @returns Valid boolean
 * @throws ValidationError if invalid
 * 
 * @example
 * const isActive = validateBoolean(body.active, 'active');
 */
export function validateBoolean(value: unknown, fieldName: string): boolean {
  if (typeof value === 'boolean') {
    return value;
  }

  if (value === 'true' || value === 1) {
    return true;
  }

  if (value === 'false' || value === 0) {
    return false;
  }

  throw new ValidationError(
    `${fieldName} must be a boolean value`,
    fieldName,
    'INVALID_BOOLEAN'
  );
}

/**
 * Create standardized error response for validation errors
 * 
 * @param error - Error to format
 * @param corsHeaders - CORS headers to include
 * @returns Response object
 * 
 * @example
 * catch (error) {
 *   if (error instanceof ValidationError) {
 *     return createValidationErrorResponse(error, corsHeaders);
 *   }
 *   throw error;
 * }
 */
export function createValidationErrorResponse(
  error: ValidationError,
  corsHeaders: Record<string, string> = {}
): Response {
  console.warn('[VALIDATION] Input validation failed', {
    field: error.field,
    code: error.code,
    message: error.message,
    timestamp: new Date().toISOString(),
  });

  return new Response(
    JSON.stringify({
      error: error.message,
      field: error.field,
      code: error.code,
    }),
    {
      status: 400,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    }
  );
}
