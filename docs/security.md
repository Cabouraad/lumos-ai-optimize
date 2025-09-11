# Security Documentation

## Subscription Data Security

### Overview
The `public.subscribers` table is RLS-protected and not directly readable from browser clients for security reasons.

### Browser Access
- Browser must query `public.subscriber_public` (non-sensitive shape)
- This view exposes only: `id`, `org_id`, `tier`, `plan_code`, `status`, `period_ends_at`, `created_at`
- Sensitive data like `email`, `stripe_customer_id`, `stripe_subscription_id` are NOT exposed to browsers

### Per-org Isolation
- Per-org isolation enforced via `users.org_id` relationship
- Users can only see subscription data for their own organization
- RLS policies ensure proper access control

### Server Access
- Server jobs use service role and can access full subscriber data
- Edge functions with `SUPABASE_SERVICE_ROLE_KEY` have full access to `public.subscribers`
- Webhooks, reports, and audit functions operate on the base table

### Important Notes
- All writes/updates to `public.subscribers` must be done in server code only
- Browser clients cannot modify subscription data directly
- If any client component needs sensitive fields, refactor the fetch into an Edge Function and return only what's necessary