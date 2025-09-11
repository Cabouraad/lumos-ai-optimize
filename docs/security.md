# Security Documentation

## Overview
This document outlines security best practices and configurations for the Llumos platform.

## Password Security

### Client-Side Password Strength
The application includes real-time password strength analysis that:
- Uses zxcvbn library for intelligent password scoring
- Checks against Have I Been Pwned database for compromised passwords
- Provides user-friendly feedback and suggestions
- Does not block sign-up, only shows warnings

### Server-Side Password Protection (Supabase Configuration)

To enable maximum password security in production:

1. **Navigate to Supabase Dashboard**
   - Go to your project dashboard
   - Navigate to **Authentication** → **Passwords**

2. **Enable Password Protection Features**
   - ✅ **Block compromised passwords**: Prevents users from using passwords found in data breaches
   - ✅ **Minimum password length**: Set to 12 characters minimum
   - ✅ **Password strength validation**: Requires strong passwords

3. **Verification Steps**
   ```bash
   # Run this to verify settings are applied
   npm run test:e2e -- tests/e2e/security.rls.spec.ts
   ```

### Implementation Details

The password strength system is non-blocking by design:
- **Client warnings only**: Users see strength indicators and breach warnings
- **No API blocking**: Sign-up proceeds regardless of client analysis
- **Privacy-preserving**: Uses k-anonymity for breach checking (only sends first 5 chars of SHA-1 hash)

## Row-Level Security (RLS)

### Business Data Protection
- **Prompts**: Only authenticated users in the same organization can read/write
- **Recommendations**: Strict per-organization isolation
- **Subscribers**: Per-organization access with service role override for system operations

### Testing RLS Policies
```bash
# Verify anonymous users cannot access business data
npm run test:e2e -- tests/e2e/security.rls.spec.ts
```

## Database Security

### Extensions Management
- Relocatable extensions moved to dedicated `extensions` schema
- Public schema write access restricted
- Service operations remain unaffected

### Access Patterns
- **Client applications**: Use RLS-protected tables through authenticated requests
- **Service operations**: Use service role to bypass RLS for system tasks
- **Anonymous access**: Blocked for all business-critical tables

## Monitoring and Maintenance

### Regular Security Checks
- Monthly Supabase linter runs
- Database patch application review
- Authentication settings verification
- RLS policy effectiveness testing

### Incident Response
1. Monitor authentication logs for unusual patterns
2. Review database access patterns regularly
3. Apply security patches promptly
4. Test RLS policies after any schema changes

## Security Headers and CORS

Edge functions implement secure CORS policies:
```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
```

## Best Practices

1. **Authentication**
   - Use strong, unique passwords (enforced client-side + server-side)
   - Enable 2FA when available
   - Regular session cleanup

2. **Database Access**
   - Always use parameterized queries
   - Leverage RLS for all business data
   - Regular backup verification

3. **API Security**
   - Rate limiting on sensitive endpoints
   - Input validation and sanitization
   - Proper error handling without information leakage

4. **Infrastructure**
   - Keep dependencies updated
   - Monitor for security advisories
   - Regular security audits