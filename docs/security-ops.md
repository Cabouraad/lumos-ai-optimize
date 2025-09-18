# Security Operations Guide

This document outlines routine security maintenance tasks for the Llumos platform.

## Monthly Security Checklist

### 1. PostgreSQL Security Patches

**What**: Keep the Supabase PostgreSQL instance updated with latest security patches.

**How**: 
1. Open Supabase Dashboard → Database → Health
2. Review any available upgrades under "Database Version"
3. Apply recommended upgrades during maintenance windows
4. Monitor for any compatibility issues after upgrade

**Schedule**: Check monthly, apply patches as available

### 2. Leaked Password Protection

**What**: Ensure compromised password detection is enabled to prevent users from using known breached passwords.

**How**:
1. Open Supabase Dashboard → Authentication → Passwords
2. Verify "Block compromised passwords" is enabled
3. Review settings for password strength requirements

**Current Implementation**: 
- Client-side warnings using zxcvbn and HaveIBeenPwned API
- Non-blocking UI warnings preserve user experience
- Server-side blocking via Supabase configuration

**Schedule**: Verify monthly, no code changes required

## Security Architecture Notes

### Row-Level Security (RLS)
- All business tables have RLS enabled and **forced**
- Forcing RLS prevents accidental policy bypasses
- Views use `security_invoker=on` to respect underlying table RLS

### Access Control
- Admin access controlled via `users.role` field (owner/admin)
- No hardcoded email addresses in access control logic
- Service role operations isolated and audited

### Extension Security
- Extensions moved to dedicated `extensions` schema
- Public schema creation privileges revoked
- Default privileges locked down to prevent privilege escalation

## Monitoring

- Failed authentication attempts logged automatically
- RLS policy violations generate audit events
- Service role usage monitored via database logs

## Incident Response

For security incidents:
1. Check Supabase logs (Database → Logs)
2. Review authentication events (Auth → Users → Logs)
3. Verify RLS policies are functioning (run security audit)
4. Apply emergency patches via database migrations if needed

## Automated Checks

The security audit function `public.run_security_audit()` can be run periodically to check for:
- Missing RLS policies
- Insecure view configurations
- Privilege escalation risks
- Extension security issues