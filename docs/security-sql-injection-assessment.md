# SQL Injection Security Assessment

## Executive Summary

**Overall Risk Level: LOW-MEDIUM**

The Llumos platform demonstrates **strong baseline protection** against SQL injection attacks through the use of Supabase's parameterized query system. However, several areas require improvement to achieve comprehensive protection.

**Key Findings:**
- ✅ **No raw SQL concatenation vulnerabilities detected**
- ✅ Parameterized queries used throughout via Supabase JS client
- ✅ Row Level Security (RLS) policies provide defense-in-depth
- ⚠️ **Inconsistent input validation** across edge functions
- ⚠️ Missing UUID validation in several critical endpoints
- ⚠️ One instance of `.ilike()` with potentially unsafe input
- ⚠️ Security tests exist but are **currently disabled**

---

## Detailed Findings

### 1. Primary Protection Mechanisms ✅

**Supabase Client Parameterization**
- All database queries use Supabase JS client methods (`.eq()`, `.select()`, `.insert()`, etc.)
- These methods automatically parameterize inputs, preventing SQL injection
- No instances of raw SQL string concatenation found in codebase

**Example of Safe Query Pattern:**
```typescript
// Safe - parameters are automatically escaped
await supabase
  .from('prompts')
  .select('id, text, active')
  .eq('org_id', orgId)
  .eq('id', promptId);
```

### 2. Row Level Security (RLS) ✅

**Defense-in-Depth:**
- RLS policies enforce org-level data isolation
- Even if injection were possible, RLS limits data exposure
- Users can only access their own organization's data

### 3. Input Validation Gaps ⚠️

#### 3.1 Missing UUID Validation

**High Priority** - Several edge functions accept UUID parameters without validation:

**Vulnerable Endpoints:**
- `run-prompt-now/index.ts` (line 82): `promptId` from request
- `analyze-ai-response/index.ts` (line 64): `promptId` and `providerId` 
- `free-visibility-checker/index.ts`: Email and domain inputs
- `citation-mention/index.ts` (line 32): `response_id`
- `brand-enrich/index.ts` (line 23): `orgId` and `brandName`

**Current Code (Unsafe):**
```typescript
const { promptId } = await req.json();
if (!promptId) {
  throw new Error('Missing promptId');
}
// Used directly in query without UUID validation
```

**Recommended Fix:**
```typescript
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validateUUID(id: string, fieldName: string = 'ID'): string {
  if (!id || typeof id !== 'string') {
    throw new Error(`${fieldName} is required and must be a string`);
  }
  if (!UUID_REGEX.test(id)) {
    throw new Error(`${fieldName} must be a valid UUID`);
  }
  return id.trim();
}

// Usage:
const { promptId } = await req.json();
const validPromptId = validateUUID(promptId, 'promptId');
```

#### 3.2 Unsafe `.ilike()` Usage

**Location:** `supabase/functions/convert-competitor-to-brand/index.ts` (line 243)

**Issue:**
```typescript
.ilike('name', sanitizedName)
```

While the input IS sanitized in this case, `.ilike()` can be vulnerable to pattern injection if special characters like `%` or `_` are not escaped.

**Recommendation:**
```typescript
// Escape LIKE special characters
function escapeLikePattern(input: string): string {
  return input
    .replace(/\\/g, '\\\\')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_');
}

// Usage:
.ilike('name', escapeLikePattern(sanitizedName))
```

#### 3.3 Missing Input Length Validation

Most endpoints lack length validation for string inputs. This can lead to:
- Denial of Service (DoS) through large payloads
- Buffer overflow attempts
- Performance degradation

**Endpoints Missing Length Checks:**
- `onboarding/index.ts`: name, domain, business_description, etc.
- `analyze-ai-response/index.ts`: responseText
- `auto-fill-business-context/index.ts`: domain input

**Recommendation:**
```typescript
function validateStringInput(
  value: string, 
  fieldName: string, 
  minLength: number = 1, 
  maxLength: number = 1000
): string {
  if (typeof value !== 'string') {
    throw new Error(`${fieldName} must be a string`);
  }
  
  const trimmed = value.trim();
  
  if (trimmed.length < minLength) {
    throw new Error(`${fieldName} must be at least ${minLength} characters`);
  }
  
  if (trimmed.length > maxLength) {
    throw new Error(`${fieldName} must not exceed ${maxLength} characters`);
  }
  
  return trimmed;
}
```

#### 3.4 SQL Keyword Detection (Defense-in-Depth)

The test file (`src/__tests__/security/edge-function-auth.test.ts`) shows SQL injection tests that are **currently disabled** (`.skip`):

```typescript
it.skip('should prevent SQL injection in prompt text', async () => {
  const maliciousInputs = [
    "'; DROP TABLE prompts; --",
    "' UNION SELECT * FROM users --",
    "1' OR '1'='1",
  ];
  // Tests are skipped!
});
```

**Recommendation:** Enable these tests and implement the validation:

