# QA Testing Checklist

## Overview
This checklist covers manual testing scenarios that complement automated tests. Each section requires manual verification with screenshot attachments for passing scenarios.

---

## 1. Subscription Gating Matrix Testing

### 1.1 Trial vs Paid Access Scenarios

**Test Case 1.1.1: Active Subscription (subscribed=true)**
- [ ] **Setup**: User with `subscribed: true`, any `payment_collected` value
- [ ] **Expected**: Full access to app and all features
- [ ] **Test Steps**:
  1. Login as subscribed user
  2. Navigate to Dashboard, Prompts, Competitors, Recommendations
  3. Verify no subscription gates appear
  4. Test prompt creation within tier limits
- [ ] **Screenshot**: Dashboard showing full feature access
- [ ] **Result**: ✅ Pass / ❌ Fail

**Test Case 1.1.2: Trial Active + Payment Collected**
- [ ] **Setup**: User with `subscribed: false`, valid `trial_expires_at` (future), `payment_collected: true`
- [ ] **Expected**: Full access to app and features during trial period
- [ ] **Test Steps**:
  1. Login as trial user with payment method
  2. Navigate to all main sections
  3. Verify trial banner shows remaining days
  4. Test feature access (prompts, competitors, recommendations)
- [ ] **Screenshot**: Trial banner with days remaining + feature access
- [ ] **Result**: ✅ Pass / ❌ Fail

**Test Case 1.1.3: Trial Active + No Payment**
- [ ] **Setup**: User with `subscribed: false`, valid `trial_expires_at` (future), `payment_collected: false`
- [ ] **Expected**: Access denied with upgrade prompt
- [ ] **Test Steps**:
  1. Login as trial user without payment method
  2. Attempt to navigate to Dashboard
  3. Verify subscription gate appears
  4. Check "Card required; no charge during trial" message
- [ ] **Screenshot**: Subscription gate with trial message
- [ ] **Result**: ✅ Pass / ❌ Fail

**Test Case 1.1.4: Expired Trial**
- [ ] **Setup**: User with `subscribed: false`, `trial_expires_at` in past, any `payment_collected`
- [ ] **Expected**: Access denied regardless of payment status
- [ ] **Test Steps**:
  1. Login as user with expired trial
  2. Attempt to access any protected route
  3. Verify subscription required message
  4. Test pricing page accessibility
- [ ] **Screenshot**: Expired trial subscription gate
- [ ] **Result**: ✅ Pass / ❌ Fail

### 1.2 Tier-Based Feature Limits

**Test Case 1.2.1: Starter Tier Limits**
- [ ] **Setup**: User with `subscription_tier: 'starter'` (100 prompts/day, 3 providers)
- [ ] **Expected**: Limited feature access per tier
- [ ] **Test Steps**:
  1. Navigate to prompt creation
  2. Verify daily prompt counter shows X/100
  3. Test provider selection (max 3)
  4. Verify recommendations access
- [ ] **Screenshot**: Starter tier limits displayed
- [ ] **Result**: ✅ Pass / ❌ Fail

**Test Case 1.2.2: Pro Tier Full Access**
- [ ] **Setup**: User with `subscription_tier: 'pro'` (2000 prompts/day, 10 providers)
- [ ] **Expected**: Full feature access including API features
- [ ] **Test Steps**:
  1. Verify high prompt limits
  2. Test all provider options
  3. Access API features and advanced scoring
  4. Verify recommendation and competitor analysis
- [ ] **Screenshot**: Pro tier with all features accessible
- [ ] **Result**: ✅ Pass / ❌ Fail

---

## 2. convert-competitor-to-brand Edge Function Testing

### 2.1 Security and Authorization

**Test Case 2.1.1: Unauthorized Access**
- [ ] **Setup**: No authentication token or invalid token
- [ ] **Expected**: 401 Unauthorized response
- [ ] **Test Steps**:
  1. Call edge function without Authorization header
  2. Call with invalid/expired token
  3. Verify proper error codes returned
- [ ] **Screenshot**: Developer tools showing 401 responses
- [ ] **Result**: ✅ Pass / ❌ Fail

**Test Case 2.1.2: Wrong Organization Access**
- [ ] **Setup**: User authenticated for Org A trying to modify Org B data
- [ ] **Expected**: 403 Forbidden with organization mismatch error
- [ ] **Test Steps**:
  1. Login as user from Organization A
  2. Attempt to convert competitor for Organization B
  3. Verify access denied message
- [ ] **Screenshot**: Organization mismatch error message
- [ ] **Result**: ✅ Pass / ❌ Fail

