# DB Security Audit

Comprehensive security scanning for database exposure vulnerabilities.

## Usage

**Run locally:**
```bash
DATABASE_URL="postgres://..." npm run security:audit
```

**Output:** Lists each finding with a one-line `fix_hint` SQL command.

**CI:** GitHub Actions workflow fails PRs with CRITICAL/HIGH security issues.

## What it checks

- **CRITICAL**: `anon`/`public` SELECT grants on any table/view
- **HIGH**: RLS disabled or not forced on tables  
- **MEDIUM**: Views lacking `security_invoker` option
- **LOW**: Extensions installed in public schema

## Example Output

```
🔎 Security audit findings:
CRITICAL TABLE  public.users                             | Public or anon SELECT grant | Grants: SELECT
   ↳ fix: REVOKE ALL ON public.users FROM PUBLIC, anon; GRANT SELECT TO authenticated (if needed).
HIGH     TABLE  public.subscribers                       | RLS not forced | relrowsecurity=t, relforcerowsecurity=f
   ↳ fix: ALTER TABLE public.subscribers ENABLE ROW LEVEL SECURITY; ALTER TABLE public.subscribers FORCE ROW LEVEL SECURITY;
```

## Integration

The audit is **non-destructive** - it only reports issues. It complements the security lockdown migrations that actually fix grants and RLS policies.

CI automatically runs on every push/PR and blocks merges if CRITICAL or HIGH findings are detected.