```typescript
function containsSqlInjectionPatterns(input: string): boolean {
  const sqlPatterns = [
    /(\b(DROP|DELETE|TRUNCATE|ALTER|CREATE)\b.*\b(TABLE|DATABASE|SCHEMA)\b)/i,
    /(\bUNION\b.*\bSELECT\b)/i,
    /(\bINSERT\b.*\bINTO\b)/i,
    /(--|;|\/\*|\*\/|xp_|sp_)/i,
    /(\b(AND|OR)\b.*=.*)/i,
    /('.*--)/i
  ];
  
  return sqlPatterns.some(pattern => pattern.test(input));
}

// Usage (for high-risk fields):
function validatePromptText(text: string): string {
  const validated = validateStringInput(text, 'prompt text', 1, 5000);
  
  if (containsSqlInjectionPatterns(validated)) {
    throw new Error('Input contains potentially dangerous SQL patterns');
  }
  
  return validated;
}
```

---

## Recommended Fixes (Priority Order)

### Priority 1: UUID Validation ⚡ CRITICAL

**Impact:** High - Prevents malformed inputs in ID fields
**Effort:** Low - Simple regex validation

**Files to Update:**
1. `supabase/functions/run-prompt-now/index.ts`
2. `supabase/functions/analyze-ai-response/index.ts`
3. `supabase/functions/citation-mention/index.ts`
4. `supabase/functions/brand-enrich/index.ts`
5. `supabase/functions/fix-org-brand-misclassification/index.ts`
6. `supabase/functions/fix-prompt-classification/index.ts`

**Action:** Create `supabase/functions/_shared/validation.ts` with UUID validation utility.

### Priority 2: Input Length Limits ⚡ HIGH

**Impact:** Medium-High - Prevents DoS and ensures data integrity
**Effort:** Low - Add max length checks

**Files to Update:**
1. `supabase/functions/onboarding/index.ts`
2. `supabase/functions/analyze-ai-response/index.ts`
3. `supabase/functions/auto-fill-business-context/index.ts`
4. `supabase/functions/free-visibility-checker/index.ts`

**Action:** Add length validation to all string inputs from users.

### Priority 3: Escape LIKE Patterns 🔧 MEDIUM

**Impact:** Low-Medium - Prevents pattern injection in search operations
**Effort:** Low - Single function

**Files to Update:**
1. `supabase/functions/convert-competitor-to-brand/index.ts`

**Action:** Add pattern escaping utility for `.ilike()` operations.

### Priority 4: Zod Schema Validation 📋 MEDIUM

**Impact:** Medium - Comprehensive request validation
**Effort:** Medium - Define schemas for all endpoints

**Action:** Implement Zod schemas for request body validation in critical edge functions.

**Example:**
```typescript
import { z } from 'zod';

const RunPromptSchema = z.object({
  promptId: z.string().uuid(),
});

// In handler:
const body = await req.json();
const { promptId } = RunPromptSchema.parse(body); // Throws if invalid
```

### Priority 5: Enable Security Tests 🧪 HIGH

**Impact:** High - Catches regressions
**Effort:** Low - Remove `.skip` and implement validators

**Files to Update:**
1. `src/__tests__/security/edge-function-auth.test.ts`

**Action:** Enable skipped tests and ensure all pass.

---

## Implementation Plan

### Phase 1: Create Validation Library (Week 1)

Create `supabase/functions/_shared/validation.ts`:

```typescript
/**
 * Centralized input validation and sanitization utilities
 * Prevents SQL injection, XSS, and other input-based attacks
 */

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const SQL_INJECTION_PATTERNS = [
  /(\b(DROP|DELETE|TRUNCATE|ALTER|CREATE)\b.*\b(TABLE|DATABASE|SCHEMA)\b)/i,
  /(\bUNION\b.*\bSELECT\b)/i,
  /(\bINSERT\b.*\bINTO\b)/i,
  /(--|;|\/\*|\*\/|xp_|sp_)/i,
];

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
 */
function containsSqlInjectionPatterns(input: string): boolean {
  return SQL_INJECTION_PATTERNS.some(pattern => pattern.test(input));
}

/**
 * Escape special characters for LIKE queries
 */
export function escapeLikePattern(input: string): string {
  return input
    .replace(/\\/g, '\\\\')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_');
}

/**
 * Sanitize competitor/brand name input
 */
export function sanitizeBrandName(name: unknown): string {
  const validated = validateString(name, 'brand name', {
    minLength: 2,
    maxLength: 100,
  });

  // Unicode normalize
  let sanitized = validated.normalize('NFKC');

  // Remove control characters
  sanitized = sanitized.replace(/[\x00-\x1F\x7F-\x9F\p{C}\p{Z}&&[^\x20]]/gu, '');

  // Remove script tags and dangerous patterns
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  sanitized = sanitized.replace(/javascript:/gi, '');
  sanitized = sanitized.replace(/data:/gi, '');

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
```

### Phase 2: Update Critical Edge Functions (Week 1-2)

**Pattern to apply:**