**Test Case 2.1.3: Non-Owner Role Restriction**
- [ ] **Setup**: User with 'member' role (not 'owner' or 'admin')
- [ ] **Expected**: 403 Forbidden with insufficient role error
- [ ] **Test Steps**:
  1. Login as member-level user
  2. Navigate to competitor management
  3. Attempt competitor conversion
  4. Verify role-based access denial
- [ ] **Screenshot**: Insufficient role error message
- [ ] **Result**: ✅ Pass / ❌ Fail

### 2.2 Successful Operations

**Test Case 2.2.1: First-Time Competitor Conversion**
- [ ] **Setup**: Valid competitor entry that hasn't been converted
- [ ] **Expected**: Competitor removed from catalog, added as org brand
- [ ] **Test Steps**:
  1. Identify competitor in catalog
  2. Right-click and select "Mark as My Brand"
  3. Verify competitor disappears from competitor list
  4. Verify brand appears in organization brands
  5. Check similarity score calculation
- [ ] **Screenshot**: Before/after competitor conversion
- [ ] **Result**: ✅ Pass / ❌ Fail

**Test Case 2.2.2: Idempotent Operation**
- [ ] **Setup**: Previously converted competitor
- [ ] **Expected**: No duplicate creation, graceful handling
- [ ] **Test Steps**:
  1. Attempt to convert already-converted competitor
  2. Verify no error occurs
  3. Check that no duplicate brand entries exist
  4. Verify response indicates "already exists"
- [ ] **Screenshot**: Idempotent operation response
- [ ] **Result**: ✅ Pass / ❌ Fail

**Test Case 2.2.3: Side Effect Validation (Response Updates)**
- [ ] **Setup**: Competitor mentioned in recent prompt responses
- [ ] **Expected**: Related responses updated with improved scores
- [ ] **Test Steps**:
  1. Note current scores for responses mentioning competitor
  2. Convert competitor to org brand
  3. Verify response scores increased (brand presence detected)
  4. Check response metadata for update flags
- [ ] **Screenshot**: Score improvements after conversion
- [ ] **Result**: ✅ Pass / ❌ Fail

---

## 3. check-subscription Refresh Testing

### 3.1 Periodic Refresh (Every 10 seconds)

**Test Case 3.1.1: Automatic Status Updates**
- [ ] **Setup**: Authenticated user with subscription
- [ ] **Expected**: Subscription status refreshes every 10 seconds
- [ ] **Test Steps**:
  1. Login and observe subscription status
  2. Wait 10 seconds, check for refresh indicator
  3. Monitor network tab for check-subscription calls
  4. Verify subscription data updates appropriately
- [ ] **Screenshot**: Network tab showing periodic refresh calls
- [ ] **Result**: ✅ Pass / ❌ Fail

**Test Case 3.1.2: Status Change Detection**
- [ ] **Setup**: User subscription modified externally (via Stripe)
- [ ] **Expected**: UI updates within 10 seconds without page refresh
- [ ] **Test Steps**:
  1. Start with active subscription
  2. Cancel subscription in Stripe dashboard
  3. Wait for periodic refresh to detect change
  4. Verify UI updates to show cancelled status
- [ ] **Screenshot**: UI showing updated subscription status
- [ ] **Result**: ✅ Pass / ❌ Fail

### 3.2 Post-Checkout Refresh

**Test Case 3.2.1: Successful Stripe Checkout Return**
- [ ] **Setup**: User completing Stripe checkout flow
- [ ] **Expected**: Immediate subscription status refresh on return
- [ ] **Test Steps**:
  1. Start checkout from pricing page
  2. Complete payment in Stripe
  3. Return to success page
  4. Verify immediate subscription status update
  5. Confirm access to previously restricted features
- [ ] **Screenshot**: Success page with updated subscription
- [ ] **Result**: ✅ Pass / ❌ Fail

**Test Case 3.2.2: Customer Portal Return**
- [ ] **Setup**: User managing subscription via Stripe Customer Portal
- [ ] **Expected**: Subscription changes reflected immediately on return
- [ ] **Test Steps**:
  1. Access Customer Portal from dashboard
  2. Make subscription change (upgrade/downgrade/cancel)
  3. Return to application
  4. Verify changes reflected without manual refresh
- [ ] **Screenshot**: Updated tier/status after portal return
- [ ] **Result**: ✅ Pass / ❌ Fail

### 3.3 Error Handling

**Test Case 3.3.1: Network Failure Recovery**
- [ ] **Setup**: Simulated network connectivity issues
- [ ] **Expected**: Graceful degradation, retry mechanism
- [ ] **Test Steps**:
  1. Disconnect network during refresh
  2. Verify app continues functioning with cached data
  3. Reconnect network
  4. Confirm subscription refresh resumes
