-- E2E RLS Assertion Tests (Non-Destructive)
-- These are manual checks to verify Row Level Security is working correctly
-- Run these queries manually to verify RLS isolation

-- Test 1: Anonymous users should be denied access to users table
-- Expected: Permission denied
-- SELECT * FROM public.users;

-- Test 2: Authenticated users should only see their own user record
-- Expected: Only returns the current user's record
-- SELECT id, email, role FROM public.users WHERE id <> auth.uid();

-- Test 3: Cross-organization data should be blocked
-- Expected: No results from other organizations
-- SELECT * FROM public.prompts WHERE org_id <> (SELECT org_id FROM users WHERE id = auth.uid());

-- Test 4: Subscribers table should only show own subscription
-- Expected: Only current user's subscription
-- SELECT user_id, subscription_tier, subscribed FROM public.subscribers WHERE user_id <> auth.uid();

-- Test 5: Sensitive subscription data should be masked from public queries
-- Expected: stripe_customer_id and stripe_subscription_id should not be accessible via normal queries
-- SELECT stripe_customer_id, stripe_subscription_id FROM public.subscribers;

-- Test 6: Brand catalog should be org-scoped
-- Expected: Only brands from current user's org
-- SELECT org_id, name FROM public.brand_catalog 
-- WHERE org_id <> (SELECT org_id FROM users WHERE id = auth.uid());

-- Test 7: Prompt responses should be org-scoped
-- Expected: Only responses from current user's org
-- SELECT org_id, prompt_id FROM public.prompt_provider_responses 
-- WHERE org_id <> (SELECT org_id FROM users WHERE id = auth.uid());

-- Test 8: Reports should be org-scoped
-- Expected: Only reports from current user's org
-- SELECT org_id FROM public.reports 
-- WHERE org_id <> (SELECT org_id FROM users WHERE id = auth.uid());

-- Test 9: Weekly reports should be org-scoped
-- Expected: Only weekly reports from current user's org
-- SELECT org_id FROM public.weekly_reports 
-- WHERE org_id <> (SELECT org_id FROM users WHERE id = auth.uid());

-- Test 10: Batch jobs should be org-scoped
-- Expected: Only batch jobs from current user's org
-- SELECT org_id FROM public.batch_jobs 
-- WHERE org_id <> (SELECT org_id FROM users WHERE id = auth.uid());

-- Test 11: Service role should have full access (run with service role key)
-- Expected: Returns all records
-- SELECT COUNT(*) FROM public.users;
-- SELECT COUNT(*) FROM public.organizations;
-- SELECT COUNT(*) FROM public.subscribers;

-- Test 12: Domain verification should be enforced for sensitive operations
-- Expected: Operations should check domain verification status
-- SELECT verified_at FROM public.organizations WHERE id = (SELECT org_id FROM users WHERE id = auth.uid());

/*
Instructions for manual testing:

1. Authentication Tests:
   - Run queries 1-2 while signed out (should fail)
   - Sign in as starter_e2e@test.app and run queries 2-12
   - Sign in as growth_e2e@test.app and run queries 2-12
   - Compare results (should only see own org data)

2. Cross-Org Isolation Tests:
   - With starter_e2e@test.app signed in, run queries 3-10
   - Should return 0 rows (no cross-org data leakage)
   - Repeat with growth_e2e@test.app
   
3. Service Role Tests:
   - Using service role key, run query 11
   - Should return all records across orgs

4. Expected Behaviors:
   - Each org should only see their own data
   - No cross-org data leakage
   - Sensitive fields (stripe IDs) properly protected
   - Service role has administrative access
   
5. Red Flags:
   - Any query returning cross-org data when signed in as regular user
   - Anonymous access to protected tables
   - Sensitive data exposed in public queries
   - RLS policies not enforcing org boundaries
*/