```typescript
import { validateUUID, validateString, ValidationError } from '../_shared/validation.ts';

Deno.serve(async (req) => {
  try {
    // Parse body
    const body = await req.json();
    
    // Validate inputs
    const promptId = validateUUID(body.promptId, 'promptId');
    const orgId = validateUUID(body.orgId, 'orgId');
    const text = validateString(body.text, 'prompt text', {
      minLength: 1,
      maxLength: 5000,
      checkSqlInjection: true, // For user-facing text fields
    });
    
    // Rest of logic...
    
  } catch (error) {
    if (error instanceof ValidationError) {
      return new Response(
        JSON.stringify({
          error: error.message,
          field: error.field,
          code: error.code,
        }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
    throw error;
  }
});
```

### Phase 3: Enable and Enhance Security Tests (Week 2)

Update `src/__tests__/security/edge-function-auth.test.ts`:

```typescript
import { validateUUID, validateString, ValidationError } from '../../../supabase/functions/_shared/validation';

describe('Input Validation Security', () => {
  describe('UUID Validation', () => {
    it('should accept valid UUIDs', () => {
      const validUuid = '123e4567-e89b-12d3-a456-426614174000';
      expect(() => validateUUID(validUuid, 'testId')).not.toThrow();
    });

    it('should reject invalid UUID formats', () => {
      const invalidInputs = [
        '',
        'not-a-uuid',
        '../../etc/passwd',
        '<script>alert("xss")</script>',
        'DROP TABLE prompts;',
        null,
        undefined,
        123,
      ];

      invalidInputs.forEach(input => {
        expect(() => validateUUID(input, 'testId')).toThrow(ValidationError);
      });
    });
  });

  describe('SQL Injection Prevention', () => {
    it('should detect SQL injection patterns', () => {
      const maliciousInputs = [
        "'; DROP TABLE prompts; --",
        "' UNION SELECT * FROM users --",
        "1' OR '1'='1",
        "admin'/*",
      ];

      maliciousInputs.forEach(input => {
        expect(() => 
          validateString(input, 'test', { checkSqlInjection: true })
        ).toThrow(ValidationError);
      });
    });

    it('should allow safe inputs with SQL-like words in context', () => {
      const safeInputs = [
        "What CRM should I select for my business?",
        "How to create a table of contents?",
        "Database or spreadsheet for small business?",
      ];

      safeInputs.forEach(input => {
        expect(() => 
          validateString(input, 'test', { checkSqlInjection: true })
        ).not.toThrow();
      });
    });
  });

  describe('Length Validation', () => {
    it('should enforce minimum length', () => {
      expect(() =>
        validateString('a', 'test', { minLength: 2 })
      ).toThrow(ValidationError);
    });

    it('should enforce maximum length', () => {
      const longString = 'a'.repeat(10001);
      expect(() =>
        validateString(longString, 'test', { maxLength: 10000 })
      ).toThrow(ValidationError);
    });
  });
});
```

---

## Monitoring and Maintenance

### 1. Add Security Logging

Log validation failures for monitoring:

```typescript
import { ValidationError } from '../_shared/validation.ts';

try {
  const promptId = validateUUID(body.promptId);
} catch (error) {
  if (error instanceof ValidationError) {
    console.warn('[SECURITY] Validation failed', {
      field: error.field,
      code: error.code,
      userId: userId,
      timestamp: new Date().toISOString(),
    });
  }
  throw error;
}
```

### 2. Regular Security Audits

- **Monthly:** Run `npm run security:audit` (existing script)
- **Quarterly:** Review validation patterns and update
- **On deployment:** Run security tests in CI/CD

### 3. Update Security Documentation

Keep this document updated when:
- New edge functions are added
- Validation patterns change
- New vulnerabilities are discovered

---

## Compliance and Standards

### OWASP Top 10 Alignment

- ✅ **A03:2021 - Injection:** Addressed through parameterized queries and input validation
- ✅ **A07:2021 - Identification and Authentication Failures:** JWT validation in place
- ⚠️ **A04:2021 - Insecure Design:** Improve with centralized validation
- ⚠️ **A08:2021 - Software and Data Integrity Failures:** Add input integrity checks

### Industry Best Practices

- ✅ Defense-in-depth: Multiple layers (parameterization + RLS + validation)
- ✅ Least privilege: RLS enforces org-level isolation
- ⚠️ Input validation: Needs standardization
- ⚠️ Security testing: Tests exist but disabled

---

## Conclusion

**Current State:** The platform has **strong foundational protection** against SQL injection through Supabase's parameterized queries. No critical vulnerabilities were found.

**Required Actions:** Implement **Priority 1 and 2 fixes** (UUID validation and length limits) to achieve comprehensive protection.

**Timeline:** All recommended fixes can be implemented within **2 weeks** with minimal disruption to existing functionality.

**Risk After Implementation:** **VERY LOW** - With all recommendations implemented, SQL injection risk will be negligible.

---

**Document Version:** 1.0  
**Last Updated:** 2025-01-27  
**Next Review:** 2025-02-27  
**Owner:** Security Team