- [ ] **Screenshot**: App functioning during network issues
- [ ] **Result**: ✅ Pass / ❌ Fail

---

## 4. Batch Job Cancellation Flow

### 4.1 Active Job Detection

**Test Case 4.1.1: Cancel Confirmation Dialog**
- [ ] **Setup**: Multiple batch jobs in progress
- [ ] **Expected**: User confirmation required before cancellation
- [ ] **Test Steps**:
  1. Navigate to prompt execution with active jobs
  2. Click "Run All Prompts" or similar trigger
  3. Verify confirmation dialog appears
  4. Check dialog mentions number of active jobs
- [ ] **Screenshot**: Cancellation confirmation dialog
- [ ] **Result**: ✅ Pass / ❌ Fail

**Test Case 4.1.2: Job Status Visibility**
- [ ] **Setup**: Mix of pending, processing, and completed jobs
- [ ] **Expected**: Clear status indicators for each job
- [ ] **Test Steps**:
  1. View batch job status page/widget
  2. Verify different job states are visually distinct
  3. Check progress indicators for processing jobs
  4. Confirm completed tasks preserved during cancellation
- [ ] **Screenshot**: Job status dashboard
- [ ] **Result**: ✅ Pass / ❌ Fail

### 4.2 Cancellation Process

**Test Case 4.2.1: Smooth Cancellation & New Job Start**
- [ ] **Setup**: Active batch jobs ready for cancellation
- [ ] **Expected**: Old jobs cancelled, new job starts immediately
- [ ] **Test Steps**:
  1. Confirm cancellation in dialog
  2. Observe progress indicators during transition
  3. Verify new job appears in processing state
  4. Check that completed work is preserved
- [ ] **Screenshot**: Smooth transition from old to new jobs
- [ ] **Result**: ✅ Pass / ❌ Fail

**Test Case 4.2.2: Partial Completion Handling**
- [ ] **Setup**: Job with mix of completed, failed, and pending tasks
- [ ] **Expected**: Only pending/processing tasks cancelled
- [ ] **Test Steps**:
  1. Start with partially completed job (e.g., 60% done)
  2. Request new job with cancellation
  3. Verify completed tasks (60%) remain in history
  4. Check only remaining 40% was cancelled
- [ ] **Screenshot**: Preserved completed tasks after cancellation
- [ ] **Result**: ✅ Pass / ❌ Fail

### 4.3 Error Scenarios

**Test Case 4.3.1: Stuck Job Recovery**
- [ ] **Setup**: Job stuck in processing state for >10 minutes
- [ ] **Expected**: Force cancellation options available
- [ ] **Test Steps**:
  1. Identify stuck job in processing state
  2. Attempt normal cancellation
  3. If normal cancellation fails, verify force options
  4. Use force cancellation and verify cleanup
- [ ] **Screenshot**: Stuck job recovery interface
- [ ] **Result**: ✅ Pass / ❌ Fail

**Test Case 4.3.2: Cancellation Failure Handling**
- [ ] **Setup**: Simulated database lock preventing cancellation
- [ ] **Expected**: Clear error message, no new job creation
- [ ] **Test Steps**:
  1. Trigger scenario where cancellation fails
  2. Verify error message is user-friendly
  3. Confirm new job is NOT created when cancellation fails
  4. Check user can retry or get support options
- [ ] **Screenshot**: Cancellation failure error message
- [ ] **Result**: ✅ Pass / ❌ Fail

---

## 5. UI/UX Quality Assurance

### 5.1 Dashboard Empty States

**Test Case 5.1.1: No Layout Shift in Metric Cards**
- [ ] **Setup**: Fresh user account with no data
- [ ] **Expected**: All metric cards show placeholders, no shifting
- [ ] **Test Steps**:
  1. Login as new user with no prompts/responses
  2. Navigate to dashboard
  3. Verify all metric cards have consistent height
  4. Check that loading states don't cause layout shift
- [ ] **Screenshot**: Dashboard with empty state placeholders
- [ ] **Result**: ✅ Pass / ❌ Fail

**Test Case 5.1.2: Consistent Provider Display**
- [ ] **Setup**: Responses from multiple providers
- [ ] **Expected**: Provider names without model details
- [ ] **Test Steps**:
  1. View prompt responses list
  2. Verify provider names are consistent (e.g., "OpenAI" not "OpenAI GPT-4")
  3. Check that all providers follow same naming convention
