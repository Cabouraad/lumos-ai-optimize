# CRITICAL SECURITY FIX: Payment Bypass Vulnerability

**Date**: 2025-10-28  
**Severity**: CRITICAL  
**Status**: FIXED

## Vulnerability Description

Users were able to bypass the Stripe payment step during onboarding and gain access to the dashboard with "Starter" subscription privileges without completing any payment.

## Root Cause

The vulnerability existed in **two critical locations**:

### 1. SubscriptionProvider Fallback Logic (PRIMARY ISSUE)

**File**: `src/contexts/SubscriptionProvider.tsx`  
**Lines**: 100-111, 130-141

When the RPC call to `get_user_subscription_status()` returned no subscriber record (or failed), the fallback logic would **automatically grant access** based solely on the organization's `plan_tier`:

```typescript
// VULNERABLE CODE (BEFORE FIX):
if (subError) {
  finalSubscriptionData = {
    subscribed: orgPlanTier !== 'free' && orgPlanTier !== null,  // ❌ Grants access without payment
    payment_collected: orgPlanTier !== 'free' && orgPlanTier !== null,  // ❌ CRITICAL BUG
    // ...
  };
}
```

Since the onboarding edge function creates organizations with `plan_tier: "starter"` by default, users would get:
- `subscribed: true`
- `payment_collected: true`

Without ever creating a subscriber record or going through Stripe.

### 2. Onboarding Flow Access Check

**File**: `src/pages/Onboarding.tsx`  
**Lines**: 236-243

After completing organization setup (step 2), the code would check `hasAccessToApp()` and automatically skip to step 4 (prompts) if access was granted, bypassing step 3 (payment):

```typescript
// VULNERABLE CODE (BEFORE FIX):
setTimeout(() => {
  const access = hasAccessToApp();
  if (access.hasAccess) {
    setCurrentStep(4);  // ❌ Skip payment!
  } else {
    setCurrentStep(3);
  }
}, 100);
```

### 3. Permissive Loading State

**File**: `src/hooks/useSubscriptionGate.tsx`  
**Lines**: 256-258

During auth loading, the system would grant access by default:

```typescript
// VULNERABLE CODE (BEFORE FIX):
if (authLoading) {
  return { hasAccess: true };  // ❌ Grants access during loading
}
```

## Attack Vector

1. User signs up for an account
2. User completes Step 1: Basic Information (org name, domain)
3. User completes Step 2: Business Context
4. `handleCompleteOnboarding()` creates organization with `plan_tier: "starter"`
5. No subscriber record created in database
6. `SubscriptionProvider` fallback grants `payment_collected: true` based on org tier
7. Onboarding flow checks access and skips Step 3: Payment
8. User reaches Step 4: Prompts and then Dashboard **WITHOUT PAYING**

## Fix Implementation

### 1. Hardened SubscriptionProvider Fallback

```typescript
// FIXED CODE:
if (subError) {
  // SECURITY: Never grant access without explicit subscriber record
  finalSubscriptionData = {
    subscribed: false,
    subscription_tier: 'free',
    payment_collected: false,  // ✅ FIXED: Require explicit subscriber record
    // ...
  };
}

// When no subscriber record exists
else {
  // SECURITY: No subscription record = no paid access
  finalSubscriptionData = {
    subscribed: false,
    subscription_tier: 'free',
    payment_collected: false,  // ✅ FIXED: Require Stripe checkout
    // ...
  };
}
```

### 2. Mandatory Payment Step

```typescript
// FIXED CODE:
// SECURITY: ALWAYS require payment step after org creation
// Never automatically grant access without explicit subscriber record
setCurrentStep(3); // Always proceed to payment step
```

### 3. Deny Access During Loading

```typescript
// FIXED CODE:
if (authLoading) {
  return { hasAccess: false, reason: 'Loading subscription data...' };
}
```

### 4. Enhanced Security Logging

Added comprehensive logging to track access grants and detect bypass attempts:

```typescript
console.log('[SubscriptionProvider] Final subscription data:', {
  // ...
  hasSubscriberRecord: !!subscriberData,
  SECURITY_ALERT: !subscriberData && finalSubscriptionData.subscribed ? 'ACCESS_WITHOUT_SUBSCRIBER_RECORD' : null
});

console.log('[SUBSCRIPTION_GATE] Access check:', {
  hasValidAccess,
  subscribed,
  payment_collected,
  // ...
});
```

## Security Principle

**Access should ONLY be granted when**:
1. A subscriber record exists in the database (created via Stripe webhook or trial activation), AND
2. One of the following is true:
   - `subscribed === true` (active paid subscription)
   - `trial_expires_at > now() AND payment_collected === true` (active trial with payment method on file)

**The organization's `plan_tier` field is NOT sufficient for access control** - it's metadata only.

## Testing Recommendations

1. Test new user signup flow from start to finish
2. Verify users cannot skip payment step
3. Verify users without subscriber records cannot access dashboard
4. Monitor logs for `SECURITY_ALERT: ACCESS_WITHOUT_SUBSCRIBER_RECORD` messages
5. Test that legitimate paying users still have proper access

## Files Modified

- `src/contexts/SubscriptionProvider.tsx` - Fixed fallback logic
- `src/pages/Onboarding.tsx` - Enforced mandatory payment step
- `src/hooks/useSubscriptionGate.tsx` - Deny access during loading, add audit logging

## Related Security Notes

See also:
- `SECURITY-NOTES.md` - General security guidelines
- `docs/security-sql-injection-assessment.md` - SQL injection protections
