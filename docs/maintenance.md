# Maintenance Guide

## Monthly Security Checklist

### Database Health & Patches
1. **Supabase Dashboard Review**
   - Navigate to **Project** → **Database** → **Health**
   - Check for available Postgres version updates
   - Apply recommended security patches
   - Review performance metrics and recommendations

2. **Post-Update Validation**
   ```bash
   # Run migration tests after updates
   npm run test:db-migrations
   
   # Verify RLS policies still function
   npm run test:e2e -- tests/e2e/security.rls.spec.ts
   
   # Test critical user flows
   npm run test:e2e -- tests/e2e/auth.spec.ts
   ```

### Authentication Security Review
1. **Password Protection Settings**
   - Go to **Authentication** → **Passwords** in Supabase Dashboard
   - Verify **"Block compromised passwords"** is enabled
   - Confirm minimum password length is set to 12+ characters
   - Check password strength requirements are active

2. **User Access Audit**
   - Review authentication logs for unusual patterns
   - Check for dormant accounts that should be disabled
   - Verify MFA adoption rates (if applicable)

### Database Security Validation
1. **RLS Policy Health Check**
   ```bash
   # Run comprehensive security scan
   npm run security:scan
   
   # Verify org isolation
   npm run test:e2e -- tests/e2e/org-isolation.spec.ts
   ```

2. **Extension Security**
   - Confirm extensions remain in dedicated `extensions` schema
   - Verify no unauthorized extensions were installed
   - Check public schema permissions remain restricted

### Dependency Updates
1. **Security Dependencies**
   ```bash
   # Update security-critical packages
   npm audit fix
   
   # Check for outdated security packages
   npm outdated | grep -E "(auth|security|crypto)"
   ```

2. **Supabase Client Updates**
   ```bash
   # Update Supabase SDK
   npm update @supabase/supabase-js
   
   # Test compatibility after updates
   npm run test:integration
   ```

## Quarterly Deep Security Review

### Infrastructure Assessment
- [ ] Review all edge function security implementations
- [ ] Audit API rate limiting effectiveness
- [ ] Validate CORS policies remain appropriate
- [ ] Check for unused/deprecated endpoints

### Access Control Review
- [ ] Audit user roles and permissions
- [ ] Review service account access
- [ ] Validate org isolation boundaries
- [ ] Test emergency access procedures

### Data Protection Validation
- [ ] Verify backup encryption and availability
- [ ] Test data recovery procedures
- [ ] Audit data retention policies
- [ ] Review GDPR/privacy compliance

## Emergency Procedures

### Security Incident Response
1. **Immediate Actions**
   - Disable affected user accounts if necessary
   - Enable additional logging if breach suspected
   - Document incident details and timeline

2. **Investigation Steps**
   - Review authentication and database logs
   - Check for unauthorized data access
   - Validate RLS policy effectiveness
   - Assess scope of potential exposure

3. **Recovery Actions**
   - Apply emergency security patches
   - Reset affected user credentials
   - Update security policies as needed
   - Communicate with affected users (if required)

### Database Emergency Rollback
```sql
-- Emergency RLS re-enable (if accidentally disabled)
ALTER TABLE public.prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscribers ENABLE ROW LEVEL SECURITY;

-- Emergency extension isolation
CREATE SCHEMA IF NOT EXISTS extensions;
-- Contact admin for extension moves
```

## Monitoring Setup

### Automated Alerts
- Set up Supabase project alerts for:
  - Unusual authentication patterns
  - High database CPU/memory usage
  - Failed RLS policy violations
  - Extension installation attempts

### Log Monitoring
- Regular review of:
  - Authentication failure patterns
  - Database query performance issues
  - Edge function error rates
  - CORS violation attempts

## Documentation Updates

After each maintenance cycle:
- [ ] Update this maintenance guide with lessons learned
- [ ] Document any new security measures implemented
- [ ] Update team runbooks with procedure changes
- [ ] Share security updates with development team