- [ ] **Screenshot**: Consistent provider naming
- [ ] **Result**: ✅ Pass / ❌ Fail

### 5.2 Interactive Elements

**Test Case 5.2.1: CompetitorChip Tooltip**
- [ ] **Setup**: Competitor entries in catalog or results
- [ ] **Expected**: Tooltip shows "Right-click or ⋮ to mark as My Brand"
- [ ] **Test Steps**:
  1. Hover over competitor chip/element
  2. Verify tooltip appears with correct text
  3. Test tooltip on different competitor entries
  4. Confirm tooltip positioning and readability
- [ ] **Screenshot**: Competitor chip with tooltip visible
- [ ] **Result**: ✅ Pass / ❌ Fail

**Test Case 5.2.2: Trial Banner Clarity**
- [ ] **Setup**: User in trial period without payment method
- [ ] **Expected**: Banner clearly states "Card required; no charge during trial"
- [ ] **Test Steps**:
  1. Login as trial user without payment
  2. View subscription banner/prompt
  3. Verify messaging is clear about no charges during trial
  4. Check that card requirement is emphasized
- [ ] **Screenshot**: Clear trial banner messaging
- [ ] **Result**: ✅ Pass / ❌ Fail

---

## 6. Cross-Browser & Device Testing

### 6.1 Browser Compatibility

**Test Case 6.1.1: Chrome/Chromium**
- [ ] **Setup**: Latest Chrome browser
- [ ] **Test**: All critical flows (subscription, job management, conversions)
- [ ] **Screenshot**: Key features working in Chrome
- [ ] **Result**: ✅ Pass / ❌ Fail

**Test Case 6.1.2: Firefox**
- [ ] **Setup**: Latest Firefox browser
- [ ] **Test**: All critical flows
- [ ] **Screenshot**: Key features working in Firefox
- [ ] **Result**: ✅ Pass / ❌ Fail

**Test Case 6.1.3: Safari**
- [ ] **Setup**: Latest Safari browser (macOS/iOS)
- [ ] **Test**: All critical flows
- [ ] **Screenshot**: Key features working in Safari
- [ ] **Result**: ✅ Pass / ❌ Fail

### 6.2 Responsive Design

**Test Case 6.2.1: Mobile Layout (320px-768px)**
- [ ] **Setup**: Mobile device or browser dev tools
- [ ] **Test**: Navigation, subscription gates, job management
- [ ] **Screenshot**: Mobile-optimized interface
- [ ] **Result**: ✅ Pass / ❌ Fail

**Test Case 6.2.2: Tablet Layout (768px-1024px)**
- [ ] **Setup**: Tablet or medium-width browser
- [ ] **Test**: All responsive breakpoints function correctly
- [ ] **Screenshot**: Tablet-optimized layout
- [ ] **Result**: ✅ Pass / ❌ Fail

---

## 7. Performance & Accessibility

### 7.1 Loading Performance

**Test Case 7.1.1: Dashboard Load Times**
- [ ] **Setup**: Dashboard with moderate data load
- [ ] **Expected**: Initial load <3 seconds, interactions <1 second
- [ ] **Test Steps**:
  1. Use browser dev tools Performance tab
  2. Record dashboard load
  3. Verify Core Web Vitals (LCP, FID, CLS)
- [ ] **Screenshot**: Performance metrics passing thresholds
- [ ] **Result**: ✅ Pass / ❌ Fail

### 7.2 Accessibility

**Test Case 7.2.1: Keyboard Navigation**
- [ ] **Setup**: Any page with interactive elements
- [ ] **Expected**: All functions accessible via keyboard
- [ ] **Test Steps**:
  1. Navigate using only Tab, Enter, Space, Arrow keys
  2. Verify focus indicators are visible
  3. Test screen reader compatibility (if available)
- [ ] **Screenshot**: Clear focus indicators
- [ ] **Result**: ✅ Pass / ❌ Fail

---

## Sign-off

### QA Engineer
- **Name**: ___________________
- **Date**: ___________________
- **Overall Status**: ✅ Pass / ❌ Fail
- **Critical Issues**: ___________________
- **Notes**: ___________________

### Technical Lead
- **Name**: ___________________  
- **Date**: ___________________
- **Approval**: ✅ Approved / ❌ Needs Revision
- **Comments**: ___________________

### Product Owner
- **Name**: ___________________
- **Date**: ___________________  
- **Sign-off**: ✅ Approved for Production / ❌ Hold
- **Business Impact**: ___________________

---

## Notes

- Attach screenshots for each passing test case
- Document any deviations or workarounds used
- Report all failures with reproduction steps
- Update automated tests based on manual findings